import type { DeckSummary } from "../../types/lobby";
import styles from "./MatchmakingPanel.module.css";

type MatchmakingPanelProps = {
  deck: DeckSummary | null;
  isCreatingArena: boolean;
  isJoiningArena: boolean;
  error: string | null;
  onFindMatch: () => void;
  onCreateArena: () => void;
  onCancelSearch: () => void;
};

export function MatchmakingPanel({
  deck,
  isCreatingArena,
  isJoiningArena,
  error,
  onFindMatch,
  onCreateArena,
  onCancelSearch
}: MatchmakingPanelProps) {
  const isDeckReady = deck != null && deck.cardsTotal >= deck.cardsMax;
  const isSearching = isJoiningArena || isCreatingArena;

  return (
    <div className={styles.panel}>
      {!isDeckReady && deck !== null && (
        <div className={styles.deckWarning}>
          ⚠&nbsp;&nbsp;Incomplete deck — fill it before entering the arena
        </div>
      )}

      <button
        type="button"
        className={`${styles.btnPrimary} ${!isDeckReady ? styles.btnDimmed : ""}`}
        disabled={isSearching || !isDeckReady}
        onClick={onFindMatch}
      >
        {isJoiningArena ? (
          <>
            <span className={styles.loader} aria-hidden />
            Searching for opponent...
          </>
        ) : (
          <>
            <span className={styles.btnIcon} aria-hidden>⚔</span>
            Find Match
          </>
        )}
      </button>

      {isJoiningArena && (
        <button type="button" className={styles.btnCancel} onClick={onCancelSearch}>
          Cancel
        </button>
      )}

      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerText}>or</span>
        <span className={styles.dividerLine} />
      </div>

      <button
        type="button"
        className={`${styles.btnSecondary} ${!isDeckReady ? styles.btnDimmed : ""}`}
        disabled={isSearching || !isDeckReady}
        onClick={onCreateArena}
      >
        {isCreatingArena ? (
          <>
            <span className={styles.loader} aria-hidden />
            Creating Arena...
          </>
        ) : (
          <>
            <span className={styles.btnIcon} aria-hidden>+</span>
            Create Arena
          </>
        )}
      </button>

      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
