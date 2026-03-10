import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppSelector } from "../store";
import { GameCard, type CardModel } from "../components/Card";
import MatchBoard from "../components/MatchBoard";
import socket from "../shared/socket/socket";
import {
  endMatchTurn,
  joinMatch,
  leaveMatch,
  offMatchError,
  offMatchFinish,
  offMatchState,
  offMatchUpdate,
  onMatchError,
  onMatchFinish,
  onMatchState,
  onMatchUpdate,
  playMatchCard,
  syncMatch,
  type MatchErrorPayload,
  type MatchFinishPayload,
  type MatchStatePayload
} from "../shared/socket/matchSocket";
import { useMatchBoard } from "../features/customHooks/useMatchBoard";
import "./GamePage.css";

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
  const [logEntries, setLogEntries] = useState<string[]>(["Awaiting actions..."]);
  const [selectedCardReason, setSelectedCardReason] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [finishReason, setFinishReason] = useState<string | null>(null);
  const joinedMatchRef = useRef<string | null>(null);
  const { playedCards, applyEvents, resetBoard } = useMatchBoard();
  const isSameUser = (value: string | number | null | undefined) =>
    String(value ?? "") === String(userIdStr ?? "");

  useEffect(() => {
    const fromQueryOpponent = searchParams.get("opponent");
    const fromQueryMatchId = searchParams.get("matchId");

    if (fromQueryOpponent) {
      setOpponentNickname(fromQueryOpponent);
    }
    if (fromQueryMatchId) {
      setArenaMatchId(fromQueryMatchId);
    }
  }, [searchParams]);

  const appendLog = (entry: string) => {
    setLogEntries((prev) => [entry, ...prev].slice(0, 8));
  };

  const toActionLogEntry = (event: NonNullable<MatchStatePayload["events"]>[number]): string => {
    if (!event) return "Unknown event";
    const payload = event.payload || {};
    if (event.type === "CARD_PLAYED") {
      return `Card played: ${String(payload.cardId ?? "unknown")}`;
    }
    if (event.type === "TURN_ENDED") {
      return `Turn ended by ${String(payload.playerId ?? "unknown")}`;
    }
    if (event.type === "MATCH_FINISHED") {
      return `Match finished`;
    }
    return event.type;
  };

  useEffect(() => {
    if (!arenaId || arenaId === "unknown") return;
    if (!token) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();
    socket.emit("join_game", arenaId);

    const updateOpponentFromPlayers = (players?: Array<{ userId?: string | number; nickname?: string }>) => {
      if (!Array.isArray(players)) return;
      const opponent = players.find((player) => !isSameUser(player?.userId));
      setOpponentNickname(opponent?.nickname || "UNKNOWN");
    };

    socket.emit(
      "arena:get-state",
      { arenaId },
      (res?: { matchId?: string; players?: Array<{ userId?: string | number; nickname?: string }> }) => {
        updateOpponentFromPlayers(res?.players);
        if (res?.matchId) {
          setArenaMatchId(res.matchId);
        }
      }
    );

    const onArenaReady = (
      payload?: { arenaId?: string; matchId?: string; players?: Array<{ userId?: string | number; nickname?: string }> }
    ) => {
      if (!payload?.arenaId || payload.arenaId !== arenaId) return;
      updateOpponentFromPlayers(payload.players);
      if (payload.matchId) {
        setArenaMatchId(payload.matchId);
      }
    };

    socket.on("arena:ready", onArenaReady);
    return () => {
      socket.off("arena:ready", onArenaReady);
    };
  }, [arenaId, token, userIdStr]);

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
      appendLog("Reconnecting...");
    };

    const handleState = (payload: MatchStatePayload) => {
      setMatchError(null);
      setSelectedCardReason(null);
      setMatch(payload);
      setArenaMatchId(payload.matchId);
      if (payload.events?.length) {
        applyEvents(payload.events);
        payload.events.forEach((event) => appendLog(toActionLogEntry(event)));
      }
    };

    const handleUpdate = (payload: MatchStatePayload) => {
      setMatchError(null);
      setSelectedCardReason(null);
      setMatch(payload);
      if (payload.events?.length) {
        applyEvents(payload.events);
        payload.events.forEach((event) => appendLog(toActionLogEntry(event)));
      }
    };

    const handleError = (payload: MatchErrorPayload) => {
      setMatchError(payload.message || "Match action failed");
      appendLog(payload.message || "Match action failed");
      if (payload.type === "STATE_OUTDATED") {
        syncMatch();
      }
    };

    const handleFinish = (payload: MatchFinishPayload) => {
      setFinishReason(payload.reason ?? null);
      setWinnerId(payload.winnerId ?? null);
      setSelectedCardId(null);
      setSelectedCardReason(null);
      setMatch((prev) => (prev ? { ...prev, state: { ...prev.state, finished: true } } : prev));

      if (payload.reason === "opponent_left") {
        const cowardMessage = "Opponent cowardly left the arena";
        setMatchError(cowardMessage);
        appendLog(cowardMessage);
        return;
      }

      appendLog(payload.reason ? `Match finished: ${payload.reason}` : "Match finished");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    onMatchState(handleState);
    onMatchUpdate(handleUpdate);
    onMatchError(handleError);
    onMatchFinish(handleFinish);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      offMatchState(handleState);
      offMatchUpdate(handleUpdate);
      offMatchError(handleError);
      offMatchFinish(handleFinish);
    };
  }, [applyEvents, token, userIdStr]);

  useEffect(() => {
    if (!arenaMatchId) return;
    if (joinedMatchRef.current === arenaMatchId) return;

    resetBoard();
    joinedMatchRef.current = arenaMatchId;
    setMatchError(null);
    joinMatch(arenaMatchId);
  }, [arenaMatchId, resetBoard]);

  const handCards: CardModel[] = useMemo(() => {
    if (!match || !userIdStr) return [];

    const selfIndex = match.players.findIndex((id) => isSameUser(id));
    if (selfIndex < 0) return [];

    const selfKey = selfIndex === 0 ? "player1" : "player2";
    const playerHand = match.state.players[selfKey].hand || [];

    return playerHand.map<CardModel>((card, index) => ({
      id: `${card.id}:${index}`,
      name: card.name,
      image: "crimson_duelist.png",
      type: String(card.type).toUpperCase() as CardModel["type"],
      triad_type: String(card.triad_type).toUpperCase() as CardModel["triad_type"],
      mana_cost: card.mana_cost,
      attack: card.attack,
      hp: card.hp,
      description: card.description,
      created_at: card.created_at
    }));
  }, [match, userIdStr]);

  const selfDeckCount = useMemo(() => {
    if (!match || !userIdStr) return 0;
    const ownIndex = match.players.findIndex((id) => isSameUser(id));
    if (ownIndex < 0) return 0;
    const ownKey = ownIndex === 0 ? "player1" : "player2";
    return match.state.players[ownKey].deckCount ?? 0;
  }, [match, userIdStr]);

  const { playerHPPercent, opponentHPPercent, currentEnergy, isMyTurn, selfIndex, selfStats, oppStats } = useMemo(() => {
    if (!match || !userIdStr) {
      return {
        playerHPPercent: 100,
        opponentHPPercent: 100,
        currentEnergy: 0,
        isMyTurn: false,
        selfIndex: -1,
        selfStats: { hp: 0, shield: 0, energy: 0, statuses: [] as Array<{ type: string; turns?: number; amount?: number }> },
        oppStats: { hp: 0, shield: 0, energy: 0, statuses: [] as Array<{ type: string; turns?: number; amount?: number }> }
      };
    }

    const selfIndex = match.players.findIndex((id) => isSameUser(id));
    if (selfIndex < 0) {
      return {
        playerHPPercent: 100,
        opponentHPPercent: 100,
        currentEnergy: 0,
        isMyTurn: false,
        selfIndex: -1,
        selfStats: { hp: 0, shield: 0, energy: 0, statuses: [] as Array<{ type: string; turns?: number; amount?: number }> },
        oppStats: { hp: 0, shield: 0, energy: 0, statuses: [] as Array<{ type: string; turns?: number; amount?: number }> }
      };
    }

    const selfKey = selfIndex === 0 ? "player1" : "player2";
    const oppKey = selfKey === "player1" ? "player2" : "player1";

    const selfStats = match.state.players[selfKey];
    const oppStats = match.state.players[oppKey];

    const maxHp = 30;
    const clampPercent = (value: number | null) => {
      if (value == null) return 0;
      return Math.max(0, Math.min(100, (value / maxHp) * 100));
    };

    return {
      playerHPPercent: clampPercent(selfStats.hp),
      opponentHPPercent: clampPercent(oppStats.hp),
      currentEnergy: selfStats.energy ?? 0,
      isMyTurn: isSameUser(match.state.activePlayer) && !match.state.finished,
      selfIndex,
      selfStats,
      oppStats
    };
  }, [match, userIdStr]);

  const matchResultLabel = useMemo(() => {
    if (finishReason === "opponent_left") {
      return "Opponent cowardly left the arena";
    }
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

  const canPlayCard = (card: CardModel): boolean => {
    return getCardDisabledReason(card) === null;
  };

  const handleCardClick = (card: CardModel) => {
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));
    const reason = getCardDisabledReason(card);
    setSelectedCardReason(reason);
    if (reason) return;
    if (!match) return;

    const actionId = `${Date.now()}-${card.id}-${Math.random().toString(36).slice(2)}`;
    const originalCardId = card.id.split(":")[0];

    playMatchCard({
      matchId: match.matchId,
      cardId: originalCardId,
      actionId,
      version: match.state.version
    });
  };

  const handleEndTurnClick = () => {
    setSelectedCardId(null);
    setSelectedCardReason(null);
    if (!match || !userIdStr) return;
    if (match.state.finished || !isSameUser(match.state.activePlayer)) return;

    endMatchTurn({
      matchId: match.matchId,
      version: match.state.version
    });
  };

  const handleLeaveArenaClick = () => {
    const leavingMatchId = match?.matchId || arenaMatchId;
    if (leavingMatchId) {
      leaveMatch(leavingMatchId);
    }
    if (arenaId && arenaId !== "unknown") {
      socket.emit("leave_game", arenaId);
    }
    joinedMatchRef.current = null;
    setMatch(null);
    setWinnerId(null);
    setFinishReason(null);
    resetBoard();
    navigate("/lobby");
  };

  return (
    <div className="game-screen">
      <div className="game-screen__bg" />
      <div className="game-screen__texture parchment-texture" />
      <div className="game-screen__vignette darkest-vignette" />

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
            <div className="game-hp__fill game-hp__fill--enemy blood-glow" style={{ width: `${opponentHPPercent}%` }} />
          </div>
        </div>

        <div className="game-state">
          <p className="game-state__label">Opponent Status</p>
          <p className="game-state__value">
            {(oppStats.statuses || []).length
              ? (oppStats.statuses || []).map((status) => status.type).join(", ")
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

      {/* 
      <div className="game-state">
        <p className="game-state__label">Arena</p>
        <p className="game-state__value">{arenaId}</p>
      </div>
      <div className="game-state">
        <p className="game-state__label">Match</p>
        <p className="game-state__value">{match ?match.matchId : arenaMatchId ? "Connecting..." : "Waiting arena..."}</p>
      </div> */}

      <div className="game-top-row">
        <aside className="game-deck-panel">
          <p>My Deck</p>
          <p className="game-log__entry">Cards left: {selfDeckCount}</p>
          <p className="game-log__entry">Cards in hand: {handCards.length}</p>
        </aside>

        <div className="game-state game-state--center">
          <p className="game-state__label">Turn</p>
          <p className="game-state__value">{match ? (isMyTurn ? "Your turn" : "Opponent's turn") : "-"}</p>
        </div>

        <div className="game-state game-state--right">
          <button type="button" className="game-end-turn stress-warning" onClick={handleLeaveArenaClick}>
            Leave Arena
          </button>
        </div>
      </div>



      <main className="game-battlefield">
        <MatchBoard cards={playedCards} />


        {/* <aside className="game-log">
          <p className="game-log__title">Battle Log</p>
          {matchResultLabel && <p className="game-log__entry game-log__entry--active">{matchResultLabel}</p>}
          {matchError && <p className="game-log__entry game-log__entry--active">{matchError}</p>}
          {selectedCardReason && <p className="game-log__entry">{selectedCardReason}</p>}
          {logEntries.map((entry, idx) => (
            <p key={`${idx}-${entry}`} className={`game-log__entry ${idx === 0 ? "game-log__entry--active" : ""}`}>
              {entry}
            </p>
          ))}
        </aside> */}

        {/* {selectedCardId && (
          <div className="game-overlay">
            <div className="game-overlay__panel parchment-panel">
              <span className="comic-text-shadow">Choose Your Target</span>
            </div>
          </div>
        )} */}
      </main>

      {isMatchFinished && (
        <div className="game-overlay game-overlay--finish">
          <div className="game-overlay__panel parchment-panel">
            <span className="comic-text-shadow">{matchResultLabel ?? "Match finished"}</span>
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <button type="button" className="game-end-turn stress-warning" onClick={handleLeaveArenaClick}>
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

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
              {(selfStats.statuses || []).length
                ? (selfStats.statuses || []).map((status) => status.type).join(", ")
                : "None"}
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

      <section
        className={`game-hand ${handCards.length === 0 ? "game-hand--empty" : ""}`.trim()}
        aria-label="Hand"
      >
        {handCards.length === 0 && <p className="game-hand__placeholder">No cards in hand</p>}
        {handCards.map((card, index) => {
          const isSelected = selectedCardId === card.id;
          const isDisabled = !canPlayCard(card);
          return (
            <div
              key={card.id}
              className={`game-hand__slot ${isSelected ? "is-selected" : ""}`}
              style={{ "--slot-rotation": `${(index - 2) * 2}deg` } as CSSProperties}
            >
              <GameCard card={card} onClick={handleCardClick} disabled={isDisabled} />
            </div>
          );
        })}
      </section>
    </div>
  );
}
