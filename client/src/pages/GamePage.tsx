import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppSelector } from "../store";
import { GameCard, type CardModel } from "../components/Card";
import HandCards from "../components/HandCards";
import socket from "../shared/socket/socket";
import {
  attackWithUnit,
  endMatchTurn,
  joinMatch,
  leaveMatch,
  offMatchError,
  offMatchFinish,
  offMatchState,
  offMatchTimer,
  offMatchUpdate,
  onMatchError,
  onMatchFinish,
  onMatchState,
  onMatchTimer,
  onMatchUpdate,
  playMatchCard,
  syncMatch,
  type MatchErrorPayload,
  type MatchFinishPayload,
  type MatchStatePayload,
  type MatchTimerPayload,
  type UnitInstance
} from "../shared/socket/matchSocket";
import { useMatchBoard } from "../features/customHooks/useMatchBoard";
import "./GamePage.css";
import TurnCountdown from "../components/TurnCountdown";
import LeaveArenaConfirmModal from "../components/LeaveArenaConfirmModal";
import MatchBoard from "../components/MatchBoard";


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

// ─── Component ────────────────────────────────────────────────────────────────

export default function GamePage() {
  const navigate = useNavigate();
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
  const [battlefieldHint, setBattlefieldHint] = useState<string | null>(null);
  const [battlefieldHintFading, setBattlefieldHintFading] = useState(false);
  const [handHint, setHandHint] = useState<string | null>(null);
  const [handHintFading, setHandHintFading] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [finishReason, setFinishReason] = useState<string | null>(null);
  const [ratingChange, setRatingChange] = useState<number | null>(null);
  const [finishGameMode, setFinishGameMode] = useState<string | null>(null);
  const [attackState, setAttackState] = useState<AttackState>({ mode: "idle" });
  const [timerRemaining, setTimerRemaining] = useState(45);
  const [spellNotice, setSpellNotice] = useState<string | null>(null);
  const [spellNoticeFading, setSpellNoticeFading] = useState(false);

  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);
  const joinedMatchRef = useRef<string | null>(null);
  const spellNoticeFadeTimeoutRef = useRef<number | null>(null);
  const spellNoticeHideTimeoutRef = useRef<number | null>(null);
  const battlefieldHintFadeTimeoutRef = useRef<number | null>(null);
  const battlefieldHintHideTimeoutRef = useRef<number | null>(null);
  const handHintFadeTimeoutRef = useRef<number | null>(null);
  const handHintHideTimeoutRef = useRef<number | null>(null);
  const lastSpellNoticeEventIdRef = useRef<number | null>(null);
  const { playedCards, cardCatalog, applyEvents, resetBoard } = useMatchBoard();

  const isSameUser = useCallback((value: string | number | null | undefined) =>
    String(value ?? "").trim().toLowerCase() === String(userIdStr ?? "").trim().toLowerCase(), [userIdStr]);

  const formatStatusLabel = (status: StatusView): string => {
    const type = String(status?.type || "unknown").toUpperCase();
    const hasTurns = Number.isFinite(status?.turns);
    const hasAmount = Number.isFinite(status?.amount);

    if (type === "SHIELD" && hasAmount && hasTurns) return `${type} +${status.amount} • ${status.turns}t`;
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
    setSpellNotice(`${ownerLabel} spell resolved: ${latestSpellEvent.payload.card.name}`);
    setSpellNoticeFading(false);

    if (spellNoticeFadeTimeoutRef.current) {
      window.clearTimeout(spellNoticeFadeTimeoutRef.current);
    }
    if (spellNoticeHideTimeoutRef.current) {
      window.clearTimeout(spellNoticeHideTimeoutRef.current);
    }

    spellNoticeFadeTimeoutRef.current = window.setTimeout(() => {
      setSpellNoticeFading(true);
      spellNoticeFadeTimeoutRef.current = null;
    }, 2000);

    spellNoticeHideTimeoutRef.current = window.setTimeout(() => {
      setSpellNotice(null);
      setSpellNoticeFading(false);
      spellNoticeHideTimeoutRef.current = null;
    }, 5000);
  }, [isSameUser]);

  const clearHandHintTimers = useCallback(() => {
    if (handHintFadeTimeoutRef.current) {
      window.clearTimeout(handHintFadeTimeoutRef.current);
      handHintFadeTimeoutRef.current = null;
    }
    if (handHintHideTimeoutRef.current) {
      window.clearTimeout(handHintHideTimeoutRef.current);
      handHintHideTimeoutRef.current = null;
    }
  }, []);

  const hideHandHint = useCallback(() => {
    clearHandHintTimers();
    setHandHint(null);
    setHandHintFading(false);
  }, [clearHandHintTimers]);

  const showHandHint = useCallback((message: string | null) => {
    hideHandHint();
    if (!message) return;
    setHandHint(message);
    setHandHintFading(false);
    handHintFadeTimeoutRef.current = window.setTimeout(() => {
      setHandHintFading(true);
      handHintFadeTimeoutRef.current = null;
    }, 2000);
    handHintHideTimeoutRef.current = window.setTimeout(() => {
      setHandHint(null);
      setHandHintFading(false);
      handHintHideTimeoutRef.current = null;
    }, 5000);
  }, [hideHandHint]);

  const clearBattlefieldHintTimers = useCallback(() => {
    if (battlefieldHintFadeTimeoutRef.current) {
      window.clearTimeout(battlefieldHintFadeTimeoutRef.current);
      battlefieldHintFadeTimeoutRef.current = null;
    }
    if (battlefieldHintHideTimeoutRef.current) {
      window.clearTimeout(battlefieldHintHideTimeoutRef.current);
      battlefieldHintHideTimeoutRef.current = null;
    }
  }, []);

  const hideBattlefieldHint = useCallback(() => {
    clearBattlefieldHintTimers();
    setBattlefieldHint(null);
    setBattlefieldHintFading(false);
  }, [clearBattlefieldHintTimers]);

  const showBattlefieldHint = useCallback((message: string | null) => {
    hideBattlefieldHint();
    if (!message) return;
    setBattlefieldHint(message);
    setBattlefieldHintFading(false);
    battlefieldHintFadeTimeoutRef.current = window.setTimeout(() => {
      setBattlefieldHintFading(true);
      battlefieldHintFadeTimeoutRef.current = null;
    }, 2000);
    battlefieldHintHideTimeoutRef.current = window.setTimeout(() => {
      setBattlefieldHint(null);
      setBattlefieldHintFading(false);
      battlefieldHintHideTimeoutRef.current = null;
    }, 5000);
  }, [hideBattlefieldHint]);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (spellNoticeFadeTimeoutRef.current) {
        window.clearTimeout(spellNoticeFadeTimeoutRef.current);
      }
      if (spellNoticeHideTimeoutRef.current) {
        window.clearTimeout(spellNoticeHideTimeoutRef.current);
      }
      if (battlefieldHintFadeTimeoutRef.current) {
        window.clearTimeout(battlefieldHintFadeTimeoutRef.current);
      }
      if (battlefieldHintHideTimeoutRef.current) {
        window.clearTimeout(battlefieldHintHideTimeoutRef.current);
      }
      if (handHintFadeTimeoutRef.current) {
        window.clearTimeout(handHintFadeTimeoutRef.current);
      }
      if (handHintHideTimeoutRef.current) {
        window.clearTimeout(handHintHideTimeoutRef.current);
      }
    };
  }, []);

  // ── URL params sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fromQueryOpponent = searchParams.get("opponent");
    const fromQueryMatchId = searchParams.get("matchId");
    if (fromQueryOpponent) setOpponentNickname(fromQueryOpponent);
    if (fromQueryMatchId) setArenaMatchId(fromQueryMatchId);
  }, [searchParams]);

  // ── Arena socket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!arenaId || arenaId === "unknown") return;
    if (!token) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();
    socket.emit("join_game", arenaId);

    const updateOpponentFromPlayers = (
      players?: Array<{ userId?: string | number; nickname?: string }>
    ) => {
      if (!Array.isArray(players)) return;
      const opponent = players.find((player) => !isSameUser(player?.userId));
      setOpponentNickname(opponent?.nickname || "UNKNOWN");
    };

    const requestArenaState = () => {
      socket.emit(
        "arena:get-state",
        { arenaId },
        (res?: { matchId?: string; players?: Array<{ userId?: string | number; nickname?: string }> }) => {
          updateOpponentFromPlayers(res?.players);
          if (res?.matchId) setArenaMatchId(res.matchId);
        }
      );
    };

    requestArenaState();

    const onArenaReady = (
      payload?: { arenaId?: string; matchId?: string; players?: Array<{ userId?: string | number; nickname?: string }> }
    ) => {
      if (!payload?.arenaId || payload.arenaId !== arenaId) return;
      updateOpponentFromPlayers(payload.players);
      if (payload.matchId) setArenaMatchId(payload.matchId);
    };

    const onConnect = () => {
      socket.emit("join_game", arenaId);
      requestArenaState();
    };

    const pollId = window.setInterval(() => {
      if (!arenaMatchId) {
        requestArenaState();
      }
    }, 1500);

    socket.on("connect", onConnect);
    socket.on("arena:ready", onArenaReady);
    return () => {
      window.clearInterval(pollId);
      socket.off("connect", onConnect);
      socket.off("arena:ready", onArenaReady);
    };
  }, [arenaId, token, userIdStr, arenaMatchId]);

  // ── Match socket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !userIdStr) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();

    const onConnect = () => {
      setIsReconnecting(false);
      syncMatch();
    };
    const onDisconnect = () => {
      setIsReconnecting(true);
    };

    const handleState = (payload: MatchStatePayload) => {
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
    };

    const handleUpdate = (payload: MatchStatePayload) => {
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
    };

    const handleError = (payload: MatchErrorPayload) => {
      hideBattlefieldHint();
      setMatchError(mapMatchErrorMessage(payload.type, payload.message));
      if (payload.type === "STATE_OUTDATED") syncMatch();
    };

    const handleFinish = (payload: MatchFinishPayload) => {
      setFinishReason(payload.reason ?? null);
      setWinnerId(payload.winnerId ?? null);
      setFinishGameMode(payload.gameMode ?? null);
      setTimerRemaining(0);
      setSelectedCardId(null);
      hideHandHint();
      setAttackState({ mode: "idle" });
      hideBattlefieldHint();
      setMatch((prev) => (prev ? { ...prev, state: { ...prev.state, finished: true } } : prev));

      if (payload.ratingChanges && userIdStr && payload.ratingChanges[userIdStr] !== undefined) {
        setRatingChange(payload.ratingChanges[userIdStr]);
      }

      if (payload.reason === "opponent_left") {
        const cowardMessage = "Opponent cowardly left the arena";
        setMatchError(cowardMessage);
        return;
      }
    };

    const handleTimer = (payload: MatchTimerPayload) => {
      setTimerRemaining(payload.remaining);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    onMatchState(handleState);
    onMatchUpdate(handleUpdate);
    onMatchError(handleError);
    onMatchFinish(handleFinish);
    onMatchTimer(handleTimer);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      offMatchState(handleState);
      offMatchUpdate(handleUpdate);
      offMatchError(handleError);
      offMatchFinish(handleFinish);
      offMatchTimer(handleTimer);
    };
  }, [applyEvents, hideBattlefieldHint, hideHandHint, showSpellNotice, token, userIdStr]);

  // ── Join match ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!arenaMatchId || !token || !userIdStr) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();

    if (joinedMatchRef.current !== arenaMatchId) {
      resetBoard();
      joinedMatchRef.current = arenaMatchId;
      setMatchError(null);
      hideBattlefieldHint();
      hideHandHint();
    }

    if (match?.matchId !== arenaMatchId) joinMatch(arenaMatchId);

    const retryId = window.setTimeout(() => {
      if (match?.matchId !== arenaMatchId) {
        syncMatch();
        joinMatch(arenaMatchId);
      }
    }, 1200);

    return () => { window.clearTimeout(retryId); };
  }, [arenaMatchId, hideBattlefieldHint, hideHandHint, resetBoard, token, userIdStr, match?.matchId]);

  // ── Derived state ─────────────────────────────────────────────────────────────

  const {
    playerHPPercent, opponentHPPercent, currentEnergy, isMyTurn,
    selfIndex, selfStats, oppStats, selfKey, oppKey
  } = useMemo(() => {
    const defaultResult = {
      playerHPPercent: 100, opponentHPPercent: 100, currentEnergy: 0,
      isMyTurn: false, selfIndex: -1, selfKey: "player1" as "player1" | "player2",
      oppKey: "player2" as "player1" | "player2",
      selfStats: { hp: 0, shield: 0, energy: 0, statuses: [] as Array<{ type: string }>, board: [] as UnitInstance[] },
      oppStats: { hp: 0, shield: 0, energy: 0, statuses: [] as Array<{ type: string }>, board: [] as UnitInstance[] }
    };

    if (!match || !userIdStr) return defaultResult;

    const idxFromState = (() => {
      const p1Id = match.state.players.player1?.id;
      const p2Id = match.state.players.player2?.id;
      if (isSameUser(p1Id)) return 0;
      if (isSameUser(p2Id)) return 1;
      return -1;
    })();
    const idx = idxFromState >= 0 ? idxFromState : match.players.findIndex((id) => isSameUser(id));
    if (idx < 0) return defaultResult;

    const sk = idx === 0 ? "player1" : "player2" as "player1" | "player2";
    const ok = sk === "player1" ? "player2" : "player1" as "player1" | "player2";

    const self = match.state.players[sk];
    const opp = match.state.players[ok];

    const maxHp = 30;
    const clampPercent = (v: number | null) => v == null ? 0 : Math.max(0, Math.min(100, (v / maxHp) * 100));

    return {
      playerHPPercent: clampPercent(self.hp),
      opponentHPPercent: clampPercent(opp.hp),
      currentEnergy: self.energy ?? 0,
      isMyTurn: isSameUser(match.state.activePlayer) && !match.state.finished,
      selfIndex: idx,
      selfKey: sk,
      oppKey: ok,
      selfStats: { ...self, board: self.board ?? [] },
      oppStats: { ...opp, board: opp.board ?? [] }
    };
  }, [match, userIdStr]);

  const handCards: CardModel[] = useMemo(() => {
    if (!match || !userIdStr || selfIndex < 0) return [];
    const playerHand = match.state.players[selfKey].hand || [];
    return playerHand.map<CardModel>((card, index) => ({
      id: `${card.id}:${index}`,
      name: card.name,
      image: card.image || "crimson_duelist.png",
      type: String(card.type).toUpperCase() as CardModel["type"],
      triad_type: String(card.triad_type).toUpperCase() as CardModel["triad_type"],
      mana_cost: card.mana_cost,
      attack: card.attack,
      hp: card.hp,
      description: card.description,
      created_at: card.created_at
    }));
  }, [match, userIdStr, selfKey, selfIndex]);

  const selfDeckCount = useMemo(() => {
    if (!match || selfIndex < 0) return 0;
    return match.state.players[selfKey].deckCount ?? 0;
  }, [match, selfKey, selfIndex]);

  const selfDiscardCount = useMemo(() => {
    if (!match || selfIndex < 0) return 0;
    return match.state.players[selfKey].discardCount ?? 0;
  }, [match, selfKey, selfIndex]);

  const matchResultLabel = useMemo(() => {
    if (finishReason === "opponent_left") return "Opponent cowardly left the arena";
    if (!winnerId || !userIdStr) return null;
    return isSameUser(winnerId) ? "Victory" : "Defeat";
  }, [finishReason, winnerId, userIdStr]);

  const isMatchFinished = Boolean(match?.state.finished || finishReason || winnerId);
  const boardNotice = spellNotice ?? battlefieldHint ?? handHint;
  const isBoardNoticeFading = spellNotice
    ? spellNoticeFading
    : battlefieldHint
      ? battlefieldHintFading
      : handHint
        ? handHintFading
        : false;
  const boardNoticeTone = spellNotice ? "default" : "warning";

  const playedCardIdsThisTurn = useMemo(() => {
    if (!match || !userIdStr) return new Set<string>();
    // Exclude attack entries (cardId === null) so the Set only contains actual card plays.
    const ids = match.state.turnActions
      .filter((action) => isSameUser(action.playerId) && action.cardId != null)
      .map((action) => action.cardId as string);
    return new Set(ids);
  }, [match, userIdStr]);

  // Triad combo notice should reflect the last card play that could actually
  // receive the backend combo bonus, not the "best type so far" in the turn.
  const triadComboInfo = useMemo((): { type: string; count: number; bonus: number } | null => {
    if (!match || !userIdStr) return null;

    const myCardActions = match.state.turnActions
      .filter((action) =>
        action.cardId != null &&
        action.triadType != null &&
        action.playerId != null &&
        isSameUser(action.playerId)
      )
      .sort((left, right) => (left.actionIndex ?? 0) - (right.actionIndex ?? 0));

    if (myCardActions.length === 0) return null;

    const latestCardAction = myCardActions[myCardActions.length - 1];
    const latestCardId = String(latestCardAction.cardId ?? "");
    const latestCard =
      cardCatalog[latestCardId] ||
      [...playedCards]
        .reverse()
        .find((entry) => isSameUser(entry.playerId) && entry.card.id === latestCardId)?.card;

    if (!latestCard || latestCard.type !== "SPELL") return null;

    const triadType = String(latestCardAction.triadType || "").toLowerCase();
    const comboCount = myCardActions.filter(
      (action) =>
        (action.actionIndex ?? 0) <= (latestCardAction.actionIndex ?? 0) &&
        String(action.triadType || "").toLowerCase() === triadType
    ).length;

    if (comboCount < 2) return null;
    const bonus = comboCount >= 3 ? 4 : 2;
    return { type: triadType, count: comboCount, bonus };
  }, [cardCatalog, isSameUser, match, playedCards, userIdStr]);

  // ── Card play ─────────────────────────────────────────────────────────────────

  const getCardDisabledReason = (card: CardModel): string | null => {
    if (!match || !userIdStr) return "Match is not ready";
    if (selfIndex < 0) return "You are not part of this match";
    if (match.state.finished) return "Match already finished";
    if (!isMyTurn) return "Wait for your turn";
    if (playedCardIdsThisTurn.size >= 3) return "Card limit reached (3 cards per turn)";
    if (playedCardIdsThisTurn.has(card.id.split(":")[0])) return "Card already played this turn";
    if (currentEnergy < card.mana_cost) return "Not enough energy";
    const statuses = selfStats.statuses || [];
    if (statuses.some((status) => status?.type === "stun")) return "You are stunned";
    return null;
  };

  const canPlayCard = (card: CardModel): boolean => getCardDisabledReason(card) === null;

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

  const handleEnemyUnitClick = useCallback((unit: UnitInstance) => {
    if (!match) return;

    if (attackState.mode === "selectingSpellTarget") {
      playMatchCard({
        matchId: match.matchId,
        cardId: attackState.originalCardId,
        actionId: attackState.actionId,
        version: match.state.version,
        targetType: "unit",
        targetId: unit.instanceId
      });
      setAttackState({ mode: "idle" });
      hideBattlefieldHint();
      hideHandHint();
      setSelectedCardId(null);
      setMatchError(null);
      return;
    }

    if (attackState.mode !== "selectingTarget") return;

    const actionId = `atk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  }, [attackState, hideBattlefieldHint, hideHandHint, match]);

  const handleEnemyHeroClick = useCallback(() => {
    if (!match) return;

    const enemyHeroId = match.players.find((id) => !isSameUser(id));

    if (attackState.mode === "selectingSpellTarget") {
      if (!enemyHeroId) {
        setMatchError("Enemy hero target not found");
        return;
      }
      playMatchCard({
        matchId: match.matchId,
        cardId: attackState.originalCardId,
        actionId: attackState.actionId,
        version: match.state.version,
        targetType: "hero",
        targetId: enemyHeroId
      });
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
  }, [attackState, hideBattlefieldHint, hideHandHint, isSameUser, match]);

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
    joinedMatchRef.current = null;
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

  // Prefer metadata embedded by the server (survives reconnect); fall back to cardCatalog.
  const toBoardCardModel = (unit: UnitInstance): CardModel => {
    const base = cardCatalog[unit.cardId];
    return {
      id: unit.cardId,
      name: unit.name || base?.name || "Unknown Unit",
      type: (base?.type || "UNIT") as CardModel["type"],
      triad_type: (unit.triad_type || base?.triad_type || "ASSAULT") as CardModel["triad_type"],
      mana_cost: base?.mana_cost ?? 0,
      attack: unit.attack,
      hp: unit.hp,
      description: base?.description || "Unit on the battlefield",
      image: unit.image || base?.image || "crimson_duelist.png",
      created_at: base?.created_at || ""
    };
  };

  const renderUnit = (unit: UnitInstance, isOwn: boolean) => {
    const isSelected = isOwn && unit.instanceId === selectedAttackerId;
    const isAttackable = isOwn && isMyTurn && unit.canAttack && !isAnyTargetingMode;
    const isTargetable = !isOwn && isAnyTargetingMode;
    const isSick = !unit.canAttack && !unit.hasAttacked;
    const unitShield = Array.isArray(unit.statuses)
      ? unit.statuses
        .filter((status) => String(status?.type || "").toLowerCase() === "shield")
        .reduce((total, status) => total + (Number(status?.amount) || 0), 0)
      : 0;

    let unitClass = "battlefield-unit-card";
    if (isSelected) unitClass += " battlefield-unit--selected";
    if (isAttackable) unitClass += " battlefield-unit--can-attack";
    if (isTargetable) unitClass += " battlefield-unit--targetable";
    if (isSick) unitClass += " battlefield-unit--sick";

    const handleClick = isOwn
      ? () => handleMyUnitClick(unit)
      : () => handleEnemyUnitClick(unit);

    return (
      <div
        key={unit.instanceId}
        className={unitClass}
        onClick={handleClick}
        title={isSick ? "Summoning sickness — can attack next turn" : unit.canAttack ? "Ready to attack" : "Already attacked"}
      >
        <GameCard card={toBoardCardModel(unit)} size="small" />
        {unitShield > 0 && <span className="battlefield-unit__shield">SH {unitShield}</span>}
        {Array.isArray(unit.statuses) && unit.statuses.length > 0 && (
          <div className="battlefield-unit__statuses">
            {renderStatuses(unit.statuses)}
          </div>
        )}
        {isSelected && <span className="battlefield-unit__badge">⚔</span>}
      </div>
    );
  };

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
          onClick={handleEnemyHeroClick}
          title={isSelectingSpellTarget ? "Cast spell on enemy hero" : isSelectingTarget ? "Attack enemy hero" : undefined}
          style={{ cursor: isAnyTargetingMode ? "crosshair" : undefined }}
        >
          <p className="game-state__label">Opponent Status</p>
          <p className="game-state__value">
            {(oppStats.statuses || []).length
              ? renderStatuses(oppStats.statuses)
              : isSelectingSpellTarget ? "← Click to target hero"
              : isSelectingTarget ? "← Click to attack hero"
              : "None"}
          </p>
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
                  {triadComboInfo.type.toUpperCase()} ×{triadComboInfo.count}
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
            selfUnits={
              selfStats.board.length > 0
                ? selfStats.board.map((unit) => renderUnit(unit, true))
                : <span className="battlefield-empty">No units</span>
            }
            enemyUnits={
              oppStats.board.length > 0
                ? oppStats.board.map((unit) => renderUnit(unit, false))
                : <span className="battlefield-empty">No units</span>
            }
          />
        </main>

        <HandCards
          handCards={handCards}
          selectedCardId={selectedCardId}
          canPlayCard={canPlayCard}
          onCardClick={handleCardClick}
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
    </div>
  );
}
