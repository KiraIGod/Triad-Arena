import type { ReactNode } from "react";
import { motion } from "motion/react";
import "./MatchBoard.css";

type MatchBoardProps = {
  selfUnits: ReactNode;
  enemyUnits: ReactNode;
  selfUnitsRef?: (element: HTMLDivElement | null) => void;
  enemyHint?: ReactNode;
  enemyTargeting?: boolean;
  spellNotice?: string | null;
  spellNoticeFading?: boolean;
  spellNoticeTone?: "default" | "warning";
};

export default function MatchBoard({
  selfUnits,
  enemyUnits,
  selfUnitsRef,
  enemyHint = null,
  enemyTargeting = false,
  spellNotice = null,
  spellNoticeFading = false,
  spellNoticeTone = "default",
}: MatchBoardProps) {
  return (
    <section className="game-battlefield-layout" aria-label="Match board">
      {spellNotice && (
        <div className="game-spell-notice-overlay">
          <motion.div
            className={`game-spell-notice game-spell-notice--board game-spell-notice--${spellNoticeTone}`}
            initial={{ opacity: 0, y: 10 }}
            animate={spellNoticeFading ? { opacity: 0, y: 0 } : { opacity: 1, y: 0 }}
            transition={{ duration: spellNoticeFading ? 2 : 0.2, ease: "easeOut" }}
          >
            <span>{spellNotice}</span>
          </motion.div>
        </div>
      )}

      <div className="battlefield-enemy-col">
        {enemyHint}
        <div className={`battlefield-row battlefield-row--enemy app-scrollbar${enemyTargeting ? " battlefield-row--enemy-targeting" : ""}`}>
          <p className="battlefield-col-title">Enemy Units</p>
          {enemyUnits}
        </div>
      </div>

      <div className="game-battlefield__divider" />

      <div className="battlefield-self-col">
        <div className="battlefield-row battlefield-row--self app-scrollbar" ref={selfUnitsRef}>
          <p className="battlefield-col-title">My Units</p>
          {selfUnits}
        </div>
      </div>
    </section>
  );
}
