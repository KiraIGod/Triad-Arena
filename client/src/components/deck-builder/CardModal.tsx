import type { DeckBuilderCard } from "../../types/deckBuilder";

type CardModalProps = {
  card: DeckBuilderCard | null;
  isOpen: boolean;
  canAdd: boolean;
  canRemove: boolean;
  onClose: () => void;
  onAdd: () => void;
  onRemove: () => void;
};

export default function CardModal({
  card,
  isOpen,
  canAdd,
  canRemove,
  onClose,
  onAdd,
  onRemove,
}: CardModalProps) {
  if (!isOpen || !card) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Card details">
      <div>
        <img src={card.image} alt={card.name} width={240} />
        <h3>{card.name}</h3>
        <p>Type: {card.type}</p>
        <p>Mana: {card.mana_cost}</p>
        <p>{card.description}</p>
        <button type="button" onClick={onAdd} disabled={!canAdd}>
          Add to Deck
        </button>
        <button type="button" onClick={onRemove} disabled={!canRemove}>
          Remove
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
