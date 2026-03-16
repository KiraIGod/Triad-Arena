import type { ReactNode } from "react";
import { motion } from "motion/react";
import "./MatchBoard.css";

type MatchBoardProps = {
  selfUnits: ReactNode;
  enemyUnits: ReactNode;
  opponentHandCount?: number;
  selfPlayedHistory?: ReactNode;
  enemyPlayedHistory?: ReactNode;
  opponentHandRef?: (element: HTMLDivElement | null) => void;
  selfUnitsRef?: (element: HTMLDivElement | null) => void;
  enemyUnitsRef?: (element: HTMLDivElement | null) => void;
  enemyHint?: ReactNode;
  enemyTargeting?: boolean;
  spellNotice?: string | null;
  spellNoticeFading?: boolean;
  spellNoticeTone?: "default" | "warning";
};

export default function MatchBoard({
  selfUnits,
  enemyUnits,
  opponentHandCount = 0,
  selfPlayedHistory = null,
  enemyPlayedHistory = null,
  opponentHandRef,
  selfUnitsRef,
  enemyUnitsRef,
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

      <aside className="battlefield-opponent-hand-col card-panel">
        <p className="battlefield-col-title">Opponent Hand</p>
        <div className="battlefield-opponent-hand-list" ref={opponentHandRef}>
          {opponentHandCount > 0 ? (
            Array.from({ length: opponentHandCount }).map((_, index) => (
              <div
                key={`opponent-hand-back-${index}`}
                className="battlefield-opponent-hand-card"
                style={{ zIndex: index + 1 }}
                aria-hidden
              >
                <div className="battlefield-opponent-hand-card__inner" />
              </div>
            ))
          ) : (
            <span className="battlefield-empty">No cards</span>
          )}
        </div>
      </aside>

      <div className="game-battlefield-main">
        <div className="battlefield-enemy-col">
          {enemyHint}
          <div
            className={`battlefield-row battlefield-row--enemy app-scrollbar${enemyTargeting ? " battlefield-row--enemy-targeting" : ""}`}
          >
            <p className="battlefield-col-title">Enemy Units</p>
            <div className="battlefield-row__content" ref={enemyUnitsRef}>
              {enemyUnits}
            </div>
          </div>
        </div>

        <div className="game-battlefield__divider" />

        <div className="battlefield-self-col">
          <div className="battlefield-row battlefield-row--self app-scrollbar">
            <p className="battlefield-col-title">My Units</p>
            <div className="battlefield-row__content" ref={selfUnitsRef}>
              {selfUnits}
            </div>
          </div>
        </div>
      </div>

      <aside className="battlefield-history-col">
        <section className="battlefield-history-panel card-panel">
          <p className="battlefield-col-title">Opponent Played</p>
          <div className="battlefield-history-list app-scrollbar">
            {enemyPlayedHistory || <span className="battlefield-empty">No cards</span>}
          </div>
        </section>

        <section className="battlefield-history-panel card-panel">
          <p className="battlefield-col-title">My Played</p>
          <div className="battlefield-history-list app-scrollbar">
            {selfPlayedHistory || <span className="battlefield-empty">No cards</span>}
          </div>
        </section>
      </aside>
    </section>
  );
}
