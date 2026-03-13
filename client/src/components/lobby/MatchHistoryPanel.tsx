import type { MatchHistoryEntry } from "../../shared/api/lobbyApi";
import styles from "./MatchHistoryPanel.module.css";

type MatchHistoryPanelProps = {
  matches: MatchHistoryEntry[];
  loading: boolean;
  error: string | null;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function MatchHistoryPanel({ matches, loading, error }: MatchHistoryPanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.diamond} />
        <span className={styles.label}>Battle Chronicle</span>
        <span className={styles.line} />
      </div>

      <div className={`${styles.listWrap} app-scrollbar`}>
        {loading && (
          <div className={styles.stateBox}>
            <span className={styles.loader} aria-hidden />
            <p className={styles.stateText}>Loading history...</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.stateBox}>
            <p className={styles.stateError}>{error}</p>
          </div>
        )}

        {!loading && !error && matches.length === 0 && (
          <div className={styles.stateBox}>
            <p className={styles.stateEmpty}>No battles recorded yet</p>
          </div>
        )}

        {!loading && !error && matches.map((m, i) => (
          <div key={m.matchId ?? i} className={styles.matchCard}>
            <span
              className={m.result === "Victory" ? styles.indicatorVictory : styles.indicatorDefeat}
              aria-hidden
            />
            <div className={styles.matchMain}>
              <div className={styles.matchRow}>
                <span className={styles.opponent}>{m.opponent}</span>
                <span className={m.result === "Victory" ? styles.resultVictory : styles.resultDefeat}>
                  {m.result}
                </span>
              </div>
              <div className={styles.matchRow}>
                <span className={styles.meta}>{formatDate(m.date)}</span>
                <span className={styles.meta}>Turns: {m.turns}</span>
              </div>
            </div>
            <div className={styles.hpBox}>
              <span className={styles.hpLabel}>HP Left</span>
              <strong className={styles.hpValue}>{m.hpLeft}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
