import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { GameCard, type CardModel } from "./Card";

type HandCardsProps = {
  handCards: CardModel[];
  selectedCardId: string | null;
  canPlayCard: (card: CardModel) => boolean;
  onCardClick: (card: CardModel) => void;
  cardSize?: "small" | "normal" | "large";
  onCardMount?: (cardId: string, element: HTMLDivElement | null) => void;
};

export default function HandCards({
  handCards,
  selectedCardId,
  canPlayCard,
  onCardClick,
  cardSize = "normal",
  onCardMount,
}: HandCardsProps) {
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const overlapPx = useMemo(() => {
    const cardWidth = cardSize === "small" ? 152 : cardSize === "large" ? 210 : 153;
    const cardsCount = handCards.length;
    if (cardsCount <= 1) return 0;

    const horizontalPadding = viewportWidth <= 768 ? 24 : 64;
    const available = Math.max(cardWidth, viewportWidth - horizontalPadding);
    const minStep = 72;
    const naturalStep = cardWidth;
    const fittedStep = Math.max(minStep, (available - cardWidth) / (cardsCount - 1));
    const step = Math.min(naturalStep, fittedStep);

    return Math.max(0, cardWidth - step);
  }, [cardSize, handCards.length, viewportWidth]);

  const handleCardClickWithDragCheck = useCallback(
    (card: CardModel) => {
      if (isDraggingRef.current) return;
      onCardClick(card);
    },
    [onCardClick]
  );

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, card: CardModel) => {
    isDraggingRef.current = true;
    e.dataTransfer.setData("application/json", JSON.stringify({ cardId: card.id }));
    e.dataTransfer.effectAllowed = "copy";
    const slot = e.currentTarget;
    const cardEl = slot.querySelector(".game-card") as HTMLElement | null;
    if (cardEl) {
      e.dataTransfer.setDragImage(cardEl, cardEl.offsetWidth / 2, cardEl.offsetHeight / 2);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 0);
  }, []);

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
            ref={(element) => onCardMount?.(card.id, element)}
            className={`game-hand__slot ${isSelected ? "is-selected" : ""}`}
            style={
              {
                "--slot-rotation": `${rotation}deg`,
                marginLeft: `${overlapMargin}px`,
                zIndex: isSelected ? handCards.length + 1 : index + 1
              } as CSSProperties
            }
            draggable={!isDisabled}
            onDragStart={(e) => handleDragStart(e, card)}
            onDragEnd={handleDragEnd}
          >
            <GameCard
              card={card}
              size={cardSize}
              onClick={handleCardClickWithDragCheck}
              className={isDisabled ? "is-disabled" : undefined}
            />
          </div>
        );
      })}
    </section>
  );
}
