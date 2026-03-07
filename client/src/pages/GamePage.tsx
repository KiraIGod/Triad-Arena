import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppSelector } from "../store";
import { GameCard, type CardModel } from "../components/Card";
import socket from "../shared/socket/socket";
import {
  endMatchTurn,
  onMatchError,
  onMatchState,
  onMatchUpdate,
  offMatchError,
  offMatchState,
  offMatchUpdate,
  playMatchCard,
  queueForMatch,
  type MatchErrorPayload,
  type MatchStatePayload,
  syncMatch
} from "../shared/socket/matchSocket";
import { fetchUserDeck } from "../shared/api/deckBuilderApi";
import type { DeckData } from "../types/deckBuilder";
import "./GamePage.css";

export default function GamePage() {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const arenaId = searchParams.get("arenaId") ?? "unknown";
  const [opponentNickname, setOpponentNickname] = useState(searchParams.get("opponent") ?? "UNKNOWN");
  const nickname = useAppSelector((s) => s.auth.nickname);
  const userId = useAppSelector((s) => s.auth.userId);
  const token = useAppSelector((s) => s.auth.token);
  const displayName = nickname != null ? `${nickname}` : "UNKNOWN";
  const [match, setMatch] = useState<MatchStatePayload | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [isQueueing, setIsQueueing] = useState(false);
  const [deck, setDeck] = useState<DeckData | null>(null);
  const hasQueuedRef = useRef(false);

  useEffect(() => {
    const fromQuery = searchParams.get("opponent");
    if (fromQuery) {
      setOpponentNickname(fromQuery);
    }
  }, [searchParams]);

  // Подтягиваем ник оппонента через arena‑сокеты (как и раньше)
  useEffect(() => {
    if (!arenaId || arenaId === "unknown") return;
    if (!socket.connected) socket.connect();
    socket.emit("join_game", arenaId);

    const updateOpponentFromPlayers = (players?: Array<{ nickname?: string }>) => {
      if (!Array.isArray(players)) return;
      const names = players
        .map((player) => player?.nickname)
        .filter((value): value is string => Boolean(value));

      const ownName = (nickname ?? "").toLowerCase();
      const candidate = names.find((name) => name.toLowerCase() !== ownName);
      if (candidate) {
        setOpponentNickname(candidate);
      } else {
        setOpponentNickname("UNKNOWN");
      }
    };

    socket.emit("arena:get-state", { arenaId }, (res?: { players?: Array<{ nickname?: string }> }) => {
      updateOpponentFromPlayers(res?.players);
    });

    const onArenaReady = (payload?: { arenaId?: string; players?: Array<{ nickname?: string }> }) => {
      if (!payload?.arenaId || payload.arenaId !== arenaId || !Array.isArray(payload.players)) return;
      updateOpponentFromPlayers(payload.players);
    };

    socket.on("arena:ready", onArenaReady);
    return () => {
      socket.off("arena:ready", onArenaReady);
    };
  }, [arenaId, nickname]);

  // Подключение к матчу: очередь + обработчики состояния
  useEffect(() => {
    if (!token || !userId) return;
    if (hasQueuedRef.current) {
      // При повторном заходе попробуем просто синхронизироваться
      syncMatch();
      return;
    }

    hasQueuedRef.current = true;
    setIsQueueing(true);
    setMatchError(null);
    queueForMatch();

    const handleState = (payload: MatchStatePayload) => {
      setIsQueueing(false);
      setMatchError(null);
      setMatch(payload);
    };

    const handleUpdate = (payload: MatchStatePayload) => {
      setMatch(payload);
    };

    const handleError = (payload: MatchErrorPayload) => {
      setMatchError(payload.message || "Match action failed");
    };

    onMatchState(handleState);
    onMatchUpdate(handleUpdate);
    onMatchError(handleError);

    return () => {
      offMatchState(handleState);
      offMatchUpdate(handleUpdate);
      offMatchError(handleError);
    };
  }, [token, userId]);

  // Загружаем активную колоду игрока и используем её как "руку"
  useEffect(() => {
    if (!token) return;
    fetchUserDeck(token)
      .then((deckData) => setDeck(deckData))
      .catch(() => setDeck(null));
  }, [token]);

  const handCards: CardModel[] = useMemo(() => {
    if (!deck) return [];
    return deck.cards.map<CardModel>((item) => ({
      id: item.card.id,
      name: item.card.name,
      type: item.card.type,
      triad_type: item.card.triad_type.toUpperCase() as CardModel["triad_type"],
      mana_cost: item.card.mana_cost,
      attack: item.card.attack,
      hp: item.card.hp,
      description: item.card.description,
      created_at: item.card.created_at
    }));
  }, [deck]);

  const {
    playerHPPercent,
    opponentHPPercent,
    currentEnergy,
    isMyTurn
  } = useMemo(() => {
    if (!match || !userId) {
      return {
        playerHPPercent: 100,
        opponentHPPercent: 100,
        currentEnergy: 0,
        isMyTurn: false
      };
    }

    const selfIndex = match.players.findIndex((id) => id === userId);
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

  const handleCardClick = (card: CardModel) => {
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));

    if (!match || !userId) return;
    if (match.state.finished || match.state.activePlayer !== userId) return;

    const actionId = `${Date.now()}-${card.id}-${Math.random().toString(36).slice(2)}`;

    playMatchCard({
      matchId: match.matchId,
      cardId: card.id,
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
            <div
              className="game-hp__fill game-hp__fill--enemy blood-glow"
              style={{ width: `${opponentHPPercent}%` }}
            />
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
        <p className="game-state__value">
          {match ? match.matchId : isQueueing ? "Searching..." : "Not started"}
        </p>
      </div>

      <main className="game-battlefield">
        <div className="game-battlefield__divider" />

        <aside className="game-log">
          <p className="game-log__title">Battle Log</p>
          {matchError && <p className="game-log__entry game-log__entry--active">{matchError}</p>}
          {!matchError && <p className="game-log__entry">Awaiting actions...</p>}
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
            <div
              className="game-hp__fill game-hp__fill--player"
              style={{ width: `${playerHPPercent}%` }}
            />
          </div>
        </div>

        <div className="game-actions">
          <div className="game-energy" aria-label="Resolve">
            {Array.from({ length: 10 }).map((_, index) => (
              <span
                key={index}
                className={`game-energy__pip ${index < currentEnergy ? "is-active" : ""}`}
              />
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

