import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppSelector } from "../store";
import type { CardModel } from "../components/Card";
import HandCards from "../components/HandCards";
import socket from "../shared/socket/socket";
import {
  attackWithUnit,
  endMatchTurn,
  leaveMatch,
  playMatchCard,
  syncMatch,
  type MatchErrorPayload,
  type MatchFinishPayload,
  type MatchStatePayload,
  type MatchTimerPayload,
  type UnitInstance
} from "../shared/socket/matchSocket";
import { useMatchBoard } from "../features/customHooks/useMatchBoard";
import { useGameMatchSession } from "../features/customHooks/useGameMatchSession";
import { useTimedNotice } from "../features/customHooks/useTimedNotice";
import { useGameViewModel } from "../features/customHooks/useGameViewModel";
import "./GamePage.css";
import TurnCountdown from "../components/TurnCountdown";
import LeaveArenaConfirmModal from "../components/LeaveArenaConfirmModal";
import MatchBoard from "../components/MatchBoard";
import BattlefieldUnitCard from "../components/BattlefieldUnitCard";
import BattleEffectsLayer, {
  type BattleEffect,
  type CardFlyEffect,
  type HitTextEffect,
  type SpellBurstEffect,
} from "../components/BattleEffectsLayer";


// ─── Attack flow state ────────────────────────────────────────────────────────

type AttackState =
  | { mode: "idle" }
  | { mode: "selectingTarget"; attackerInstanceId: string }
  | { mode: "selectingSpellTarget"; spellCardId: string; originalCardId: string; actionId: string };

type StatusView = { type: string; turns?: number; amount?: number };

function mapMatchErrorMessage(type?: string, fallback?: string): string {
  const normalized = String(type || "").toUpperCase();

  if (normalized === "INVALID_TURN") return "Not your turn.";
  if (normalized === "STATE_OUTDATED") return "Game state outdated. Syncing...";
  if (normalized === "DUPLICATE_ACTION") return "Action already processed.";
  if (normalized === "RATE_LIMIT") return "Too many actions. Slow down.";
  if (normalized === "MATCH_FINISHED") return "Match already finished.";
  if (normalized === "INVALID_CARD") return "Card not found.";
  if (normalized === "INVALID_DECK") return "Deck must contain 20 valid cards.";
  if (normalized === "MATCH_FULL") return "Match is full.";
  if (normalized === "INVALID_ACTION") return "Invalid action.";

  return fallback || "Match action failed.";
}

const MAX_BOARD_UNITS = 5;
const SPELL_VISUAL_LEAD_MS = 90;
const SPELL_UNIT_BURST_DELAY_MS = 120;
const SPELL_HERO_BURST_DELAY_MS = 180;

// ─── Component ────────────────────────────────────────────────────────────────

