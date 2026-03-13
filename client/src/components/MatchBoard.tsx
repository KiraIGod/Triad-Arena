import type { CSSProperties, ReactNode } from "react";
import { GameCard } from "./Card";
import type { PlayedBoardCard } from "../features/customHooks/useMatchBoard";

type MatchBoardProps = {
  cards: PlayedBoardCard[];
  currentUserId: string | null;
  selfUnits: ReactNode;
  enemyUnits: ReactNode;
  selfHint?: ReactNode;
  enemyHint?: ReactNode;
  enemyTargeting?: boolean;
  spellNotice?: string | null;
  spellNoticeFading?: boolean;
  spellNoticeTone?: "default" | "warning";
};

export default function MatchBoard({
  cards,
  currentUserId,
  selfUnits,
  enemyUnits,
  selfHint = null,
  enemyHint = null,
  enemyTargeting = false,
  spellNotice = null,
  spellNoticeFading = false,
  spellNoticeTone = "default"
}: MatchBoardProps) {
  const normalize = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();
  const selfCards = cards.filter((entry) => normalize(entry.playerId) === normalize(currentUserId));
  const opponentCards = cards.filter((entry) => normalize(entry.playerId) !== normalize(currentUserId));

  return (
    <section className="game-battlefield-layout" aria-label="Match board">
      {spellNotice && (
        <div className={`game-spell-notice game-spell-notice--board game-spell-notice--${spellNoticeTone}${spellNoticeFading ? " is-fading" : ""}`}>
          <span>{spellNotice}</span>
        </div>
      )}


      <div className="game-board__side game-board__side--self">
        <p className="game-board__title">My Played Cards</p>
        <div className="game-board__cards">
          {selfCards.map((entry, index) => (
            <div
              key={`${entry.card.id}-self-board-${index}`}
              className="game-board__card-slot"
              style={{ "--card-enter-delay": `${index * 60}ms` } as CSSProperties}
            >
              <GameCard card={entry.card} size="small" disabled />
            </div>
          ))}
        </div>
      </div>

      <div className="battlefield-self-col">
        {selfHint}
        <div className="battlefield-row battlefield-row--self">
          <p className="battlefield-col-title">My Units</p>
          {selfUnits}
        </div>
      </div>

      <div className="battlefield-enemy-col">
        {enemyHint}
        <div className={`battlefield-row battlefield-row--enemy${enemyTargeting ? " battlefield-row--enemy-targeting" : ""}`}>
          <p className="battlefield-col-title">Enemy Units</p>
          {enemyUnits}
        </div>
      </div>

      <div className="game-board__side game-board__side--opponent">
        <p className="game-board__title">Opponent Played Cards</p>
        <div className="game-board__cards">
          {opponentCards.map((entry, index) => (
            <div
              key={`${entry.card.id}-opp-board-${index}`}
              className="game-board__card-slot"
              style={{ "--card-enter-delay": `${index * 60}ms` } as CSSProperties}
            >
              <GameCard card={entry.card} size="small" disabled />
            </div>
          ))}
        </div>
      </div>


    </section>
  );
}
