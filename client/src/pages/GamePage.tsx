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
  | { mode: "selectingTarget"; attackerInstanceId: string };

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
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [selectedCardReason, setSelectedCardReason] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [finishReason, setFinishReason] = useState<string | null>(null);
  const [attackState, setAttackState] = useState<AttackState>({ mode: "idle" });
  const [timerRemaining, setTimerRemaining] = useState(45);

  const joinedMatchRef = useRef<string | null>(null);
  const { playedCards, cardCatalog, applyEvents, resetBoard } = useMatchBoard();

  const isSameUser = (value: string | number | null | undefined) =>
    String(value ?? "").trim().toLowerCase() === String(userIdStr ?? "").trim().toLowerCase();

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

  // ── URL params sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fromQueryOpponent = searchParams.get("opponent");
    const fromQueryMatchId = searchParams.get("matchId");
    if (fromQueryOpponent) setOpponentNickname(fromQueryOpponent);
    if (fromQueryMatchId) setArenaMatchId(fromQueryMatchId);
  }, [searchParams]);

  // ── Action log ───────────────────────────────────────────────────────────────

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
      setSelectedCardReason(null);
      setAttackState({ mode: "idle" });
      setMatch(payload);
      if (payload.state.finished) setTimerRemaining(0);
      setArenaMatchId(payload.matchId);
      if (payload.events?.length) {
        applyEvents(payload.events);
      }
    };

    const handleUpdate = (payload: MatchStatePayload) => {
      setMatchError(null);
      setSelectedCardReason(null);
      setAttackState({ mode: "idle" });
      setMatch(payload);
      if (payload.state.finished) setTimerRemaining(0);
      if (payload.events?.length) {
        applyEvents(payload.events);
      }
    };

    const handleError = (payload: MatchErrorPayload) => {
      setMatchError(mapMatchErrorMessage(payload.type, payload.message));
      if (payload.type === "STATE_OUTDATED") syncMatch();
    };

    const handleFinish = (payload: MatchFinishPayload) => {
      setFinishReason(payload.reason ?? null);
      setWinnerId(payload.winnerId ?? null);
      setTimerRemaining(0);
      setSelectedCardId(null);
      setSelectedCardReason(null);
      setAttackState({ mode: "idle" });
      setMatch((prev) => (prev ? { ...prev, state: { ...prev.state, finished: true } } : prev));

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
  }, [applyEvents, token, userIdStr]);

  // ── Join match ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!arenaMatchId || !token || !userIdStr) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();

    if (joinedMatchRef.current !== arenaMatchId) {
      resetBoard();
      joinedMatchRef.current = arenaMatchId;
      setMatchError(null);
    }

    if (match?.matchId !== arenaMatchId) joinMatch(arenaMatchId);

    const retryId = window.setTimeout(() => {
      if (match?.matchId !== arenaMatchId) {
        syncMatch();
        joinMatch(arenaMatchId);
      }
    }, 1200);

    return () => { window.clearTimeout(retryId); };
  }, [arenaMatchId, resetBoard, token, userIdStr, match?.matchId]);

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

  const matchResultLabel = useMemo(() => {
    if (finishReason === "opponent_left") return "Opponent cowardly left the arena";
    if (!winnerId || !userIdStr) return null;
    return isSameUser(winnerId) ? "Victory" : "Defeat";
  }, [finishReason, winnerId, userIdStr]);

  const isMatchFinished = Boolean(match?.state.finished || finishReason || winnerId);

  const playedCardIdsThisTurn = useMemo(() => {
    if (!match || !userIdStr) return new Set<string>();
    const ids = match.state.turnActions
      .filter((action) => isSameUser(action.playerId))
      .map((action) => action.cardId);
    return new Set(ids);
  }, [match, userIdStr]);

  // Triad combo: count same-type cards played by the local player this turn.
  // Uses turnActions (authoritative server state) so it survives reconnects.
  const triadComboInfo = useMemo((): { type: string; count: number; bonus: number } | null => {
    if (!match || !userIdStr) return null;

    const myActions = match.state.turnActions.filter(
      (a) => a.triadType != null && a.playerId != null && isSameUser(a.playerId)
    );
    if (myActions.length < 2) return null;

    const counts: Record<string, number> = {};
    for (const action of myActions) {
      const t = String(action.triadType).toLowerCase();
      counts[t] = (counts[t] ?? 0) + 1;
    }

    let bestType = "";
    let bestCount = 0;
    for (const [type, count] of Object.entries(counts)) {
      if (count > bestCount) {
        bestType = type;
        bestCount = count;
      }
    }

    if (bestCount < 2) return null;
    const bonus = bestCount >= 3 ? 4 : 2;
    return { type: bestType, count: bestCount, bonus };
  }, [match, userIdStr]);

  // ── Card play ─────────────────────────────────────────────────────────────────

  const getCardDisabledReason = (card: CardModel): string | null => {
    if (!match || !userIdStr) return "Match is not ready";
    if (selfIndex < 0) return "You are not part of this match";
    if (match.state.finished) return "Match already finished";
    if (!isMyTurn) return "Wait for your turn";
    if (playedCardIdsThisTurn.has(card.id.split(":")[0])) return "Card already played this turn";
    if (currentEnergy < card.mana_cost) return "Not enough energy";
    const statuses = selfStats.statuses || [];
    if (statuses.some((status) => status?.type === "stun")) return "You are stunned";
    return null;
  };

  const canPlayCard = (card: CardModel): boolean => getCardDisabledReason(card) === null;

  const handleCardClick = (card: CardModel) => {
    setAttackState({ mode: "idle" });
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));
    const reason = getCardDisabledReason(card);
    setSelectedCardReason(reason);
    if (reason || !match) return;

    const actionId = `${Date.now()}-${card.id}-${Math.random().toString(36).slice(2)}`;
    const originalCardId = card.id.split(":")[0];
    playMatchCard({ matchId: match.matchId, cardId: originalCardId, actionId, version: match.state.version });
  };

  // ── Attack flow ───────────────────────────────────────────────────────────────

  const handleMyUnitClick = useCallback((unit: UnitInstance) => {
    if (!isMyTurn || !match) return;

    if (attackState.mode === "selectingTarget" && attackState.attackerInstanceId === unit.instanceId) {
      setAttackState({ mode: "idle" });
      return;
    }

    if (!unit.canAttack) {
      setMatchError("This unit cannot attack yet");
      return;
    }

    setSelectedCardId(null);
    setAttackState({ mode: "selectingTarget", attackerInstanceId: unit.instanceId });
  }, [isMyTurn, match, attackState]);

  const handleEnemyUnitClick = useCallback((unit: UnitInstance) => {
    if (attackState.mode !== "selectingTarget" || !match) return;

    const actionId = `atk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    attackWithUnit({
      matchId: match.matchId,
      unitId: attackState.attackerInstanceId,
      targetType: "unit",
      targetId: unit.instanceId,
      actionId,
      version: match.state.version
    });
    // FIX 7: reset all attack UI state immediately after sending
    setAttackState({ mode: "idle" });
    setSelectedCardId(null);
    setMatchError(null);
  }, [attackState, match]);

  const handleEnemyHeroClick = useCallback(() => {
    if (attackState.mode !== "selectingTarget" || !match) return;

    const enemyHeroId = match.players.find((id) => !isSameUser(id));
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
    // FIX 7: reset all attack UI state immediately after sending
    setAttackState({ mode: "idle" });
    setSelectedCardId(null);
    setMatchError(null);
  }, [attackState, match, userIdStr]);

  // ── Turn / leave ──────────────────────────────────────────────────────────────

  const handleEndTurnClick = () => {
    setSelectedCardId(null);
    setSelectedCardReason(null);
    setAttackState({ mode: "idle" });
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
    resetBoard();
    navigate("/lobby");
  };

  // ── Board rendering helpers ───────────────────────────────────────────────────

  const isSelectingTarget = attackState.mode === "selectingTarget";
  const selectedAttackerId = isSelectingTarget ? attackState.attackerInstanceId : null;

  const toBoardCardModel = (unit: UnitInstance): CardModel => {
    const base = cardCatalog[unit.cardId];
    return {
      id: unit.cardId,
      name: base?.name || "Unknown Unit",
      type: (base?.type || "UNIT") as CardModel["type"],
      triad_type: (base?.triad_type || "ASSAULT") as CardModel["triad_type"],
      mana_cost: base?.mana_cost ?? 0,
      attack: unit.attack,
      hp: unit.hp,
      description: base?.description || "Unit on the battlefield",
      image: base?.image || "crimson_duelist.png",
      created_at: base?.created_at || ""
    };
  };

  const renderUnit = (unit: UnitInstance, isOwn: boolean) => {
    const isSelected = isOwn && unit.instanceId === selectedAttackerId;
    const isAttackable = isOwn && isMyTurn && unit.canAttack && !isSelectingTarget;
    const isTargetable = !isOwn && isSelectingTarget;
    const isSick = !unit.canAttack && !unit.hasAttacked;

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
          className={`game-state${isSelectingTarget ? " game-state--attackable" : ""}`}
          onClick={handleEnemyHeroClick}
          title={isSelectingTarget ? "Attack enemy hero" : undefined}
          style={{ cursor: isSelectingTarget ? "crosshair" : undefined }}
        >
          <p className="game-state__label">Opponent Status</p>
          <p className="game-state__value">
            {(oppStats.statuses || []).length
              ? renderStatuses(oppStats.statuses)
              : isSelectingTarget ? "← Click to attack hero" : "None"}
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
            <p>My Deck</p>
            <p className="game-log__entry">Cards left: {selfDeckCount}</p>
            <p className="game-log__entry">Cards in hand: {handCards.length}</p>
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
                <p className="game-hud__name game-state__value">Opponent's turn</p>) : "-"}
            </div>
            {match && !match.state.finished ? (isMyTurn ?
              <p className="game-hud__name game-state__value--active-turn comic-text-shadow">
                <TurnCountdown remaining={timerRemaining} />
              </p> :
              <p className="game-hud__name game-state__value">
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
          <div className="game-battlefield-layout">
            {/* My board (left) */}
            <div className="battlefield-row battlefield-row--self">
              <p className="battlefield-col-title">My Units</p>
              {selfStats.board.length > 0
                ? selfStats.board.map((unit) => renderUnit(unit, true))
                : <span className="battlefield-empty">No units</span>}
            </div>

            {/* Center board */}
            <MatchBoard cards={playedCards} currentUserId={userIdStr} />

            {/* Enemy board (right) */}
            <div className="battlefield-enemy-col">
              {isSelectingTarget && (
                <div className="battlefield-target-overlay">
                  <span className="game-state__target-hint">Select a target unit</span>
                </div>
              )}
              <div className={`battlefield-row battlefield-row--enemy${isSelectingTarget ? " battlefield-row--enemy-targeting" : ""}`}>
                <p className="battlefield-col-title">Enemy Units</p>
                {oppStats.board.length > 0
                  ? oppStats.board.map((unit) => renderUnit(unit, false))
                  : <span className="battlefield-empty">No units</span>}
              </div>
            </div>
          </div>
        </main>

        <HandCards
          handCards={handCards}
          selectedCardId={selectedCardId}
          canPlayCard={canPlayCard}
          onCardClick={handleCardClick}
          cardSize={window.innerWidth <= 768 ? "small" : "normal"}
        />
      </section>

      {isMatchFinished && (
        <div className="game-overlay game-overlay--finish">
          <div className="game-overlay__panel parchment-panel">
            <span className="comic-text-shadow">{matchResultLabel ?? "Match finished"}</span>
            {finishReason === "disconnect" && (
              <p style={{ marginTop: 8, textAlign: "center" }}>Opponent disconnected</p>
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


