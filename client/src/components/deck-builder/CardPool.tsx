import type { DeckBuilderCard } from "../../types/deckBuilder";

type CardPoolProps = {
  cards: DeckBuilderCard[];
  collectionByCardId: Record<string, number>;
  deckByCardId: Record<string, number>;
  onSelectCard: (card: DeckBuilderCard) => void;
};

export default function CardPool({
  cards,
  collectionByCardId,
  deckByCardId,
  onSelectCard
}: CardPoolProps) {
  return (
    <section>
      <h2>Card Pool</h2>
      <ul>
        {cards.map((card) => {
          const owned = collectionByCardId[card.id] ?? 0;
          const inDeck = deckByCardId[card.id] ?? 0;
          return (
            <li key={card.id}>
              <button type="button" onClick={() => onSelectCard(card)}>
                {card.name} | {card.type} | Mana: {card.mana_cost} | Copies: {owned} | In deck: {inDeck}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