export default function GamePage() {
  const navigate = useNavigate();

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlHeight = html.style.height;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyHeight = body.style.height;
    html.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.height = "100%";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.height = prevHtmlHeight;
      body.style.overflow = prevBodyOverflow;
      body.style.height = prevBodyHeight;
    };
  }, []);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const arenaId = searchParams.get("arenaId") ?? "unknown";
  const [opponentNickname, setOpponentNickname] = useState(searchParams.get("opponent") ?? "UNKNOWN");
  const [arenaMatchId, setArenaMatchId] = useState<string | null>(searchParams.get("matchId"));

  const nickname = useAppSelector((s) => s.auth.nickname);
  const userId = useAppSelector((s) => s.auth.userId);
  const token = useAppSelector((s) => s.auth.token);
  const userIdStr = userId != null ? String(userId) : null;

  const displayName = nickname ?? "UNKNOWN";

  const [match, setMatch] = useState<MatchStatePayload | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [finishReason, setFinishReason] = useState<string | null>(null);
  const [ratingChange, setRatingChange] = useState<number | null>(null);
  const [finishGameMode, setFinishGameMode] = useState<string | null>(null);
  const [attackState, setAttackState] = useState<AttackState>({ mode: "idle" });
  const [timerRemaining, setTimerRemaining] = useState(45);
  const [battleEffects, setBattleEffects] = useState<BattleEffect[]>([]);
  const [pendingPlayedCardIds, setPendingPlayedCardIds] = useState<string[]>([]);
  const [enemyHeroShakeToken, setEnemyHeroShakeToken] = useState(0);
  const [enemyHeroFlashToken, setEnemyHeroFlashToken] = useState(0);
  const [enemyUnitShake, setEnemyUnitShake] = useState<{ id: string | null; token: number }>({
    id: null,
    token: 0,
  });
  const [enemyUnitFlash, setEnemyUnitFlash] = useState<{ id: string | null; token: number }>({
    id: null,
    token: 0,
  });
  const handCardElementsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const selfUnitsZoneRef = useRef<HTMLDivElement | null>(null);
  const selfPlayedZoneRef = useRef<HTMLDivElement | null>(null);
  const enemyHeroRef = useRef<HTMLDivElement | null>(null);
  const enemyUnitElementsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const [isMobileView, setIsMobileView] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 768
  );
  const lastSpellNoticeEventIdRef = useRef<number | null>(null);
  const { playedCards, cardCatalog, applyEvents, resetBoard } = useMatchBoard();
  const {
    value: spellNotice,
    isFading: spellNoticeFading,
    show: showSpellNoticeMessage,
  } = useTimedNotice();
  const {
    value: battlefieldHint,
    isFading: battlefieldHintFading,
    show: showBattlefieldHint,
    hide: hideBattlefieldHint,
  } = useTimedNotice();
  const {
    value: handHint,
    isFading: handHintFading,
    show: showHandHint,
    hide: hideHandHint,
  } = useTimedNotice();

  const isSameUser = useCallback((value: string | number | null | undefined) =>
    String(value ?? "").trim().toLowerCase() === String(userIdStr ?? "").trim().toLowerCase(), [userIdStr]);

  const formatStatusLabel = (status: StatusView): string => {
    const type = String(status?.type || "unknown").toUpperCase();
    const hasTurns = Number.isFinite(status?.turns);
    const hasAmount = Number.isFinite(status?.amount);

    if (type === "SHIELD" && hasAmount && hasTurns) return `${type} +${status.amount} \u2022 ${status.turns}t`;
    if (type === "SHIELD" && hasAmount) return `${type} +${status.amount}`;
    if (hasTurns) return `${type} x${status.turns}`;
    return type;
  };

  const getStatusBadgeClass = (statusType?: string): string => {
    const type = String(statusType || "").toLowerCase();
    if (type === "burn") return "game-status-badge game-status-badge--burn";
    if (type === "weak") return "game-status-badge game-status-badge--weak";
    if (type === "stun") return "game-status-badge game-status-badge--stun";
    if (type === "shield") return "game-status-badge game-status-badge--shield";
    return "game-status-badge";
  };

  const renderStatuses = (statuses?: StatusView[]) => {
    if (!Array.isArray(statuses) || statuses.length === 0) {
      return "None";
    }

    return statuses.map((status, index) => (
      <span
        key={`${status.type}-${status.turns ?? "na"}-${status.amount ?? "na"}-${index}`}
        className={getStatusBadgeClass(status.type)}
      >
        {formatStatusLabel(status)}
      </span>
    ));
  };

  const showSpellNotice = useCallback((events?: MatchStatePayload["events"]) => {
    if (!Array.isArray(events) || events.length === 0) return;

    const latestSpellEvent = [...events]
      .reverse()
      .find((event) => String(event?.type || "") === "CARD_PLAYED" && String(event?.payload?.card?.type || "").toLowerCase() === "spell");

    if (!latestSpellEvent?.payload?.card?.name) return;
    if (lastSpellNoticeEventIdRef.current === latestSpellEvent.eventId) return;
    lastSpellNoticeEventIdRef.current = latestSpellEvent.eventId;

    const ownerLabel = isSameUser(latestSpellEvent.payload.playerId) ? "Your" : "Opponent";
    showSpellNoticeMessage(`${ownerLabel} spell resolved: ${latestSpellEvent.payload.card.name}`);
  }, [isSameUser, showSpellNoticeMessage]);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── URL params sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fromQueryOpponent = searchParams.get("opponent");
    const fromQueryMatchId = searchParams.get("matchId");
    if (fromQueryOpponent) setOpponentNickname(fromQueryOpponent);
    if (fromQueryMatchId) setArenaMatchId(fromQueryMatchId);
  }, [searchParams]);

  const handleMatchStatePayload = useCallback((payload: MatchStatePayload) => {
    setMatchError(null);
    hideBattlefieldHint();
    hideHandHint();
    setAttackState({ mode: "idle" });
    setMatch(payload);
    if (payload.state.finished) setTimerRemaining(0);
    setArenaMatchId(payload.matchId);
    if (payload.events?.length) {
      showSpellNotice(payload.events);
      applyEvents(payload.events);
    }
  }, [applyEvents, hideBattlefieldHint, hideHandHint, showSpellNotice]);

  const handleMatchUpdatePayload = useCallback((payload: MatchStatePayload) => {
    setMatchError(null);
    hideBattlefieldHint();
    hideHandHint();
    setAttackState({ mode: "idle" });
    setMatch(payload);
    if (payload.state.finished) setTimerRemaining(0);
    if (payload.events?.length) {
      showSpellNotice(payload.events);
      applyEvents(payload.events);
    }
  }, [applyEvents, hideBattlefieldHint, hideHandHint, showSpellNotice]);

  const handleMatchErrorPayload = useCallback((payload: MatchErrorPayload) => {
    hideBattlefieldHint();
    setMatchError(mapMatchErrorMessage(payload.type, payload.message));
    if (payload.type === "STATE_OUTDATED") syncMatch();
  }, [hideBattlefieldHint]);

  const handleMatchFinishPayload = useCallback((payload: MatchFinishPayload) => {
    setFinishReason(payload.reason ?? null);
    setWinnerId(payload.winnerId ?? null);
    setTimerRemaining(0);
    setSelectedCardId(null);
    hideHandHint();
    setAttackState({ mode: "idle" });
    hideBattlefieldHint();
    setMatch((prev) => (prev ? { ...prev, state: { ...prev.state, finished: true } } : prev));

    setFinishGameMode(payload.gameMode ?? null);
    const myRatingChange =
      userIdStr && payload.ratingChanges != null && payload.ratingChanges[userIdStr] !== undefined
        ? payload.ratingChanges[userIdStr]
        : null;
    setRatingChange(myRatingChange);

    if (payload.reason === "opponent_left") {
      setMatchError(payload.message ?? "Opponent cowardly left the arena");
    }
  }, [hideBattlefieldHint, hideHandHint, userIdStr]);

  const handleMatchTimerPayload = useCallback((payload: MatchTimerPayload) => {
    setTimerRemaining(payload.remaining);
  }, []);

  const resetJoinState = useCallback(() => {
    resetBoard();
    setMatchError(null);
    hideBattlefieldHint();
    hideHandHint();
  }, [hideBattlefieldHint, hideHandHint, resetBoard]);

  useGameMatchSession({
    arenaId,
    token,
    userIdStr,
    arenaMatchId,
    currentMatchId: match?.matchId ?? null,
    isSameUser,
    setArenaMatchId,
    setOpponentNickname,
    onSetReconnecting: setIsReconnecting,
    onResetJoinState: resetJoinState,
    onMatchStatePayload: handleMatchStatePayload,
    onMatchUpdatePayload: handleMatchUpdatePayload,
    onMatchErrorPayload: handleMatchErrorPayload,
    onMatchFinishPayload: handleMatchFinishPayload,
    onMatchTimerPayload: handleMatchTimerPayload,
  });


  // ── Derived state ─────────────────────────────────────────────────────────────

  const {
    playerHPPercent,
    opponentHPPercent,
    currentEnergy,
    isMyTurn,
    selfIndex,
    selfStats,
    oppStats,
    handCards,
    selfDeckCount,
    selfDiscardCount,
    matchResultLabel,
    isMatchFinished,
    boardNotice,
    isBoardNoticeFading,
    boardNoticeTone,
    playedCardIdsThisTurn,
    triadComboInfo,
  } = useGameViewModel({
    match,
    userIdStr,
    finishReason,
    winnerId,
    spellNotice,
    spellNoticeFading,
    battlefieldHint,
    battlefieldHintFading,
    handHint,
    handHintFading,
    playedCards,
    cardCatalog,
    isSameUser,
  });

  // ── Card play ─────────────────────────────────────────────────────────────────

  const getCardDisabledReason = (card: CardModel): string | null => {
    if (!match || !userIdStr) return "Match is not ready";
    if (selfIndex < 0) return "You are not part of this match";
    if (match.state.finished) return "Match already finished";
    if (!isMyTurn) return "Wait for your turn";
    if (card.type === "UNIT" && (selfStats.board?.length ?? 0) >= MAX_BOARD_UNITS) {
      return "Board is full";
    }
    if (playedCardIdsThisTurn.size >= 3) return "Card limit reached (3 cards per turn)";
    if (playedCardIdsThisTurn.has(card.id.split(":")[0])) return "Card already played this turn";
    if (currentEnergy < card.mana_cost) return "Not enough energy";
    const statuses = selfStats.statuses || [];
    if (statuses.some((status) => status?.type === "stun")) return "You are stunned";
    return null;
  };

  const canPlayCard = (card: CardModel): boolean => getCardDisabledReason(card) === null;

  const spawnCardFlyEffect = useCallback((card: CardModel) => {
    const fromElement = handCardElementsRef.current[card.id];
    const toElement = card.type === "UNIT" ? selfUnitsZoneRef.current : selfPlayedZoneRef.current;

    if (!fromElement || !toElement) return;

    const playedCardId = card.id.split(":")[0];
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();

    setPendingPlayedCardIds((prev) =>
      prev.includes(playedCardId) ? prev : [...prev, playedCardId]
    );
    setBattleEffects((prev) => [
      ...prev,
      {
        id: `fly-${Date.now()}-${card.id}`,
        type: "card_fly",
        playedCardId,
        card,
        from: {
          left: fromRect.left,
          top: fromRect.top,
          width: fromRect.width,
          height: fromRect.height,
        },
        to: {
          left: toRect.left + 16,
          top: toRect.top + 16,
          width: fromRect.width * 0.8,
          height: fromRect.height * 0.8,
        },
      },
    ]);
  }, []);

  const spawnSpellBurstEffect = useCallback((
    triadType: CardModel["triad_type"],
    targetRect?: DOMRect | null
  ) => {
    if (!targetRect) return;

    setBattleEffects((prev) => [
      ...prev,
      {
        id: `burst-${Date.now()}-${triadType}`,
        type: "spell_burst",
        triadType,
        target: {
          left: targetRect.left,
          top: targetRect.top,
          width: targetRect.width,
          height: targetRect.height,
        },
      } satisfies SpellBurstEffect,
    ]);
  }, []);

  const spawnHitTextEffect = useCallback((
    text: string,
    targetRect?: DOMRect | null,
    tone: HitTextEffect["tone"] = "damage"
  ) => {
    if (!targetRect) return;

    setBattleEffects((prev) => [
      ...prev,
      {
        id: `hit-text-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "hit_text",
        text,
        tone,
        target: {
          left: targetRect.left,
          top: targetRect.top,
          width: targetRect.width,
          height: targetRect.height,
        },
      } satisfies HitTextEffect,
    ]);
  }, []);

  const triggerEnemyHeroShake = useCallback(() => {
    setEnemyHeroShakeToken((prev) => prev + 1);
  }, []);

  const triggerEnemyHeroFlash = useCallback(() => {
    setEnemyHeroFlashToken((prev) => prev + 1);
  }, []);

  const triggerEnemyUnitShake = useCallback((unitId: string) => {
    setEnemyUnitShake((prev) => ({
      id: unitId,
      token: prev.token + 1,
    }));
  }, []);

  const triggerEnemyUnitFlash = useCallback((unitId: string) => {
    setEnemyUnitFlash((prev) => ({
      id: unitId,
      token: prev.token + 1,
    }));
  }, []);

  const handleCardClick = (card: CardModel) => {
    // Clicking the already-selected spell card cancels targeting mode.
    if (attackState.mode === "selectingSpellTarget" && attackState.spellCardId === card.id) {
      setAttackState({ mode: "idle" });
      setSelectedCardId(null);
      hideBattlefieldHint();
      hideHandHint();
      return;
    }

    setAttackState({ mode: "idle" });
    hideBattlefieldHint();
    hideHandHint();
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));
    const reason = getCardDisabledReason(card);
    showHandHint(reason);
    if (reason || !match) return;

    const originalCardId = card.id.split(":")[0];
    const actionId = `${Date.now()}-${originalCardId}-${Math.random().toString(36).slice(2)}`;

    if (card.type === "SPELL") {
      setAttackState({ mode: "selectingSpellTarget", spellCardId: card.id, originalCardId, actionId });
      showBattlefieldHint("Select a target: enemy unit or enemy hero");
      return;
    }

    spawnCardFlyEffect(card);
    playMatchCard({ matchId: match.matchId, cardId: originalCardId, actionId, version: match.state.version });
  };

  // ── Attack flow ───────────────────────────────────────────────────────────────

  const handleMyUnitClick = useCallback((unit: UnitInstance) => {
    if (!isMyTurn || !match) return;

    // Clicking any own unit while selecting a spell target cancels spell mode.
    if (attackState.mode === "selectingSpellTarget") {
      setAttackState({ mode: "idle" });
      setSelectedCardId(null);
      hideBattlefieldHint();
      hideHandHint();
      return;
    }

    if (attackState.mode === "selectingTarget" && attackState.attackerInstanceId === unit.instanceId) {
      setAttackState({ mode: "idle" });
      hideBattlefieldHint();
      hideHandHint();
      return;
    }

    if (!unit.canAttack) {
      showBattlefieldHint("This unit cannot attack yet");
      return;
    }

    setSelectedCardId(null);
    hideBattlefieldHint();
    hideHandHint();
    setAttackState({ mode: "selectingTarget", attackerInstanceId: unit.instanceId });
  }, [attackState, hideBattlefieldHint, hideHandHint, isMyTurn, match, showBattlefieldHint]);

  const handleEnemyUnitClick = useCallback((unit: UnitInstance, targetRect?: DOMRect) => {
    if (!match) return;

    if (attackState.mode === "selectingSpellTarget") {
      const spellCard = handCards.find((card) => card.id === attackState.spellCardId);
      if (spellCard) {
        triggerEnemyUnitShake(unit.instanceId);
        triggerEnemyUnitFlash(unit.instanceId);
        spawnCardFlyEffect(spellCard);
        window.setTimeout(() => {
          const baseDamage = Math.max(0, Number(spellCard.attack) || 0);
          spawnHitTextEffect(baseDamage > 0 ? `-${baseDamage}` : "Hit", targetRect, spellCard.triad_type.toLowerCase() as HitTextEffect["tone"]);
        }, SPELL_UNIT_BURST_DELAY_MS - 20);
        window.setTimeout(() => {
          spawnSpellBurstEffect(
            spellCard.triad_type,
            targetRect
          );
        }, SPELL_UNIT_BURST_DELAY_MS);
      }
      window.setTimeout(() => {
        playMatchCard({
          matchId: match.matchId,
          cardId: attackState.originalCardId,
          actionId: attackState.actionId,
          version: match.state.version,
          targetType: "unit",
          targetId: unit.instanceId
        });
      }, SPELL_VISUAL_LEAD_MS);
      setAttackState({ mode: "idle" });
      hideBattlefieldHint();
      hideHandHint();
      setSelectedCardId(null);
      setMatchError(null);
      return;
    }

    if (attackState.mode !== "selectingTarget") return;

    const actionId = `atk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    triggerEnemyUnitFlash(unit.instanceId);
    const attackerDamage = Math.max(
      0,
      Number(selfStats.board.find((entry) => entry.instanceId === attackState.attackerInstanceId)?.attack) || 0
    );
    spawnHitTextEffect(`-${attackerDamage}`, targetRect);
    attackWithUnit({
      matchId: match.matchId,
      unitId: attackState.attackerInstanceId,
      targetType: "unit",
      targetId: unit.instanceId,
      actionId,
      version: match.state.version
    });
    setAttackState({ mode: "idle" });
    hideBattlefieldHint();
    hideHandHint();
    setSelectedCardId(null);
    setMatchError(null);
  }, [attackState, handCards, hideBattlefieldHint, hideHandHint, match, selfStats.board, spawnCardFlyEffect, spawnHitTextEffect, spawnSpellBurstEffect, triggerEnemyUnitFlash, triggerEnemyUnitShake]);

  const handleEnemyHeroClick = useCallback(() => {
    if (!match) return;

    const enemyHeroId = match.players.find((id) => !isSameUser(id));

    if (attackState.mode === "selectingSpellTarget") {
      if (!enemyHeroId) {
        setMatchError("Enemy hero target not found");
        return;
      }
      const spellCard = handCards.find((card) => card.id === attackState.spellCardId);
      if (spellCard) {
        triggerEnemyHeroShake();
        triggerEnemyHeroFlash();
        spawnCardFlyEffect(spellCard);
        const targetRect = enemyHeroRef.current?.getBoundingClientRect() ?? null;
        window.setTimeout(() => {
          const baseDamage = Math.max(0, Number(spellCard.attack) || 0);
          spawnHitTextEffect(baseDamage > 0 ? `-${baseDamage}` : "Hit", targetRect, spellCard.triad_type.toLowerCase() as HitTextEffect["tone"]);
        }, SPELL_HERO_BURST_DELAY_MS - 40);
        window.setTimeout(() => {
          spawnSpellBurstEffect(spellCard.triad_type, targetRect);
        }, SPELL_HERO_BURST_DELAY_MS);
      }
      window.setTimeout(() => {
        playMatchCard({
          matchId: match.matchId,
          cardId: attackState.originalCardId,
          actionId: attackState.actionId,
          version: match.state.version,
          targetType: "hero",
          targetId: enemyHeroId
        });
      }, SPELL_VISUAL_LEAD_MS);
      setAttackState({ mode: "idle" });
      hideBattlefieldHint();
      hideHandHint();
      setSelectedCardId(null);
      setMatchError(null);
      return;
    }

    if (attackState.mode !== "selectingTarget") return;

    if (!enemyHeroId) {
      setMatchError("Enemy hero target not found");
      return;
    }

    const actionId = `atk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    triggerEnemyHeroFlash();
    const targetRect = enemyHeroRef.current?.getBoundingClientRect() ?? null;
    spawnHitTextEffect(`-${Math.max(0, Number(selfStats.board.find((entry) => entry.instanceId === attackState.attackerInstanceId)?.attack) || 0)}`, targetRect);
    attackWithUnit({
      matchId: match.matchId,
      unitId: attackState.attackerInstanceId,
      targetType: "hero",
      targetId: enemyHeroId,
      actionId,
      version: match.state.version
    });
    setAttackState({ mode: "idle" });
    hideBattlefieldHint();
    hideHandHint();
    setSelectedCardId(null);
    setMatchError(null);
  }, [attackState, handCards, hideBattlefieldHint, hideHandHint, isSameUser, match, selfStats.board, spawnCardFlyEffect, spawnHitTextEffect, spawnSpellBurstEffect, triggerEnemyHeroFlash, triggerEnemyHeroShake]);

  // ── Turn / leave ──────────────────────────────────────────────────────────────

  const handleEndTurnClick = () => {
    setSelectedCardId(null);
    hideHandHint();
    setAttackState({ mode: "idle" });
    hideBattlefieldHint();
    if (!match || !userIdStr) return;
    if (match.state.finished || !isSameUser(match.state.activePlayer)) return;
    endMatchTurn({ matchId: match.matchId, version: match.state.version });
  };

  const handleLeaveArenaClick = () => {
    const leavingMatchId = match?.matchId || arenaMatchId;
    if (leavingMatchId) leaveMatch(leavingMatchId);
    if (arenaId && arenaId !== "unknown") socket.emit("leave_game", arenaId);
    setMatch(null);
    setWinnerId(null);
    setFinishReason(null);
    setAttackState({ mode: "idle" });
    hideBattlefieldHint();
    hideHandHint();
    resetBoard();
    navigate("/lobby");
  };

  // ── Board rendering helpers ───────────────────────────────────────────────────

  const isSelectingTarget = attackState.mode === "selectingTarget";
  const isSelectingSpellTarget = attackState.mode === "selectingSpellTarget";
  const isAnyTargetingMode = isSelectingTarget || isSelectingSpellTarget;
  const selectedAttackerId = isSelectingTarget ? attackState.attackerInstanceId : null;
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);


  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="game-screen">
      <div className="game-screen__bg" />
      <div className="game-screen__texture parchment-texture" />
      <div className="game-screen__vignette darkest-vignette" />

      {/* Opponent header */}
      <header className="game-hud game-hud--top parchment-panel">
        <div className="game-hud__identity">
          <div className="game-hud__accent game-hud__accent--blood" />
          <div>
            <p className="game-hud__name comic-text-shadow">{opponentNickname}</p>
            <p className="game-hud__rank">Rank IV - Cultist</p>
          </div>
        </div>

        <div className="game-hp">
          <div className="game-hp__meta">
            <span>Death&apos;s Door</span>
            <strong className="comic-text-shadow">
              {Math.round(opponentHPPercent)}% | HP {oppStats.hp} | SH {oppStats.shield}
            </strong>
          </div>
          <div className="game-hp__track ink-border-thin">
            <div
              className="game-hp__fill game-hp__fill--enemy blood-glow"
              style={{ width: `${opponentHPPercent}%` }}
            />
          </div>
        </div>

        <div
          className={`game-state${isAnyTargetingMode ? " game-state--attackable" : ""}`}
          ref={enemyHeroRef}
          onClick={handleEnemyHeroClick}
          title={isSelectingSpellTarget ? "Cast spell on enemy hero" : isSelectingTarget ? "Attack enemy hero" : undefined}
          style={{ cursor: isAnyTargetingMode ? "crosshair" : undefined }}
        >
          <motion.div
            key={`enemy-hero-shake-${enemyHeroShakeToken}`}
            initial={{ x: 0 }}
            animate={enemyHeroShakeToken > 0 ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="game-state__content"
          >
            {enemyHeroFlashToken > 0 && (
              <motion.span
                key={`enemy-hero-flash-${enemyHeroFlashToken}`}
                className="game-state__hit-flash"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: [0, 0.9, 0], scale: [0.94, 1.04, 1] }}
                transition={{ duration: 0.34, ease: "easeOut" }}
              />
            )}
            <p className="game-state__label">Opponent Status</p>
            <p className="game-state__value">
              {(oppStats.statuses || []).length
                ? renderStatuses(oppStats.statuses)
                : isSelectingSpellTarget ? "\u2190 Click to target hero"
                : isSelectingTarget ? "\u2190 Click to attack hero"
                : "None"}
            </p>
          </motion.div>
        </div>
      </header>

      {isReconnecting && (
        <div className="game-state">
          <p className="game-state__label">Connection</p>
          <p className="game-state__value">Reconnecting...</p>
        </div>
      )}

      {match && selfIndex < 0 && (
        <div className="game-state">
          <p className="game-state__label">Access</p>
          <p className="game-state__value">You are not part of this match</p>
        </div>
      )}

      <section className="game-content">
        <div className="game-top-row">
          <aside className="game-deck-panel">
            <p className="game-log__entry">Deck: {selfDeckCount}</p>
            <p className="game-log__entry">Discard: {selfDiscardCount}</p>
            <p className="game-log__entry">Hand: {handCards.length}</p>
            
            {triadComboInfo && (
              <div className={`game-triad-combo game-triad-combo--${triadComboInfo.type}`}>
                <span className="game-triad-combo__label">Triad Combo</span>
                <span className="game-triad-combo__type">
                  {triadComboInfo.type.toUpperCase()} \u00D7{triadComboInfo.count}
                </span>
                <span className="game-triad-combo__bonus">+{triadComboInfo.bonus} DMG</span>
              </div>
            )}
          </aside>

          <div className="game-state game-state--turn">
            <div className="game-state__turn-row">
              {match ? (isMyTurn ?
                <p className="game-hud__name game-state__value--active-turn comic-text-shadow">Your turn</p> :
                <p className="game-hud__name game-state__value comic-text-shadow">Opponent's turn</p>) : "-"}
            </div>
            {match && !match.state.finished ? (isMyTurn ?
              <p className="game-hud__name game-state__value--active-turn comic-text-shadow">
                <TurnCountdown remaining={timerRemaining} />
              </p> :
              <p className="game-hud__name game-state__value comic-text-shadow">
                <TurnCountdown remaining={timerRemaining} />
              </p>) : null}
          </div>

          <div className="game-state game-state--right">
            <button type="button" className="game-end-turn stress-warning" onClick={() => setIsLeaveConfirmOpen(true)}>
              Leave Arena
            </button>
          </div>
        </div>


        {matchError && (
          <div className="game-attack-banner game-attack-banner--error">
            <span>{matchError}</span>
          </div>
        )}

        <main className="game-battlefield">
          <MatchBoard
            cards={playedCards}
            currentUserId={userIdStr}
            enemyHint={isAnyTargetingMode ? (
              <div className="battlefield-target-overlay">
                <span className="game-state__target-hint">
                  {isSelectingSpellTarget ? "Select a spell target" : "Select a target unit"}
                </span>
              </div>
            ) : null}
            enemyTargeting={isAnyTargetingMode}
            spellNotice={boardNotice}
            spellNoticeFading={isBoardNoticeFading}
            spellNoticeTone={boardNoticeTone}
            hiddenSelfCardIds={pendingPlayedCardIds}
            selfPlayedRef={(element) => {
              selfUnitsZoneRef.current = element;
              selfPlayedZoneRef.current = element;
            }}
            selfUnits={
              selfStats.board.length > 0
                ? (
                  <div className="battlefield-units-wrap">
                    <AnimatePresence initial={false}>
                      {selfStats.board.map((unit, index) => (
                        <BattlefieldUnitCard
                          key={unit.instanceId}
                          unit={unit}
                          enterIndex={index}
                          isOwn
                          isMyTurn={isMyTurn}
                          isAnyTargetingMode={isAnyTargetingMode}
                          selectedAttackerId={selectedAttackerId}
                          shakeToken={0}
                          cardCatalog={cardCatalog}
                          onOwnUnitClick={handleMyUnitClick}
                          onEnemyUnitClick={handleEnemyUnitClick}
                          renderStatuses={renderStatuses}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )
                : <span className="battlefield-empty">No units</span>
            }
            enemyUnits={
              oppStats.board.length > 0
                ? (
                  <div className="battlefield-units-wrap">
                    <AnimatePresence initial={false}>
                      {oppStats.board.map((unit, index) => (
                        <BattlefieldUnitCard
                          key={unit.instanceId}
                          unit={unit}
                          enterIndex={index}
                          isOwn={false}
                          isMyTurn={isMyTurn}
                          isAnyTargetingMode={isAnyTargetingMode}
                          selectedAttackerId={selectedAttackerId}
                          shakeToken={enemyUnitShake.id === unit.instanceId ? enemyUnitShake.token : 0}
                          flashToken={enemyUnitFlash.id === unit.instanceId ? enemyUnitFlash.token : 0}
                          cardCatalog={cardCatalog}
                          onOwnUnitClick={handleMyUnitClick}
                          onEnemyUnitClick={handleEnemyUnitClick}
                          onMount={(unitId, element) => {
                            enemyUnitElementsRef.current[unitId] = element;
                          }}
                          renderStatuses={renderStatuses}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )
                : <span className="battlefield-empty">No units</span>
            }
          />
        </main>

        <HandCards
          handCards={handCards}
          selectedCardId={selectedCardId}
          canPlayCard={canPlayCard}
          onCardClick={handleCardClick}
          onCardMount={(cardId, element) => {
            handCardElementsRef.current[cardId] = element;
          }}
          cardSize={isMobileView ? "small" : "normal"}
        />
      </section>

      {isMatchFinished && (
        <div className="game-overlay game-overlay--finish">
          <div className="game-overlay__panel parchment-panel">
            <span className="comic-text-shadow">{matchResultLabel ?? "Match finished"}</span>
            {finishReason === "disconnect" && (
              <p style={{ marginTop: 8, textAlign: "center" }}>Opponent disconnected</p>
            )}
            {finishReason === "opponent_left" && (
              <p style={{ marginTop: 8, textAlign: "center" }}>Opponent fled the arena</p>
            )}
            {finishGameMode === "ranked" && ratingChange !== null && (
              <p
                className="comic-text-shadow"
                style={{
                  marginTop: 10,
                  textAlign: "center",
                  fontSize: "1.3rem",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  color: ratingChange >= 0 ? "#6cca86" : "#c85040"
                }}
              >
                {ratingChange >= 0 ? `+${ratingChange}` : ratingChange} Rating
              </p>
            )}
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <button type="button" className="game-end-turn stress-warning" onClick={handleLeaveArenaClick}>
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      <LeaveArenaConfirmModal
        open={isLeaveConfirmOpen}
        onCancel={() => setIsLeaveConfirmOpen(false)}
        onConfirm={() => {
          setIsLeaveConfirmOpen(false);
          handleLeaveArenaClick();
        }}
      />

      <footer className="game-hud game-hud--bottom parchment-panel">
        <div className="game-hud__identity">
          <div className="game-hud__accent game-hud__accent--gold" />
          <div>
            <p className="game-hud__name comic-text-shadow">{displayName}</p>
            <p className="game-hud__rank">Crusader - Level 12</p>
          </div>
        </div>

        <div className="game-hp">
          <div className="game-hp__meta">
            <span>Death&apos;s Door</span>
            <strong className="comic-text-shadow">
              {Math.round(playerHPPercent)}% | HP {selfStats.hp} | SH {selfStats.shield} | EN {currentEnergy}
            </strong>
          </div>
          <div className="game-hp__track ink-border-thin">
            <div className="game-hp__fill game-hp__fill--player" style={{ width: `${playerHPPercent}%` }} />
          </div>
        </div>

        <div className="game-actions">
          <div className="game-state">
            <p className="game-state__label">Your Status</p>
            <p className="game-state__value">
              {renderStatuses(selfStats.statuses)}
            </p>
          </div>
          <div className="game-energy" aria-label="Resolve">
            {Array.from({ length: 10 }).map((_, index) => (
              <span key={index} className={`game-energy__pip ${index < currentEnergy ? "is-active" : ""}`} />
            ))}
          </div>
          <button
            type="button"
            className="game-end-turn stress-warning"
            onClick={handleEndTurnClick}
            disabled={!isMyTurn || !match || match.state.finished}
          >
            End Turn
          </button>
        </div>
      </footer>

      <BattleEffectsLayer
        effects={battleEffects}
        onComplete={(effect) => {
          setBattleEffects((prev) => prev.filter((entry) => entry.id !== effect.id));
          if (effect.type === "card_fly") {
            setPendingPlayedCardIds((prev) => prev.filter((cardId) => cardId !== effect.playedCardId));
          }
        }}
      />
    </div>
  );
}



