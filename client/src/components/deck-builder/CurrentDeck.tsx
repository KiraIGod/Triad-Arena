import type { DeckBuilderCard } from "../../types/deckBuilder";

type CurrentDeckProps = {
  deckByCardId: Record<string, number>;
  cardsById: Record<string, DeckBuilderCard>;
  totalCards: number;
  maxCards: number;
  onSelectCard: (card: DeckBuilderCard) => void;
  onRemoveCard: (cardId: string) => void;
};

export default function CurrentDeck({
  deckByCardId,
  cardsById,
  totalCards,
  maxCards,
  onSelectCard,
  onRemoveCard,
}: CurrentDeckProps) {
  const entries = Object.entries(deckByCardId)
    .filter(([, quantity]) => quantity > 0)
    .map(([cardId, quantity]) => ({
      cardId,
      quantity,
      card: cardsById[cardId],
    }))
    .filter((item) => item.card)
    .sort(
      (a, b) =>
        a.card.mana_cost - b.card.mana_cost ||
        a.card.name.localeCompare(b.card.name),
    );

  const isFull = totalCards >= maxCards;

  return (
    <section className="currentDeck">
      <div className="currentDeck__header">
        <h2 className="currentDeck__title">Your Deck</h2>
        <div
          className={`currentDeck__counter ${isFull ? "currentDeck__counter--full" : "currentDeck__counter--partial"}`}
        >
          {totalCards} / {maxCards}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="currentDeck__empty">
          Click cards on the left to add them to your deck
        </div>
      ) : (
        <ul className="currentDeck__list">
          {entries.map((entry) => (
            <li key={entry.cardId} className="currentDeck__item">
              <div
                className="currentDeck__itemInfo"
                onClick={() => onSelectCard(entry.card)}
              >
                <div className="currentDeck__itemMana">
                  {entry.card.mana_cost}
                </div>
                <div className="currentDeck__itemName">{entry.card.name}</div>
                <div className="currentDeck__itemQty">×{entry.quantity}</div>
              </div>
              <button
                type="button"
                className="currentDeck__removeBtn"
                onClick={() => onRemoveCard(entry.cardId)}
                aria-label={`Remove ${entry.card.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
