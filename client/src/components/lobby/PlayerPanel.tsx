import type { DeckSummary } from "../../types/lobby";
import type { PlayerStats } from "../../shared/api/lobbyApi";
import styles from "./PlayerPanel.module.css";
import { FriendList } from "./FriendList";

type PlayerPanelProps = {
  nickname: string;
  stats: PlayerStats | null;
  deck: DeckSummary | null;
  onEditDeck: () => void;
  privateArenaId?: string | null;
  onSendInvite?: (arenaId: string, targetUserId: string) => Promise<{ error?: string }>;
  onInviteResult?: (res: { error?: string }) => void;
};

export function PlayerPanel({
  nickname,
  stats,
  deck,
  onEditDeck,
  privateArenaId,
  onSendInvite,
  onInviteResult,
}: PlayerPanelProps) {
  const d = deck ?? {
    name: "—",
    cardsTotal: 0,
    cardsMax: 20,
    assault: 0,
    precision: 0,
    arcane: 0,
  };
  const isDeckReady = d.cardsTotal >= d.cardsMax;

  const winrate =
    stats && stats.games_played > 0
      ? ((stats.wins / stats.games_played) * 100).toFixed(1)
      : "0.0";

  const ratingDisplay = stats ? stats.rating.toLocaleString() : "—";
  const rankDisplay = stats?.rank != null ? `#${stats.rank}` : "—";

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.diamond} />
        <span className={styles.label}>{nickname}</span>
        <span className={styles.line} />
      </div>

      <div className={styles.ratingCard}>
        <p className={styles.kicker}>Rating</p>
        <p className={styles.ratingNumber}>{ratingDisplay}</p>
        <div className={styles.ratingMeta}>
          <span className={styles.rankBadge}>{rankDisplay}</span>
          <span className={styles.winrate}>{winrate}% winrate</span>
        </div>
        {stats && (
          <div className={styles.statsRow}>
            <span className={styles.statWins}>{stats.wins}W</span>
            <span className={styles.statSep}>/</span>
            <span className={styles.statLosses}>{stats.losses}L</span>
            <span className={styles.statSep}>/</span>
            <span className={styles.statGames}>{stats.games_played} games</span>
          </div>
        )}
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

      <div style={{ marginTop: "20px" }}>
        <FriendList privateArenaId={privateArenaId} onSendInvite={onSendInvite} onInviteResult={onInviteResult} />
      </div>
    </section>
  );
}
