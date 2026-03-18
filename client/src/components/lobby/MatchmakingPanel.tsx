import { useState } from "react"
import type { DeckSummary } from "../../types/lobby"
import styles from "./MatchmakingPanel.module.css"

type GameMode = "normal" | "ranked" | "private"

type MatchmakingPanelProps = {
  gameMode: GameMode
  deck: DeckSummary | null
  isCreatingArena: boolean
  isJoiningArena: boolean
  error: string | null
  activeMatchId: string | null
  searchTimeLeft: number
  roomCode?: string | null
  isWaitingPrivate?: boolean
  onFindMatch: () => void
  onCreateArena: () => void
  onCancelSearch: () => void
  onReconnect: () => void
  onJoinByCode?: (code: string) => void
  onCancelRoom?: () => void
}

function ReconnectBanner({ onReconnect }: { onReconnect: () => void }) {
  return (
    <div className={styles.reconnectBanner}>
      <div className={styles.reconnectIcon} aria-hidden>⚡</div>
      <p className={styles.reconnectTitle}>Active Match Found</p>
      <p className={styles.reconnectDesc}>
        You have an unfinished match. Rejoin before the timer expires!
      </p>
      <button
        type="button"
        className={styles.btnReconnect}
        onClick={onReconnect}
      >
        Reconnect
      </button>
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`
}

function SearchOverlay({
  timeLeft,
  onCancel,
}: {
  timeLeft: number
  onCancel: () => void
}) {
  return (
    <div className={styles.searchOverlay}>
      <span className={styles.searchSpinner} aria-hidden />
      <p className={styles.searchTitle}>Searching for opponent...</p>
      <p className={styles.searchTimer}>{formatTime(timeLeft)}</p>
      <div className={styles.searchBarTrack}>
        <div
          className={styles.searchBarFill}
          style={{ width: `${(timeLeft / 60) * 100}%` }}
        />
      </div>
      <button
        type="button"
        className={styles.btnCancel}
        onClick={onCancel}
      >
        Cancel Search
      </button>
    </div>
  )
}

function WaitingRoom({
  roomCode,
  onCancel,
}: {
  roomCode: string
  onCancel: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={styles.waitingRoom}>
      <span className={styles.searchSpinner} aria-hidden />
      <p className={styles.waitingTitle}>Waiting for opponent...</p>
      <p className={styles.waitingSubtitle}>Share this code with a friend</p>
      <div className={styles.roomCodeDisplay} onClick={handleCopy} title="Click to copy">
        <span className={styles.roomCodeValue}>{roomCode}</span>
        <span className={styles.roomCodeCopy}>{copied ? "Copied!" : "Copy"}</span>
      </div>
      <button
        type="button"
        className={styles.btnCancel}
        onClick={onCancel}
      >
        Cancel Room
      </button>
    </div>
  )
}

export function MatchmakingPanel({
  gameMode,
  deck,
  isCreatingArena,
  isJoiningArena,
  error,
  activeMatchId,
  searchTimeLeft,
  roomCode = null,
  isWaitingPrivate = false,
  onFindMatch,
  onCreateArena,
  onCancelSearch,
  onReconnect,
  onJoinByCode,
  onCancelRoom,
}: MatchmakingPanelProps) {
  const isDeckReady = deck != null && deck.cardsTotal >= deck.cardsMax
  const isSearching = isJoiningArena || isCreatingArena
  const hasActiveMatch = activeMatchId !== null
  const isBlocked = isSearching || !isDeckReady || hasActiveMatch
  const [inputCode, setInputCode] = useState("")

  if (isJoiningArena) {
    return (
      <div className={styles.panel}>
        <SearchOverlay timeLeft={searchTimeLeft} onCancel={onCancelSearch} />
      </div>
    )
  }

  const deckWarning = !isDeckReady && deck !== null && !hasActiveMatch && (
    <div className={styles.deckWarning}>
      ⚠&nbsp;&nbsp;Incomplete deck — fill it before entering the arena
    </div>
  )

  const reconnectBanner = hasActiveMatch && (
    <ReconnectBanner onReconnect={onReconnect} />
  )

  if (gameMode === "ranked") {
    return (
      <div className={styles.panel}>
        {reconnectBanner}
        {deckWarning}

        {!hasActiveMatch && (
          <div className={styles.modeDescription}>
            Ranked matches affect your rank. Wins increase your rating,
            losses decrease it.
          </div>
        )}

        <button
          type="button"
          className={`${styles.btnPrimary} ${styles.btnRanked} ${isBlocked ? styles.btnDimmed : ""}`}
          disabled={isBlocked}
          onClick={onFindMatch}
        >
          <span className={styles.btnIcon} aria-hidden>🏆</span>
          Ranked Match
        </button>

        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    )
  }

  if (gameMode === "private") {
    if (isWaitingPrivate && roomCode) {
      return (
        <div className={styles.panel}>
          <WaitingRoom roomCode={roomCode} onCancel={onCancelRoom ?? (() => {})} />
          {error && <p className={styles.errorText}>{error}</p>}
        </div>
      )
    }

    return (
      <div className={styles.panel}>
        {reconnectBanner}
        {deckWarning}

        {!hasActiveMatch && (
          <div className={styles.modeDescription}>
            Create a private room and share the code with a friend,
            or enter a code to join.
          </div>
        )}

        <button
          type="button"
          className={`${styles.btnPrimary} ${isBlocked ? styles.btnDimmed : ""}`}
          disabled={isBlocked}
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
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            maxLength={8}
            disabled={hasActiveMatch}
          />
          <button
            type="button"
            className={`${styles.btnSecondary} ${isBlocked || !inputCode.trim() ? styles.btnDimmed : ""}`}
            disabled={isBlocked || !inputCode.trim()}
            onClick={() => onJoinByCode?.(inputCode)}
          >
            Join
          </button>
        </div>

        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {reconnectBanner}
      {deckWarning}

      <button
        type="button"
        className={`${styles.btnPrimary} ${isBlocked ? styles.btnDimmed : ""}`}
        disabled={isBlocked}
        onClick={onFindMatch}
      >
        <span className={styles.btnIcon} aria-hidden>⚔</span>
        Find Match
      </button>

      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerText}>or</span>
        <span className={styles.dividerLine} />
      </div>

      <button
        type="button"
        className={`${styles.btnSecondary} ${isBlocked ? styles.btnDimmed : ""}`}
        disabled={isBlocked}
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
  )
}
