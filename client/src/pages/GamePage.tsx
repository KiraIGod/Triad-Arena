import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { GameCard } from "../components/Card";

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
  if (normalized === "INVALID_ACTION") return fallback || "Invalid action.";

  return fallback || "Match action failed.";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GamePage() {
  const navigate = useNavigate();
  const selfHeroRef = useRef<HTMLDivElement | null>(null);
  const selfUnitElementsRef = useRef<Record<string, HTMLDivElement | null>>({});

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
  const [opponentNickname, setOpponentNickname] = useState(
    searchParams.get("opponent") ?? "UNKNOWN",
  );
  const [arenaMatchId, setArenaMatchId] = useState<string | null>(
    searchParams.get("matchId"),
  );

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
    () => typeof window !== "undefined" && window.innerWidth <= 768,
  );
  const lastOpponentPlayVisualEventIdRef = useRef<number | null>(null);
  const { playedCards, cardCatalog, applyEvents, resetBoard } = useMatchBoard();
  const {
    value: spellNotice,
    isFading: spellNoticeFading,
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
    spawnHitTextEffect,
    selfHeroShakeToken,
    selfHeroFlashToken,
    enemyHeroShakeToken,
    enemyHeroFlashToken,
    selfUnitShake,
    selfUnitFlash,
    enemyUnitShake,
    enemyUnitFlash,
    handCardElementsRef,
    opponentHandZoneRef,
    selfUnitsZoneRef,
    enemyUnitsZoneRef,
    enemyHeroRef,
    spawnCardFlyEffect,
    spawnOpponentUnitFlyEffect,
    spawnSpellBurstEffect,
    triggerSelfHeroShake,
    triggerSelfHeroFlash,
    triggerSelfUnitShake,
    triggerSelfUnitFlash,
    triggerEnemyHeroShake,
    triggerEnemyHeroFlash,
    triggerEnemyUnitShake,
    triggerEnemyUnitFlash,
    completeEffect,
  } = useBattleEffects();

  const isSameUser = useCallback(
    (value: string | number | null | undefined) =>
      String(value ?? "")
        .trim()
        .toLowerCase() ===
      String(userIdStr ?? "")
        .trim()
        .toLowerCase(),
    [userIdStr],
  );

  const showOpponentPlayVisual = useCallback(
    (events?: MatchStatePayload["events"]) => {
      if (!Array.isArray(events) || events.length === 0) return;

      const latestOpponentCardEvent = [...events]
        .reverse()
        .find(
          (event) =>
            String(event?.type || "") === "CARD_PLAYED" &&
            !isSameUser(event?.payload?.playerId),
        );

      if (!latestOpponentCardEvent?.payload?.card) return;
      if (lastOpponentPlayVisualEventIdRef.current === latestOpponentCardEvent.eventId) return;
      lastOpponentPlayVisualEventIdRef.current = latestOpponentCardEvent.eventId;

      const card = latestOpponentCardEvent.payload.card;
      const cardModel = {
        id: card.id,
        name: card.name,
        type: String(card.type).toUpperCase() as "UNIT" | "SPELL" | "ARTIFACT",
        triad_type: String(card.triad_type).toUpperCase() as "ASSAULT" | "PRECISION" | "ARCANE",
        mana_cost: card.mana_cost,
        attack: card.attack,
        hp: card.hp,
        description: card.description,
        image: card.image || "crimson_duelist.png",
        created_at: card.created_at,
      };

      if (String(card.type).toLowerCase() === "unit") {
        spawnOpponentUnitFlyEffect(cardModel);
        return;
      }

      if (String(card.type).toLowerCase() !== "spell") return;

      const targetType = String(latestOpponentCardEvent.payload.targetType || "").toLowerCase();
      const targetId = String(latestOpponentCardEvent.payload.targetId || "");
      const targetRect =
        targetType === "unit" && targetId
          ? selfUnitElementsRef.current[targetId]?.getBoundingClientRect()
            ?? selfUnitsZoneRef.current?.getBoundingClientRect()
            ?? null
          : selfHeroRef.current?.getBoundingClientRect() ?? null;

      if (targetType === "unit" && targetId) {
        triggerSelfUnitShake(targetId);
        triggerSelfUnitFlash(targetId);
      } else {
        triggerSelfHeroShake();
        triggerSelfHeroFlash();
      }

      spawnOpponentUnitFlyEffect(cardModel, targetRect);
      if ((Number(cardModel.attack) || 0) > 0) {
        spawnHitTextEffect(`-${Number(cardModel.attack)}`, targetRect);
      }
      const burstTargetRect = targetRect;
      window.setTimeout(() => {
        spawnSpellBurstEffect(cardModel.triad_type, burstTargetRect);
      }, 120);
    },
    [
      isSameUser,
      selfUnitsZoneRef,
      spawnOpponentUnitFlyEffect,
      spawnSpellBurstEffect,
      triggerSelfHeroFlash,
      triggerSelfHeroShake,
      triggerSelfUnitFlash,
      triggerSelfUnitShake,
    ],
  );

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

  const handleMatchStatePayload = useCallback(
    (payload: MatchStatePayload) => {
      setMatchError(null);
      hideBattlefieldHint();
      hideHandHint();
      setAttackState({ mode: "idle" });
      if (payload.events?.length) {
        showOpponentPlayVisual(payload.events);
        applyEvents(payload.events);
      }
      setMatch(payload);
      if (payload.state.finished) setTimerRemaining(0);
      setArenaMatchId(payload.matchId);
    },
    [applyEvents, hideBattlefieldHint, hideHandHint, showOpponentPlayVisual],
  );

  const handleMatchUpdatePayload = useCallback(
    (payload: MatchStatePayload) => {
      setMatchError(null);
      hideBattlefieldHint();
      hideHandHint();
      setAttackState({ mode: "idle" });
      if (payload.events?.length) {
        showOpponentPlayVisual(payload.events);
        applyEvents(payload.events);
      }
      setMatch(payload);
      if (payload.state.finished) setTimerRemaining(0);
    },
    [applyEvents, hideBattlefieldHint, hideHandHint, showOpponentPlayVisual],
  );

  const handleMatchErrorPayload = useCallback(
    (payload: MatchErrorPayload) => {
      hideBattlefieldHint();
      setMatchError(mapMatchErrorMessage(payload.type, payload.message));
      if (payload.type === "STATE_OUTDATED") syncMatch();
    },
    [hideBattlefieldHint],
  );

  const handleMatchFinishPayload = useCallback(
    (payload: MatchFinishPayload) => {
      setFinishReason(payload.reason ?? null);
      setWinnerId(payload.winnerId ?? null);
      setTimerRemaining(0);
      setSelectedCardId(null);
      hideHandHint();
      setAttackState({ mode: "idle" });
      hideBattlefieldHint();
      setMatch((prev) =>
        prev ? { ...prev, state: { ...prev.state, finished: true } } : prev,
      );

      setFinishGameMode(payload.gameMode ?? null);
      const myRatingChange =
        userIdStr &&
        payload.ratingChanges != null &&
        payload.ratingChanges[userIdStr] !== undefined
          ? payload.ratingChanges[userIdStr]
          : null;
      setRatingChange(myRatingChange);

      if (payload.reason === "opponent_left") {
        setMatchError(payload.message ?? "Opponent cowardly left the arena");
      }
    },
    [hideBattlefieldHint, hideHandHint, userIdStr],
  );

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

  const enemyPlayedHistory = useMemo(
    () =>
      playedCards
        .filter((entry) => entry.playerId != null && !isSameUser(entry.playerId))
        .slice(-10),
    [isSameUser, playedCards],
  );

  const selfPlayedHistory = useMemo(
    () =>
      playedCards
        .filter((entry) => entry.playerId != null && isSameUser(entry.playerId))
        .slice(-10),
    [isSameUser, playedCards],
  );

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

  const handleBattlefieldDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    [],
  );

  const handleBattlefieldDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      let cardId: string;
      try {
        const data = JSON.parse(raw) as { cardId?: string };
        cardId = String(data?.cardId ?? "");
      } catch {
        return;
      }
      if (!cardId) return;
      const card = handCards.find((c) => c.id === cardId);
      if (!card) return;
      if (!canPlayCard(card)) return;
      handleCardClick(card);
    },
    [handCards, canPlayCard, handleCardClick],
  );

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
  const selectedAttackerId = isSelectingTarget
    ? attackState.attackerInstanceId
    : null;
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

        <main
          className="game-battlefield app-scrollbar"
          onDragOver={handleBattlefieldDragOver}
          onDrop={handleBattlefieldDrop}
        >
          <MatchBoard
            opponentHandCount={oppStats.hand?.length ?? 0}
            opponentHandRef={(element) => {
              opponentHandZoneRef.current = element;
            }}
            enemyHint={
              isAnyTargetingMode ? (
                <div className="battlefield-target-overlay">
                  <span className="game-state__target-hint">
                    {isSelectingSpellTarget
                      ? "Select a spell target"
                      : "Select a target unit"}
                  </span>
                </div>
              ) : null
            }
            enemyTargeting={isAnyTargetingMode}
            spellNotice={boardNotice}
            spellNoticeFading={isBoardNoticeFading}
            spellNoticeTone={boardNoticeTone}
            enemyPlayedHistory={enemyPlayedHistory.map((entry, index) => (
              <div
                key={`${entry.playerId ?? "enemy"}-${entry.card.id}-${index}`}
                className="battlefield-history-card"
                style={{ zIndex: index + 1 }}
              >
                <GameCard card={entry.card} size="small" disabled />
              </div>
            ))}
            selfPlayedHistory={selfPlayedHistory.map((entry, index) => (
              <div
                key={`${entry.playerId ?? "self"}-${entry.card.id}-${index}`}
                className="battlefield-history-card"
                style={{ zIndex: index + 1 }}
              >
                <GameCard card={entry.card} size="small" disabled />
              </div>
            ))}
            selfUnitsRef={(element) => {
              selfUnitsZoneRef.current = element;
            }}
            enemyUnitsRef={(element) => {
              enemyUnitsZoneRef.current = element;
            }}
            selfUnits={
              selfStats.board.length > 0 ? (
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
                        shakeToken={
                          selfUnitShake.id === unit.instanceId
                            ? selfUnitShake.token
                            : 0
                        }
                        flashToken={
                          selfUnitFlash.id === unit.instanceId
                            ? selfUnitFlash.token
                            : 0
                        }
                        cardCatalog={cardCatalog}
                        onOwnUnitClick={handleMyUnitClick}
                        onEnemyUnitClick={handleEnemyUnitClick}
                        onMount={(unitId, element) => {
                          selfUnitElementsRef.current[unitId] = element;
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <span className="battlefield-empty">No units</span>
              )
            }
            enemyUnits={
              oppStats.board.length > 0 ? (
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
                        shakeToken={
                          enemyUnitShake.id === unit.instanceId
                            ? enemyUnitShake.token
                            : 0
                        }
                        flashToken={
                          enemyUnitFlash.id === unit.instanceId
                            ? enemyUnitFlash.token
                            : 0
                        }
                        cardCatalog={cardCatalog}
                        onOwnUnitClick={handleMyUnitClick}
                        onEnemyUnitClick={handleEnemyUnitClick}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <span className="battlefield-empty">No units</span>
              )
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
            <span className="comic-text-shadow">
              {matchResultLabel ?? "Match finished"}
            </span>
            {finishGameMode === "ranked" && ratingChange !== null && (
              <p
                className="comic-text-shadow"
                style={{
                  marginTop: 10,
                  textAlign: "center",
                  fontSize: "1.3rem",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  color: ratingChange >= 0 ? "#6cca86" : "#c85040",
                }}
              >
                {ratingChange >= 0 ? `+${ratingChange}` : ratingChange} Rating
              </p>
            )}
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <button
                type="button"
                className="game-end-turn stress-warning"
                onClick={handleLeaveArenaClick}
              >
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
        heroRef={selfHeroRef}
        heroShakeToken={selfHeroShakeToken}
        heroFlashToken={selfHeroFlashToken}
      />

      <BattleEffectsLayer effects={battleEffects} onComplete={completeEffect} />
    </div>
  );
}
