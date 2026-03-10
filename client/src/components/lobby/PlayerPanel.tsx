import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../store";
import { clearCredentials } from "../../features/auth/authSlice";
import type { DeckSummary } from "../../types/lobby";
import type { PlayerStats } from "../../shared/api/lobbyApi";
import styles from "./PlayerPanel.module.css";

type PlayerPanelProps = {
  nickname: string;
  stats: PlayerStats | null;
  deck: DeckSummary | null;
  onEditDeck: () => void;
};

export function PlayerPanel({ nickname, stats, deck, onEditDeck }: PlayerPanelProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const d = deck ?? { name: "—", cardsTotal: 0, cardsMax: 20, assault: 0, precision: 0, arcane: 0 };
  const isDeckReady = d.cardsTotal >= d.cardsMax;

  const winrate =
    stats && stats.games_played > 0
      ? ((stats.wins / stats.games_played) * 100).toFixed(1)
      : "0.0";

  const ratingDisplay = stats ? stats.rating.toLocaleString() : "—";
  const rankDisplay = stats?.rank != null ? `#${stats.rank}` : "—";

  const handleLogout = () => {
    dispatch(clearCredentials());
    navigate("/login");
  };

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.diamond} />
        <span className={styles.label}>{nickname}</span>
        <span className={styles.line} />
      </div>

      <div className={styles.ratingCard}>
        <p className={styles.kicker}>Resolve</p>
        <p className={styles.ratingNumber}>{ratingDisplay}</p>
        <div className={styles.ratingMeta}>
          <span className={styles.rankBadge}>{rankDisplay}</span>
          <span className={styles.winrate}>{winrate}% winrate</span>
        </div>
      </div>

      <div className={styles.statCard}>
        <p className={styles.kicker}>Active deck</p>
        <p className={styles.deckName}>{d.name}</p>
        <p className={styles.deckMeta}>
          {d.cardsTotal} / {d.cardsMax} cards
        </p>
      </div>

      <div className={styles.triadGrid}>
        <div className={styles.triadBox}>
          <span>Assault</span>
          <strong>{d.assault}</strong>
        </div>
        <div className={styles.triadBox}>
          <span>Precision</span>
          <strong>{d.precision}</strong>
        </div>
        <div className={styles.triadBox}>
          <span>Arcane</span>
          <strong>{d.arcane}</strong>
        </div>
      </div>

      <div className={isDeckReady ? styles.deckReady : styles.deckIncomplete}>
        {isDeckReady ? "✓  Deck Ready" : "⚠  Incomplete Deck"}
      </div>

      <button type="button" className={styles.btnEdit} onClick={onEditDeck}>
        {d.cardsTotal === 0 ? "Create Deck" : "Edit Deck"}
      </button>

      <button type="button" className={styles.btnLogout} onClick={handleLogout}>
        Logout
      </button>
    </section>
  );
}
