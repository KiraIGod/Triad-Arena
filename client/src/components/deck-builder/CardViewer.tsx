import { useCallback, useEffect, useState } from "react";
import type { DeckBuilderCard } from "../../types/deckBuilder";

type CardViewerProps = {
  cards: DeckBuilderCard[];
  collectionByCardId: Record<string, number>;
  deckByCardId: Record<string, number>;
  onAddCard: (cardId: string) => void;
  onRemoveCard: (cardId: string) => void;
  canAddCard: (cardId: string) => boolean;
  canRemoveCard: (cardId: string) => boolean;
  onClose: () => void;
};

function triadLabel(triad: string): string {
  const map: Record<string, string> = {
    assault: "Assault",
    precision: "Precision",
    arcane: "Arcane",
  };
  return map[triad] ?? triad;
}

export default function CardViewer({
  cards,
  collectionByCardId,
  deckByCardId,
  onAddCard,
  onRemoveCard,
  canAddCard,
  canRemoveCard,
  onClose,
}: CardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  }, [cards.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  }, [cards.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowRight":
          goNext();
          break;
        case "ArrowLeft":
          goPrev();
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  if (cards.length === 0) return null;

  const card = cards[currentIndex];
  const owned = collectionByCardId[card.id] ?? 0;
  const inDeck = deckByCardId[card.id] ?? 0;
  const showStats =
    card.type !== "SPELL" && (card.attack !== null || card.hp !== null);

  return (
    <div
      className="cardViewer__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Режим просмотра"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cardViewer__panel">
        <button
          type="button"
          className="cardViewer__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ✕
        </button>

        <div className="cardViewer__counter">
          {currentIndex + 1} / {cards.length}
        </div>

        <img className="cardViewer__image" src={card.image} alt={card.name} />

        <div className="cardViewer__body">
          <h3 className="cardViewer__name">{card.name}</h3>

          <div className="cardViewer__meta">
            <span className="cardViewer__tag">{card.type}</span>
            <span
              className={`cardViewer__tag cardViewer__tag--${card.triad_type}`}
            >
              {triadLabel(card.triad_type)}
            </span>
            <span className="cardViewer__tag cardViewer__tag--mana">
              Mana: {card.mana_cost}
            </span>
          </div>

          <div className="cardViewer__divider" />

          <p className="cardViewer__description">{card.description}</p>

          {showStats && (
            <div className="cardViewer__stats">
              {card.attack !== null && (
                <div className="cardViewer__stat">
                  <span className="cardViewer__statLabel">ATK</span>
                  <span className="cardViewer__statValue cardViewer__statValue--atk">
                    {card.attack}
                  </span>
                </div>
              )}
              {card.hp !== null && (
                <div className="cardViewer__stat">
                  <span className="cardViewer__statLabel">HP</span>
                  <span className="cardViewer__statValue cardViewer__statValue--hp">
                    {card.hp}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="cardViewer__meta">
            <span className="cardViewer__tag">Owned: {owned}</span>
            <span className="cardViewer__tag">In deck: {inDeck}</span>
          </div>
        </div>

        <div className="cardViewer__actions">
          <button
            type="button"
            className="cardViewer__actionBtn cardViewer__actionBtn--add"
            onClick={() => onAddCard(card.id)}
            disabled={!canAddCard(card.id)}
          >
            Добавить в деку
          </button>
          <button
            type="button"
            className="cardViewer__actionBtn cardViewer__actionBtn--remove"
            onClick={() => onRemoveCard(card.id)}
            disabled={!canRemoveCard(card.id)}
          >
            Удалить из деки
          </button>
        </div>

        <div className="cardViewer__nav">
          <button
            type="button"
            className="cardViewer__navBtn"
            onClick={goPrev}
          >
            ← Предыдущая
          </button>
          <button
            type="button"
            className="cardViewer__navBtn"
            onClick={goNext}
          >
            Следующая →
          </button>
        </div>
      </div>
    </div>
  );
}
