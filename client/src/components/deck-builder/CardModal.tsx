import { useEffect } from "react";
import type { DeckBuilderCard } from "../../types/deckBuilder";

type CardModalProps = {
  card: DeckBuilderCard | null;
  isOpen: boolean;
  canAdd: boolean;
  canRemove: boolean;
  inDeck: number;
  owned: number;
  onClose: () => void;
  onAdd: () => void;
  onRemove: () => void;
};

function triadLabel(triad: string): string {
  const map: Record<string, string> = {
    assault: "Assault",
    precision: "Precision",
    arcane: "Arcane",
  };
  return map[triad] ?? triad;
}

export default function CardModal({
  card,
  isOpen,
  canAdd,
  canRemove,
  inDeck,
  owned,
  onClose,
  onAdd,
  onRemove,
}: CardModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !card) return null;

  const showStats =
    card.type !== "SPELL" && (card.attack !== null || card.hp !== null);

  return (
    <div
      className="cardModal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={card.name}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cardModal__panel">
        <button
          type="button"
          className="cardModal__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <img className="cardModal__image" src={card.image} alt={card.name} />

        <div className="cardModal__body">
          <h3 className="cardModal__name">{card.name}</h3>

          <div className="cardModal__meta">
            <span className="cardModal__tag">{card.type}</span>
            <span
              className={`cardModal__tag cardModal__tag--${card.triad_type}`}
            >
              {triadLabel(card.triad_type)}
            </span>
            <span className="cardModal__tag cardModal__tag--mana">
              Mana: {card.mana_cost}
            </span>
          </div>

          <div className="cardModal__divider" />

          <p className="cardModal__description">{card.description}</p>

          {showStats && (
            <div className="cardModal__stats">
              {card.attack !== null && (
                <div className="cardModal__stat">
                  <span className="cardModal__statLabel">ATK</span>
                  <span className="cardModal__statValue cardModal__statValue--atk">
                    {card.attack}
                  </span>
                </div>
              )}
              {card.hp !== null && (
                <div className="cardModal__stat">
                  <span className="cardModal__statLabel">HP</span>
                  <span className="cardModal__statValue cardModal__statValue--hp">
                    {card.hp}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="cardModal__meta">
            <span className="cardModal__tag">Owned: {owned}</span>
            <span className="cardModal__tag">In deck: {inDeck}</span>
          </div>
        </div>

        <div className="cardModal__actions">
          <button
            type="button"
            className="cardModal__actionBtn cardModal__actionBtn--add"
            onClick={onAdd}
            disabled={!canAdd}
          >
            Add to Deck
          </button>
          <button
            type="button"
            className="cardModal__actionBtn cardModal__actionBtn--remove"
            onClick={onRemove}
            disabled={!canRemove}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
