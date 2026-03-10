import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../store";
import { fetchUserDeck } from "../shared/api/deckBuilderApi";
import { fetchMatchHistory, fetchPlayerStats } from "../shared/api/lobbyApi";
import { useLobbyArena } from "../features/customHooks/useLobbyArena";
import { PlayerPanel } from "../components/lobby/PlayerPanel";
import { MatchmakingPanel } from "../components/lobby/MatchmakingPanel";
import { MatchHistoryPanel } from "../components/lobby/MatchHistoryPanel";
import { OnlineCounter } from "../components/lobby/OnlineCounter";
import type { DeckSummary } from "../types/lobby";
import type { MatchHistoryEntry, PlayerStats } from "../shared/api/lobbyApi";
import styles from "./LobbyPage.module.css";

function summarizeDeck(
  name: string,
  totalCards: number,
  maxCards: number,
  cards: Array<{
    cardId: string;
    quantity: number;
    card: { triad_type: string };
  }>,
): DeckSummary {
  const triadCounts = { assault: 0, precision: 0, arcane: 0 };
  for (const item of cards) {
    const t = (item.card?.triad_type || "").toLowerCase();
    if (t in triadCounts) {
      (triadCounts as Record<string, number>)[t] += item.quantity;
    }
  }
  return { name, cardsTotal: totalCards, cardsMax: maxCards, ...triadCounts };
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth.token);
  const nickname = useAppSelector((s) => s.auth.nickname) ?? "PILOT";

  const [deck, setDeck] = useState<DeckSummary | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  const {
    isCreatingArena,
    isJoiningArena,
    handleCreateArena,
    handleJoinArena,
    isOnline,
    error,
    cancelSearch
  } = useLobbyArena(token);

  useEffect(() => {
    if (!token) return;

    fetchUserDeck(token)
      .then((res) =>
        setDeck(
          summarizeDeck(res.name, res.totalCards, res.maxCards, res.cards),
        ),
      )
      .catch(() => setDeck(null));

    fetchPlayerStats(token)
      .then(setStats)
      .catch(() => setStats(null));

    setMatchesLoading(true);
    fetchMatchHistory(token)
      .then((data) => {
        setMatches(data);
        setMatchesError(null);
      })
      .catch(() => setMatchesError("Failed to load match history"))
      .finally(() => setMatchesLoading(false));
  }, [token]);

  const handleOpenDeckBuilder = () => navigate("/deck-builder");

  return (
    <div className={styles.page}>
      <div className={styles.bgImage} />
      <div className={`${styles.bgTexture} parchment-texture`} />
      <div className={`${styles.bgVignette} darkest-vignette`} />

      <header className={styles.header}>
        <div className={styles.brandWrap}>
          <div className={styles.brandAccent} />
          <div className={styles.brand}>
            <h1 className={styles.title}>Triad Arena</h1>
            <p className={styles.subtitle}>Sector_7 // Encampment</p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <p className={styles.status}>
            Status{" "}
            <span className={isOnline ? styles.statusOnline : styles.statusOffline}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </p>
          <p className={styles.userLabel}>User: {nickname}</p>
        </div>
      </header>

      <div className={styles.layout}>
        <PlayerPanel
          nickname={nickname}
          stats={stats}
          deck={deck}
          onEditDeck={handleOpenDeckBuilder}
        />

        <section className={styles.centerColumn}>
          <OnlineCounter />
          <MatchmakingPanel
            deck={deck}
            isCreatingArena={isCreatingArena}
            isJoiningArena={isJoiningArena}
            error={error}
            onFindMatch={handleJoinArena}
            onCreateArena={handleCreateArena}
            onCancelSearch={cancelSearch}
          />
        </section>

        <MatchHistoryPanel
          matches={matches}
          loading={matchesLoading}
          error={matchesError}
        />
      </div>
    </div>
  );
}
