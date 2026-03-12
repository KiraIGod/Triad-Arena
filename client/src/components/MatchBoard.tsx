import type { CSSProperties } from "react";
import { GameCard } from "./Card";
import type { PlayedBoardCard } from "../features/customHooks/useMatchBoard";

type MatchBoardProps = {
  cards: PlayedBoardCard[];
  currentUserId: string | null;
};

export default function MatchBoard({ cards, currentUserId }: MatchBoardProps) {
  const normalize = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();
  const selfCards = cards.filter((entry) => normalize(entry.playerId) === normalize(currentUserId));
  const opponentCards = cards.filter((entry) => normalize(entry.playerId) !== normalize(currentUserId));

  return (
    <section className="game-board" aria-label="Match board">
      <div className="game-board__side">
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
      <div className="game-board__side">
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
