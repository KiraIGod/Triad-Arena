import type { DeckBuilderCard } from "../../types/deckBuilder";

type CurrentDeckProps = {
  deckByCardId: Record<string, number>;
  cardsById: Record<string, DeckBuilderCard>;
  totalCards: number;
  maxCards: number;
};

export default function CurrentDeck({
  deckByCardId,
  cardsById,
  totalCards,
  maxCards
}: CurrentDeckProps) {
  const entries = Object.entries(deckByCardId)
    .filter(([, quantity]) => quantity > 0)
    .map(([cardId, quantity]) => ({
      cardId,
      quantity,
      card: cardsById[cardId]
    }))
    .filter((item) => item.card);

  return (
    <section>
      <h2>Current Deck</h2>
      <p>
        {totalCards} / {maxCards}
      </p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.cardId}>
            {entry.card.name} | {entry.card.type} | Mana: {entry.card.mana_cost} | Copies: {entry.quantity}
          </li>
        ))}
      </ul>
    </section>
  );
}
