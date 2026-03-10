import { useState } from "react";
import type { DeckSummary } from "../../types/lobby";
import styles from "./MatchmakingPanel.module.css";

type GameMode = "normal" | "ranked" | "private";

type MatchmakingPanelProps = {
  gameMode: GameMode;
  deck: DeckSummary | null;
  isCreatingArena: boolean;
  isJoiningArena: boolean;
  error: string | null;
  onFindMatch: () => void;
  onCreateArena: () => void;
  onCancelSearch: () => void;
};

export function MatchmakingPanel({
  gameMode,
  deck,
  isCreatingArena,
  isJoiningArena,
  error,
  onFindMatch,
  onCreateArena,
  onCancelSearch,
}: MatchmakingPanelProps) {
  const isDeckReady = deck != null && deck.cardsTotal >= deck.cardsMax;
  const isSearching = isJoiningArena || isCreatingArena;
  const [roomCode, setRoomCode] = useState("");

  const deckWarning = !isDeckReady && deck !== null && (
    <div className={styles.deckWarning}>
      ⚠&nbsp;&nbsp;Incomplete deck — fill it before entering the arena
    </div>
  );

  if (gameMode === "ranked") {
    return (
      <div className={styles.panel}>
        {deckWarning}

        <div className={styles.modeDescription}>
          Ranked matches affect your rank. Wins increase your rating,
          losses decrease it.
        </div>

        <button
          type="button"
          className={`${styles.btnPrimary} ${styles.btnRanked} ${!isDeckReady ? styles.btnDimmed : ""}`}
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
              <span className={styles.btnIcon} aria-hidden>🏆</span>
              Ranked Match
            </>
          )}
        </button>

        {isJoiningArena && (
          <button type="button" className={styles.btnCancel} onClick={onCancelSearch}>
            Cancel
          </button>
        )}

        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }

  if (gameMode === "private") {
    return (
      <div className={styles.panel}>
        {deckWarning}

        <div className={styles.modeDescription}>
          Create a private room and share the code with a friend,
          or enter a code to join.
        </div>

        <button
          type="button"
          className={`${styles.btnPrimary} ${!isDeckReady ? styles.btnDimmed : ""}`}
          disabled={isSearching || !isDeckReady}
          onClick={onCreateArena}
        >
          {isCreatingArena ? (
            <>
              <span className={styles.loader} aria-hidden />
              Creating Room...
            </>
          ) : (
            <>
              <span className={styles.btnIcon} aria-hidden>+</span>
              Create Room
            </>
          )}
        </button>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>or</span>
          <span className={styles.dividerLine} />
        </div>

        <div className={styles.roomCodeRow}>
          <input
            type="text"
            className={styles.roomCodeInput}
            placeholder="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={8}
          />
          <button
            type="button"
            className={`${styles.btnSecondary} ${!isDeckReady || !roomCode.trim() ? styles.btnDimmed : ""}`}
            disabled={isSearching || !isDeckReady || !roomCode.trim()}
            onClick={onFindMatch}
          >
            Join
          </button>
        </div>

        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {deckWarning}

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
