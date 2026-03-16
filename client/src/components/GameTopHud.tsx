import { motion } from "motion/react";
import type { MutableRefObject } from "react";
import TurnCountdown from "./TurnCountdown";
import StatusBadges, { type StatusView } from "./StatusBadges";

type TriadComboInfo = {
  type: string;
  count: number;
  bonus: number;
};

type GameTopHudProps = {
  opponentNickname: string;
  opponentHPPercent: number;
  oppStats: {
    hp: number;
    shield: number;
    statuses?: StatusView[];
  };
  isAnyTargetingMode: boolean;
  isSelectingSpellTarget: boolean;
  isSelectingTarget: boolean;
  enemyHeroRef: MutableRefObject<HTMLDivElement | null>;
  handleEnemyHeroClick: () => void;
  enemyHeroShakeToken: number;
  enemyHeroFlashToken: number;
  isReconnecting: boolean;
  showAccessWarning: boolean;
  selfDeckCount: number;
  handCount: number;
  triadComboInfo: TriadComboInfo | null;
  matchExists: boolean;
  isMyTurn: boolean;
  isMatchFinished: boolean;
  timerRemaining: number;
  onLeaveArenaRequest: () => void;
};

export default function GameTopHud({
  opponentNickname,
  opponentHPPercent,
  oppStats,
  isAnyTargetingMode,
  isSelectingSpellTarget,
  isSelectingTarget,
  enemyHeroRef,
  handleEnemyHeroClick,
  enemyHeroShakeToken,
  enemyHeroFlashToken,
  isReconnecting,
  showAccessWarning,
  selfDeckCount,
  handCount,
  triadComboInfo,
  matchExists,
  isMyTurn,
  isMatchFinished,
  timerRemaining,
  onLeaveArenaRequest,
}: GameTopHudProps) {
  return (
    <>
      <header className="game-hud game-hud--top parchment-panel">
        <div className="game-hud__identity">
          <div className="game-hud__accent game-hud__accent--blood" />
          <div>
            <p className="game-hud__name comic-text-shadow">{opponentNickname}</p>
            <p className="game-hud__rank">Rank IV - Cultist</p>
          </div>
        </div>

        <div
          className={`game-hp${isAnyTargetingMode ? " game-hp--attackable" : ""}`}
          ref={enemyHeroRef}
          onClick={handleEnemyHeroClick}
          title={
            isSelectingSpellTarget
              ? "Cast spell on enemy hero"
              : isSelectingTarget
                ? "Attack enemy hero"
                : undefined
          }
          style={{ cursor: isAnyTargetingMode ? "crosshair" : undefined }}
        >
          <motion.div
            key={`enemy-hero-shake-${enemyHeroShakeToken}`}
            initial={{ x: 0 }}
            animate={enemyHeroShakeToken > 0 ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="game-hp__content"
          >
            {enemyHeroFlashToken > 0 && (
              <motion.span
                key={`enemy-hero-flash-${enemyHeroFlashToken}`}
                className="game-state__hit-flash"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: [0, 0.9, 0], scale: [0.94, 1.04, 1] }}
                transition={{ duration: 0.34, ease: "easeOut" }}
              />
            )}
            <div className="game-hp__meta">
              <span>Death&apos;s Door</span>
              <strong className="comic-text-shadow">
                {Math.round(opponentHPPercent)}% | HP {oppStats.hp} | SH {oppStats.shield}
              </strong>
            </div>
            <div className="game-hp__track ink-border-thin">
              <div
                className="game-hp__fill game-hp__fill--enemy blood-glow"
                style={{ width: `${opponentHPPercent}%` }}
              />
            </div>
          </motion.div>
        </div>

        <div className="game-state">
          <div className="game-state__content">
            <p className="game-state__label">Opponent Status</p>
            <p className="game-state__value">
              {(oppStats.statuses || []).length
                ? <StatusBadges statuses={oppStats.statuses} />
                : isSelectingSpellTarget ? "\u2190 Click to target hero"
                : isSelectingTarget ? "\u2190 Click to attack hero"
                : "None"}
            </p>
          </div>
        </div>
      </header>

      {isReconnecting && (
        <div className="game-state">
          <p className="game-state__label">Connection</p>
          <p className="game-state__value">Reconnecting...</p>
        </div>
      )}

      {showAccessWarning && (
        <div className="game-state">
          <p className="game-state__label">Access</p>
          <p className="game-state__value">You are not part of this match</p>
        </div>
      )}

      <div className="game-top-row">
        <aside className="game-deck-panel">
          <p className="game-log__entry">Deck: {selfDeckCount}</p>
          <p className="game-log__entry">Hand: {handCount}</p>

          {triadComboInfo && (
            <div className={`game-triad-combo game-triad-combo--${triadComboInfo.type}`}>
              <span className="game-triad-combo__label">Triad Combo</span>
              <span className="game-triad-combo__type">
                {triadComboInfo.type.toUpperCase()} \u00D7{triadComboInfo.count}
              </span>
              <span className="game-triad-combo__bonus">+{triadComboInfo.bonus} DMG</span>
            </div>
          )}
        </aside>

        <div className="game-state game-state--turn">
          <div className="game-state__turn-row">
            {matchExists
              ? isMyTurn
                ? <p className="game-hud__name game-state__value--active-turn comic-text-shadow">Your turn</p>
                : <p className="game-hud__name game-state__value comic-text-shadow">Opponent&apos;s turn</p>
              : "-"}
          </div>
          {matchExists && !isMatchFinished ? (
            isMyTurn
              ? (
                <p className="game-hud__name game-state__value--active-turn comic-text-shadow">
                  <TurnCountdown remaining={timerRemaining} />
                </p>
              )
              : (
                <p className="game-hud__name game-state__value comic-text-shadow">
                  <TurnCountdown remaining={timerRemaining} />
                </p>
              )
          ) : null}
        </div>

        <div className="game-state game-state--right">
          <button type="button" className="game-end-turn stress-warning" onClick={onLeaveArenaRequest}>
            Leave Arena
          </button>
        </div>
      </div>
    </>
  );
}
