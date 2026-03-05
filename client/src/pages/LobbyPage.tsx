import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../store";
import styles from "./LobbyPage.module.css";

type DeckSummary = {
  name: string;
  cardsTotal: number;
  cardsMax: number;
  assault: number;
  precision: number;
  arcane: number;
};

const MOCK_MATCHES: Array<{
  date: string;
  opponent: string;
  result: "Victory" | "Defeat";
  turns: number;
  hpLeft: number;
}> = [
  {
    date: "02.03.25",
    opponent: "SHADOW_IX",
    result: "Victory",
    turns: 12,
    hpLeft: 45,
  },
  {
    date: "01.03.25",
    opponent: "NOVA_PRIME",
    result: "Defeat",
    turns: 8,
    hpLeft: 0,
  },
  {
    date: "28.02.25",
    opponent: "CRIMSON_7",
    result: "Victory",
    turns: 15,
    hpLeft: 22,
  },
  {
    date: "27.02.25",
    opponent: "ZERO_ONE",
    result: "Defeat",
    turns: 10,
    hpLeft: 0,
  },
  {
    date: "25.02.25",
    opponent: "ECHO_99",
    result: "Victory",
    turns: 11,
    hpLeft: 38,
  },
];

const RATING_MOCK = "1,847";
const RANK_MOCK = "#24";

function summarizeDeck(totalCards: number, maxCards: number, cards: Array<{ cardId: string; quantity: number; card: { triad_type: string } }>): DeckSummary {
  const triadCounts = { assault: 0, precision: 0, arcane: 0 };
  for (const item of cards) {
    const t = (item.card?.triad_type || "").toLowerCase();
    if (t in triadCounts) {
      (triadCounts as Record<string, number>)[t] += item.quantity;
    }
  }
  return {
    name: totalCards === maxCards ? "Ready" : "Incomplete",
    cardsTotal: totalCards,
    cardsMax: maxCards,
    assault: triadCounts.assault,
    precision: triadCounts.precision,
    arcane: triadCounts.arcane,
  };
}

function DeckPanel({ deck, onEditDeck }: { deck: DeckSummary | null; onEditDeck: () => void }) {
  const d = deck ?? { name: "—", cardsTotal: 0, cardsMax: 20, assault: 0, precision: 0, arcane: 0 };
  return (
    <div className={styles.column}>
      <h2 className={styles.sectionTitle}>Active deck</h2>
      <div className={styles.deckCard}>
        <h3 className={styles.deckName}>{d.name}</h3>
        <p className={styles.deckMeta}>
          {d.cardsTotal}/{d.cardsMax} cards
        </p>
        <div className={styles.deckStats}>
          <span className={styles.stat}>
            Assault <span className={styles.statValue}>{d.assault}</span>
          </span>
          <span className={styles.stat}>
            Precision <span className={styles.statValue}>{d.precision}</span>
          </span>
          <span className={styles.stat}>
            Arcane <span className={styles.statValue}>{d.arcane}</span>
          </span>
        </div>
      </div>
      <button type="button" className={styles.btnEdit} onClick={onEditDeck}>
        {d.cardsTotal === 0 ? "Create deck" : "Edit deck"}
      </button>
    </div>
  );
}

function MatchHistoryPanel() {
  return (
    <div className={styles.column}>
      <h2 className={styles.sectionTitle}>Match history</h2>
      <div className={styles.matchList}>
        {MOCK_MATCHES.map((m, i) => (
          <div key={i} className={styles.matchCard}>
            <div className={styles.matchRow}>
              <span className={styles.matchMeta}>{m.date}</span>
              <span
                className={
                  m.result === "Victory"
                    ? styles.matchResultVictory
                    : styles.matchResultDefeat
                }
              >
                {m.result}
              </span>
            </div>
            <div className={styles.matchRow}>
              <span className={styles.matchOpponent}>{m.opponent}</span>
            </div>
            <div className={styles.matchRow}>
              <span className={styles.matchMeta}>
                Turns: {m.turns} · HP left: {m.hpLeft}
              </span>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className={styles.btnViewAll}>
        View all data
      </button>
    </div>
  );
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth.token);
  const userId = useAppSelector((s) => s.auth.userId);
  const [deck, setDeck] = useState<DeckSummary | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOnline, setIsOnline] = useState(socket.connected);

  const displayName = userId != null ? `PILOT_${userId}` : "PILOT_ZERO";

  useEffect(() => {
    if (!token) return;
    fetchUserDeck(token)
      .then((res) => setDeck(summarizeDeck(res.totalCards, res.maxCards, res.cards)))
      .catch(() => setDeck(null));
  }, [token]);

  useEffect(() => {
    socket.connect();
    const onConnect = () => setIsOnline(true);
    const onDisconnect = () => setIsOnline(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.disconnect();
    };
  }, []);

  const handleEnterArena = () => {
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      navigate("/game");
    }, 3000);
  };

  const handleOpenDeckBuilder = () => {
    navigate("/deck-builder");
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.title}>Triad Arena</h1>
          <p className={styles.subtitle}>Sector_7 // Lobby</p>
        </div>
        <div className={styles.headerRight}>
          <p className={styles.status}>
            Status:{" "}
            <span
              className={isOnline ? styles.statusOnline : styles.statusOffline}
            >
              {isOnline ? "Online" : "Offline"}
            </span>
          </p>
          <p className={styles.userLabel}>User: {displayName}</p>
        </div>
      </header>

      <div className={styles.layout}>
        <DeckPanel deck={deck} onEditDeck={handleOpenDeckBuilder} />
        <div className={styles.centerColumn}>
          <button
            type="button"
            className={styles.btnArena}
            disabled={isSearching}
            onClick={handleEnterArena}
          >
            {isSearching ? (
              <>
                <span className={styles.loader} />
                Searching for opponent…
              </>
            ) : (
              <>
                <span className={styles.btnArenaIcon} aria-hidden>
                  ⚔
                </span>
                Enter Arena
              </>
            )}
          </button>
          {isSearching && (
            <p className={styles.searchingText}>Searching for opponent…</p>
          )}
          <div className={styles.ratingBlock}>
            <p className={styles.ratingLine}>
              Rating <span className={styles.ratingValue}>{RATING_MOCK}</span>
            </p>
            <p className={styles.ratingLine}>
              Rank <span className={styles.ratingValue}>{RANK_MOCK}</span>
            </p>
          </div>
        </div>
        <MatchHistoryPanel />
      </div>
    </div>
  );
}
