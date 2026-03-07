import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppSelector } from "../store";
import { GameCard, type CardModel } from "../components/Card";
import socket from "../shared/socket/socket";
import {
  endMatchTurn,
  joinMatch,
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
  type MatchStatePayload
} from "../shared/socket/matchSocket";
import { fetchUserDeck } from "../shared/api/deckBuilderApi";
import type { DeckData } from "../types/deckBuilder";
import "./GamePage.css";

export default function GamePage() {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const arenaId = searchParams.get("arenaId") ?? "unknown";
  const [opponentNickname, setOpponentNickname] = useState(searchParams.get("opponent") ?? "UNKNOWN");
  const [arenaMatchId, setArenaMatchId] = useState<string | null>(searchParams.get("matchId"));

  const nickname = useAppSelector((s) => s.auth.nickname);
  const userId = useAppSelector((s) => s.auth.userId);
  const token = useAppSelector((s) => s.auth.token);

  const displayName = nickname ?? "UNKNOWN";

  const [match, setMatch] = useState<MatchStatePayload | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [deck, setDeck] = useState<DeckData | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const joinedMatchRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!arenaId || arenaId === "unknown") return;
    if (!token) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();
    socket.emit("join_game", arenaId);

    const updateOpponentFromPlayers = (players?: Array<{ nickname?: string }>) => {
      if (!Array.isArray(players)) return;
      const names = players
        .map((player) => player?.nickname)
        .filter((value): value is string => Boolean(value));

      const ownName = (nickname ?? "").toLowerCase();
      const candidate = names.find((name) => name.toLowerCase() !== ownName);
      setOpponentNickname(candidate ?? "UNKNOWN");
    };

    socket.emit(
      "arena:get-state",
      { arenaId },
      (res?: { matchId?: string; players?: Array<{ nickname?: string }> }) => {
        updateOpponentFromPlayers(res?.players);
        if (res?.matchId) {
          setArenaMatchId(res.matchId);
        }
      }
    );

    const onArenaReady = (payload?: { arenaId?: string; matchId?: string; players?: Array<{ nickname?: string }> }) => {
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
  }, [arenaId, nickname, token]);

  useEffect(() => {
    if (!token || !userId) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();

    const handleState = (payload: MatchStatePayload) => {
      setMatchError(null);
      setMatch(payload);
      setArenaMatchId(payload.matchId);
    };

    const handleUpdate = (payload: MatchStatePayload) => {
      setMatchError(null);
      setMatch(payload);
    };

    const handleError = (payload: MatchErrorPayload) => {
      setMatchError(payload.message || "Match action failed");
      if (payload.type === "STATE_OUTDATED") {
        syncMatch();
      }
    };

    const handleFinish = (payload: { winnerId: string | null }) => {
      setWinnerId(payload.winnerId ?? null);
    };

    onMatchState(handleState);
    onMatchUpdate(handleUpdate);
    onMatchError(handleError);
    onMatchFinish(handleFinish);

    return () => {
      offMatchState(handleState);
      offMatchUpdate(handleUpdate);
      offMatchError(handleError);
      offMatchFinish(handleFinish);
    };
  }, [token, userId]);

  useEffect(() => {
    if (!arenaMatchId) return;
    if (joinedMatchRef.current === arenaMatchId) return;

    joinedMatchRef.current = arenaMatchId;
    setMatchError(null);
    joinMatch(arenaMatchId);
  }, [arenaMatchId]);

  useEffect(() => {
    if (!token) return;
    fetchUserDeck(token)
      .then((deckData) => setDeck(deckData))
      .catch(() => setDeck(null));
  }, [token]);

  const handCards: CardModel[] = useMemo(() => {
    if (!deck) return [];

    return deck.cards.flatMap<CardModel>((item) => {
      const card: CardModel = {
        id: item.card.id,
        name: item.card.name,
        type: item.card.type,
        triad_type: item.card.triad_type.toUpperCase() as CardModel["triad_type"],
        mana_cost: item.card.mana_cost,
        attack: item.card.attack,
        hp: item.card.hp,
        description: item.card.description,
        created_at: item.card.created_at
      };

      return Array.from({ length: Math.max(1, item.quantity) }, (_, idx) => ({
        ...card,
        id: `${card.id}:${idx}`
      }));
    });
  }, [deck]);

  const { playerHPPercent, opponentHPPercent, currentEnergy, isMyTurn } = useMemo(() => {
    if (!match || !userId) {
      return {
        playerHPPercent: 100,
        opponentHPPercent: 100,
        currentEnergy: 0,
        isMyTurn: false
      };
    }

    const selfIndex = match.players.findIndex((id) => id === userId);
    if (selfIndex < 0) {
      return {
        playerHPPercent: 100,
        opponentHPPercent: 100,
        currentEnergy: 0,
        isMyTurn: false
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
      isMyTurn: match.state.activePlayer === userId && !match.state.finished
    };
  }, [match, userId]);

  const matchResultLabel = useMemo(() => {
    if (!winnerId || !userId) return null;
    return winnerId === userId ? "Victory" : "Defeat";
  }, [winnerId, userId]);

  const canPlayCard = (card: CardModel): boolean => {
    if (!match || !userId) return false;
    if (match.state.finished) return false;
    if (!isMyTurn) return false;
    if (currentEnergy < card.mana_cost) return false;
    return true;
  };

  const handleCardClick = (card: CardModel) => {
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));
    if (!canPlayCard(card)) return;
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
    if (!match || !userId) return;
    if (match.state.finished || match.state.activePlayer !== userId) return;

    endMatchTurn({
      matchId: match.matchId,
      version: match.state.version
    });
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
            <strong className="comic-text-shadow">{Math.round(opponentHPPercent)}%</strong>
          </div>
          <div className="game-hp__track ink-border-thin">
            <div className="game-hp__fill game-hp__fill--enemy blood-glow" style={{ width: `${opponentHPPercent}%` }} />
          </div>
        </div>

        <div className="game-state">
          <p className="game-state__label">Affliction</p>
          <p className="game-state__value">Fearful</p>
        </div>
      </header>

      <div className="game-state">
        <p className="game-state__label">Arena</p>
        <p className="game-state__value">{arenaId}</p>
      </div>
      <div className="game-state">
        <p className="game-state__label">Match</p>
        <p className="game-state__value">{match ? match.matchId : arenaMatchId ? "Connecting..." : "Waiting arena..."}</p>
      </div>
      <div className="game-state">
        <p className="game-state__label">Turn</p>
        <p className="game-state__value">{match ? (isMyTurn ? "Your turn" : "Opponent's turn") : "-"}</p>
      </div>

      <main className="game-battlefield">
        <div className="game-battlefield__divider" />

        <aside className="game-log">
          <p className="game-log__title">Battle Log</p>
          {matchResultLabel && <p className="game-log__entry game-log__entry--active">{matchResultLabel}</p>}
          {!matchResultLabel && matchError && <p className="game-log__entry game-log__entry--active">{matchError}</p>}
          {!matchResultLabel && !matchError && <p className="game-log__entry">Awaiting actions...</p>}
        </aside>

        {selectedCardId && (
          <div className="game-overlay">
            <div className="game-overlay__panel parchment-panel">
              <span className="comic-text-shadow">Choose Your Target</span>
            </div>
          </div>
        )}
      </main>

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
            <strong className="comic-text-shadow">{Math.round(playerHPPercent)}%</strong>
          </div>
          <div className="game-hp__track ink-border-thin">
            <div className="game-hp__fill game-hp__fill--player" style={{ width: `${playerHPPercent}%` }} />
          </div>
        </div>

        <div className="game-actions">
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

      <section className="game-hand" aria-label="Hand">
        {handCards.map((card, index) => {
          const isSelected = selectedCardId === card.id;
          return (
            <div
              key={card.id}
              className={`game-hand__slot ${isSelected ? "is-selected" : ""}`}
              style={{ "--slot-rotation": `${(index - 2) * 2}deg` } as CSSProperties}
            >
              <GameCard card={card} onClick={handleCardClick} />
            </div>
          );
        })}
      </section>
    </div>
  );
}
