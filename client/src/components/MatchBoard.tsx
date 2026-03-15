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
  selfUnitsRef?: (element: HTMLDivElement | null) => void;
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
  selfUnitsRef,
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


      {/* ── Enemy half (top) ──────────────────────────────────── */}
      <div className="battlefield-enemy-col">
        {enemyHint}
        <div className={`battlefield-row battlefield-row--enemy app-scrollbar${enemyTargeting ? " battlefield-row--enemy-targeting" : ""}`}>
          <p className="battlefield-col-title">Enemy Units</p>
          {enemyUnits}
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────────────── */}
      <div className="game-battlefield__divider" />

      {/* ── Center: empty (fly target for card animation only) ─── */}
      <div className="game-board__center" ref={selfPlayedRef} aria-hidden />

      {/* ── Divider ───────────────────────────────────────────── */}
      <div className="game-battlefield__divider" />

      {/* ── Self half (bottom) ────────────────────────────────── */}
      <div className="battlefield-self-col">
        <div className="battlefield-row battlefield-row--self app-scrollbar" ref={selfUnitsRef}>
          <p className="battlefield-col-title">My Units</p>
          {selfUnits}
        </div>
      </div>
    </section>
  );
}


