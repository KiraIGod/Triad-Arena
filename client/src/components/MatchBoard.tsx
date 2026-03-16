import type { ReactNode } from "react";
import { motion } from "motion/react";
import type { PlayedBoardCard } from "../features/customHooks/useMatchBoard";
import "./MatchBoard.css";

type MatchBoardProps = {
  cards: PlayedBoardCard[];
  currentUserId: string | null;
  selfUnits: ReactNode;
  enemyUnits: ReactNode;
  hiddenSelfCardIds?: string[];
  selfPlayedRef?: (element: HTMLDivElement | null) => void;
  enemyHint?: ReactNode;
  enemyTargeting?: boolean;
  spellNotice?: string | null;
  spellNoticeFading?: boolean;
  spellNoticeTone?: "default" | "warning";
};

export default function MatchBoard({
  cards: _cards,
  currentUserId: _currentUserId,
  selfUnits,
  enemyUnits,
  hiddenSelfCardIds: _hiddenSelfCardIds,
  selfPlayedRef,
  enemyHint = null,
  enemyTargeting = false,
  spellNotice = null,
  spellNoticeFading = false,
  spellNoticeTone = "default"
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


      <div className={`battlefield-board${enemyTargeting ? " battlefield-board--targeting" : ""}`} ref={selfPlayedRef}>
        {enemyHint}
        <p className="battlefield-col-title">Enemy Units</p>
        {enemyUnits}

        <div className="battlefield-board__divider" />

        <p className="battlefield-col-title">My Units</p>
        {selfUnits}
      </div>
    </section>
  );
}


