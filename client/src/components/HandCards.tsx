import type { CSSProperties } from "react";
import { GameCard, type CardModel } from "./Card";

type HandCardsProps = {
  handCards: CardModel[];
  selectedCardId: string | null;
  canPlayCard: (card: CardModel) => boolean;
  onCardClick: (card: CardModel) => void;
  cardSize?: "small" | "normal" | "large";
};

export default function HandCards({
  handCards,
  selectedCardId,
  canPlayCard,
  onCardClick,
  cardSize = "normal"
}: HandCardsProps) {
  return (
    <section
      className={`game-hand ${handCards.length === 0 ? "game-hand--empty" : ""}`.trim()}
      aria-label="Hand"
    >
      {handCards.length === 0 && <p className="game-hand__placeholder">No cards in hand</p>}
      {handCards.map((card, index) => {
        const isSelected = selectedCardId === card.id;
        const isDisabled = !canPlayCard(card);

        return (
          <div
            key={card.id}
            className={`game-hand__slot ${isSelected ? "is-selected" : ""}`}
            style={{ "--slot-rotation": `${(index - 2) * 2}deg` } as CSSProperties}
          >
            <GameCard card={card} size={cardSize} onClick={onCardClick} disabled={isDisabled} />
          </div>
        );
      })}
    </section>
  );
}
