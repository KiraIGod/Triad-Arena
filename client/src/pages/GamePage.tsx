import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppSelector } from "../store";
import { GameCard, type CardModel } from "../components/Card";
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
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [finishReason, setFinishReason] = useState<string | null>(null);
  const [attackState, setAttackState] = useState<AttackState>({ mode: "idle" });
  const [timerRemaining, setTimerRemaining] = useState(45);

  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);
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

    if (payload.reason === "opponent_left") {
      setMatchError("Opponent cowardly left the arena");
    }
  }, [hideBattlefieldHint, hideHandHint]);

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

