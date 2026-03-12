import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const overlapPx = useMemo(() => {
    const cardWidth = cardSize === "small" ? 152 : cardSize === "large" ? 210 : 180;
    const cardsCount = handCards.length;
    if (cardsCount <= 1) return 0;

    const horizontalPadding = viewportWidth <= 768 ? 24 : 64;
    const available = Math.max(cardWidth, viewportWidth - horizontalPadding);
    const minStep = 36;
    const naturalStep = cardWidth;
    const fittedStep = Math.max(minStep, (available - cardWidth) / (cardsCount - 1));
    const step = Math.min(naturalStep, fittedStep);

    return Math.max(0, cardWidth - step);
  }, [cardSize, handCards.length, viewportWidth]);

  return (
    <section
      className={`game-hand ${handCards.length === 0 ? "game-hand--empty" : ""}`.trim()}
      style={{ "--hand-overlap": `${overlapPx}px` } as CSSProperties}
      aria-label="Hand"
    >
      {handCards.length === 0 && <p className="game-hand__placeholder">No cards in hand</p>}
      {handCards.map((card, index) => {
        const isSelected = selectedCardId === card.id;
        const isDisabled = !canPlayCard(card);
        const rotation = (index - (handCards.length - 1) / 2) * 2;
        const overlapMargin = index === 0 ? 0 : -overlapPx;

        return (
          <div
            key={card.id}
            className={`game-hand__slot ${isSelected ? "is-selected" : ""}`}
            style={
              {
                "--slot-rotation": `${rotation}deg`,
                marginLeft: `${overlapMargin}px`,
                zIndex: isSelected ? handCards.length + 1 : index + 1
              } as CSSProperties
            }
          >
            <GameCard card={card} size={cardSize} onClick={onCardClick} disabled={isDisabled} />
          </div>
        );
      })}
    </section>
  );
}
