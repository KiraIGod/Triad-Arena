import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppSelector } from "../store";
import HandCards from "../components/HandCards";
import socket from "../shared/socket/socket";
import {
  leaveMatch,
  syncMatch,
  type MatchErrorPayload,
  type MatchFinishPayload,
  type MatchStatePayload,
  type MatchTimerPayload,
} from "../shared/socket/matchSocket";
import { useMatchBoard } from "../features/customHooks/useMatchBoard";
import { useGameMatchSession } from "../features/customHooks/useGameMatchSession";
import { useTimedNotice } from "../features/customHooks/useTimedNotice";
import { useGameViewModel } from "../features/customHooks/useGameViewModel";
import { useBattleEffects } from "../features/customHooks/useBattleEffects";
import { useGameActions } from "../features/customHooks/useGameActions";
import "./GamePage.css";
import LeaveArenaConfirmModal from "../components/LeaveArenaConfirmModal";
import MatchBoard from "../components/MatchBoard";
import BattlefieldUnitCard from "../components/BattlefieldUnitCard";
import BattleEffectsLayer from "../components/BattleEffectsLayer";
import GameTopHud from "../components/GameTopHud";
import GameBottomHud from "../components/GameBottomHud";


// ─── Attack flow state ────────────────────────────────────────────────────────

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
  const [ratingChange, setRatingChange] = useState<number | null>(null);
  const [finishGameMode, setFinishGameMode] = useState<string | null>(null);
  const [timerRemaining, setTimerRemaining] = useState(45);
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
  const {
    battleEffects,
    enemyHeroShakeToken,
    enemyHeroFlashToken,
    enemyUnitShake,
    enemyUnitFlash,
    handCardElementsRef,
    selfUnitsZoneRef,
    enemyHeroRef,
    spawnCardFlyEffect,
    spawnSpellBurstEffect,
    spawnHitTextEffect,
    triggerEnemyHeroShake,
    triggerEnemyHeroFlash,
    triggerEnemyUnitShake,
    triggerEnemyUnitFlash,
    completeEffect,
  } = useBattleEffects();

  const isSameUser = useCallback((value: string | number | null | undefined) =>
    String(value ?? "").trim().toLowerCase() === String(userIdStr ?? "").trim().toLowerCase(), [userIdStr]);

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

  const {
    attackState,
    setAttackState,
    getCardDisabledReason,
    canPlayCard,
    handleCardClick,
    handleMyUnitClick,
    handleEnemyUnitClick,
    handleEnemyHeroClick,
    handleEndTurnClick,
  } = useGameActions({
    match,
    userIdStr,
    isMyTurn,
    selfIndex,
    selfStats,
    currentEnergy,
    handCards,
    playedCardIdsThisTurn,
    isSameUser,
    enemyHeroRef,
    hideBattlefieldHint,
    showBattlefieldHint,
    hideHandHint,
    showHandHint,
    spawnCardFlyEffect,
    spawnSpellBurstEffect,
    spawnHitTextEffect,
    triggerEnemyHeroShake,
    triggerEnemyHeroFlash,
    triggerEnemyUnitShake,
    triggerEnemyUnitFlash,
    setSelectedCardId,
    setMatchError,
  });

  // ?????? Turn / leave ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

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

      <GameTopHud
        opponentNickname={opponentNickname}
        opponentHPPercent={opponentHPPercent}
        oppStats={oppStats}
        isAnyTargetingMode={isAnyTargetingMode}
        isSelectingSpellTarget={isSelectingSpellTarget}
        isSelectingTarget={isSelectingTarget}
        enemyHeroRef={enemyHeroRef}
        handleEnemyHeroClick={handleEnemyHeroClick}
        enemyHeroShakeToken={enemyHeroShakeToken}
        enemyHeroFlashToken={enemyHeroFlashToken}
        isReconnecting={isReconnecting}
        showAccessWarning={Boolean(match && selfIndex < 0)}
        selfDeckCount={selfDeckCount}
        handCount={handCards.length}
        triadComboInfo={triadComboInfo}
        matchExists={Boolean(match)}
        isMyTurn={isMyTurn}
        isMatchFinished={Boolean(match?.state.finished)}
        timerRemaining={timerRemaining}
        onLeaveArenaRequest={() => setIsLeaveConfirmOpen(true)}
      />

      <section className="game-content">
        {matchError && (
          <div className="game-attack-banner game-attack-banner--error">
            <span>{matchError}</span>
          </div>
        )}

        <main className="game-battlefield app-scrollbar">
          <MatchBoard
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
            selfUnitsRef={(element) => {
              selfUnitsZoneRef.current = element;
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

      <GameBottomHud
        displayName={displayName}
        playerHPPercent={playerHPPercent}
        selfStats={selfStats}
        currentEnergy={currentEnergy}
        isMyTurn={isMyTurn}
        matchExists={Boolean(match)}
        isMatchFinished={Boolean(match?.state.finished)}
        onEndTurnClick={handleEndTurnClick}
      />

      <BattleEffectsLayer
        effects={battleEffects}
        onComplete={completeEffect}
      />
    </div>
  );
}



