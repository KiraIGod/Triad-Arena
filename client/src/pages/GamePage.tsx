import { useEffect, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppSelector } from "../store";
import { GameCard, type CardModel } from "../components/Card";
import socket from "../shared/socket/socket";
import "./GamePage.css";

const PLAYER_CARDS: CardModel[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Crimson Blade",
    type: "UNIT",
    triad_type: "ASSAULT",
    mana_cost: 4,
    attack: 8,
    hp: 4,
    description: "Swift strike that ignores armor.",
    created_at: "2026-03-05T12:00:00Z",
  },
  {
    id: "660e8400-e29b-41d4-a716-446655440001",
    name: "Spectral Assassin",
    type: "UNIT",
    triad_type: "PRECISION",
    mana_cost: 3,
    attack: 6,
    hp: 3,
    description: "Target weak points for critical damage.",
    created_at: "2026-03-05T12:00:00Z",
  },
  {
    id: "770e8400-e29b-41d4-a716-446655440002",
    name: "Void Reaver",
    type: "UNIT",
    triad_type: "ARCANE",
    mana_cost: 5,
    attack: 10,
    hp: 2,
    description: "Consume essence to fuel power.",
    created_at: "2026-03-05T12:00:00Z",
  },
  {
    id: "880e8400-e29b-41d4-a716-446655440003",
    name: "Shadow Strike",
    type: "SPELL",
    triad_type: "ASSAULT",
    mana_cost: 2,
    attack: null,
    hp: null,
    description: "Attack from the darkness.",
    created_at: "2026-03-05T12:00:00Z",
  },
  {
    id: "990e8400-e29b-41d4-a716-446655440004",
    name: "Arcane Burst",
    type: "SPELL",
    triad_type: "ARCANE",
    mana_cost: 3,
    attack: null,
    hp: null,
    description: "Unleash raw magical energy.",
    created_at: "2026-03-05T12:00:00Z",
  },
];

export default function GamePage() {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [playerHP] = useState(85);
  const [opponentHP] = useState(62);
  const [energy] = useState(7);
  const [searchParams] = useSearchParams();
  const arenaId = searchParams.get("arenaId") ?? "unknown";
  const [opponentNickname, setOpponentNickname] = useState(searchParams.get("opponent") ?? "UNKNOWN");
  const nickname = useAppSelector((s) => s.auth.nickname);
  const displayName = nickname != null ? `Gladiator ${nickname}` : "Gladiator UNKNOWN";

  useEffect(() => {
    const fromQuery = searchParams.get("opponent");
    if (fromQuery) {
      setOpponentNickname(fromQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!arenaId || arenaId === "unknown") return;
    if (!socket.connected) socket.connect();
    socket.emit("join_game", arenaId);

    const onArenaReady = (payload?: { arenaId?: string; players?: Array<{ nickname?: string }> }) => {
      if (!payload?.arenaId || payload.arenaId !== arenaId || !Array.isArray(payload.players)) return;

      const names = payload.players
        .map((player) => player?.nickname)
        .filter((value): value is string => Boolean(value));

      const ownName = (nickname ?? "").toLowerCase();
      const candidate = names.find((name) => name.toLowerCase() !== ownName) ?? names[0];
      if (candidate) {
        setOpponentNickname(candidate);
      }
    };

    socket.on("arena:ready", onArenaReady);
    return () => {
      socket.off("arena:ready", onArenaReady);
    };
  }, [arenaId, nickname]);


  const playerHPPercent = Math.max(0, Math.min(100, playerHP));
  const opponentHPPercent = Math.max(0, Math.min(100, opponentHP));

  const handleCardClick = (card: CardModel) => {
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));
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
            <strong className="comic-text-shadow">{opponentHP}%</strong>
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

      <main className="game-battlefield">
        <div className="game-battlefield__divider" />

        <aside className="game-log">
          <p className="game-log__title">Battle Log</p>
          <p className="game-log__entry">Opponent draws 2 cards</p>
          <p className="game-log__entry">Shadow strike deals 8 damage</p>
          <p className="game-log__entry game-log__entry--active">
            Blood ritual prepared
          </p>
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
            <strong className="comic-text-shadow">{playerHP}%</strong>
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
                className={`game-energy__pip ${index < energy ? "is-active" : ""}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="game-end-turn stress-warning"
            onClick={() => setSelectedCardId(null)}
          >
            End Turn
          </button>
        </div>
      </footer>

      <section className="game-hand" aria-label="Hand">
        {PLAYER_CARDS.map((card, index) => {
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

