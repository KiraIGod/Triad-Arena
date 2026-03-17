import { motion, useAnimationControls } from "motion/react";
import { useEffect } from "react";
import type { MutableRefObject } from "react";
import StatusBadges, { type StatusView } from "./StatusBadges";

type GameBottomHudProps = {
  displayName: string;
  playerHPPercent: number;
  selfStats: {
    hp: number;
    shield: number;
    statuses?: StatusView[];
  };
  currentEnergy: number;
  isMyTurn: boolean;
  matchExists: boolean;
  isMatchFinished: boolean;
  onEndTurnClick: () => void;
  heroRef?: MutableRefObject<HTMLDivElement | null>;
  heroShakeToken?: number;
  heroFlashToken?: number;
};

export default function GameBottomHud({
  displayName,
  playerHPPercent,
  selfStats,
  currentEnergy,
  isMyTurn,
  matchExists,
  isMatchFinished,
  onEndTurnClick,
  heroRef,
  heroShakeToken = 0,
  heroFlashToken = 0,
}: GameBottomHudProps) {
  const heroShakeControls = useAnimationControls();

  useEffect(() => {
    if (heroShakeToken <= 0) return;

    heroShakeControls.start({
      x: [0, -6, 6, -4, 4, 0],
      transition: { duration: 0.24, ease: "easeOut" },
    });
  }, [heroShakeControls, heroShakeToken]);

  return (
    <motion.footer
      className="game-hud game-hud--bottom parchment-panel"
      ref={heroRef}
      initial={{ x: 0 }}
      animate={heroShakeControls}
    >
      {heroFlashToken > 0 && (
        <motion.span
          key={`self-hero-flash-${heroFlashToken}`}
          className="game-state__hit-flash"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.94, 1.04, 1] }}
          transition={{ duration: 0.34, ease: "easeOut" }}
        />
      )}
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
          <strong className="comic-text-shadow">
            {Math.round(playerHPPercent)}% | HP {selfStats.hp} | SH {selfStats.shield} | EN {currentEnergy}
          </strong>
        </div>
        <div className="game-hp__track ink-border-thin">
          <div className="game-hp__fill game-hp__fill--player" style={{ width: `${playerHPPercent}%` }} />
        </div>
      </div>

      <div className="game-actions">
        <div className="game-state">
          <p className="game-state__label">Your Status</p>
          <p className="game-state__value">
            <StatusBadges statuses={selfStats.statuses} />
          </p>
        </div>
        <div className="game-energy" aria-label="Resolve">
          {Array.from({ length: 10 }).map((_, index) => (
            <span key={index} className={`game-energy__pip ${index < currentEnergy ? "is-active" : ""}`} />
          ))}
        </div>
        <button
          type="button"
          className="game-end-turn stress-warning"
          onClick={onEndTurnClick}
          disabled={!isMyTurn || !matchExists || isMatchFinished}
        >
          End Turn
        </button>
      </div>
    </motion.footer>
  );
}
