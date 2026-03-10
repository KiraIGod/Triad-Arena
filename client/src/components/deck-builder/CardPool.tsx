import { useMemo, useState } from "react";
import type { DeckBuilderCard } from "../../types/deckBuilder";

type CardPoolProps = {
  cards: DeckBuilderCard[];
  collectionByCardId: Record<string, number>;
  deckByCardId: Record<string, number>;
  maxDeckSize: number;
  maxCopiesPerCard: number;
  totalCards: number;
  onAddCard: (cardId: string) => void;
};

type SortKey = "mana" | "type" | "nameDesc";

function triadModifier(triad: string): string {
  const map: Record<string, string> = {
    assault: "assault",
    precision: "precision",
    arcane: "arcane",
  };
  return map[triad] ?? "";
}

export default function CardPool({
  cards,
  collectionByCardId,
  deckByCardId,
  maxDeckSize,
  maxCopiesPerCard,
  totalCards,
  onAddCard,
}: CardPoolProps) {
  const [sortKey, setSortKey] = useState<SortKey>("mana");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAndSortedCards = useMemo(() => {
    const filtered = cards.filter((card) => {
      const query = searchQuery.trim().toLowerCase()
      const isNumber = /^\d+$/.test(query)

      if (isNumber) {
        return card.mana_cost === parseInt(query, 10)
      }

      if (query === "spell" || query === "unit") {
        return card.type.toLowerCase() === query
      }

      return card.name.toLowerCase().includes(query)
    })

    switch (sortKey) {
      case "mana":
        return filtered.sort((a, b) => a.mana_cost - b.mana_cost)

      case "type":
        return filtered.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name)
          }
          return a.type.localeCompare(b.type)
        })

      case "nameDesc":
        return filtered.sort((a, b) => a.name.localeCompare(b.name))

      default:
        return filtered
    }
  }, [cards, sortKey, searchQuery])

  return (
    <section className="cardPool">
      <div className="cardPool__header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <h2 className="cardPool__title" style={{ margin: 0 }}>
            Card Pool
          </h2>
          <span className="cardPool__count">
            {filteredAndSortedCards.length} cards
          </span>
        </div>

        <div
          className="cardPool__controls"
          style={{
            display: "flex",
            gap: "15px",
            marginBottom: "15px",
          }}
        >
          <div className="cardPool__search">
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                background: "transparent",
                color: "inherit",
              }}
            />
          </div>

          <div className="cardPool__sort">
            <label style={{ marginRight: 8 }}>Sort by:</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              style={{
                padding: "4px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                background: "transparent",
                color: "inherit",
              }}
            >
              <option value="mana">Mana cost</option>
              <option value="type">Type</option>
              <option value="nameDesc">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="cardPool__grid">
        {filteredAndSortedCards.map((card) => {
          const owned = collectionByCardId[card.id] ?? 0;
          const inDeck = deckByCardId[card.id] ?? 0;
          const modifier = triadModifier(card.triad_type);

          return (
            <button
              key={card.id}
              type="button"
              className={`poolCard ${modifier ? `poolCard--${modifier}` : ""} ${inDeck >= owned || totalCards >= maxDeckSize ? "poolCard--exhausted" : inDeck >= maxCopiesPerCard ? "poolCard--copiesMax" : inDeck > 0 ? "poolCard--inDeck" : ""}`}
              onClick={() => onAddCard(card.id)}
            >
              <div className="poolCard__mana">{card.mana_cost}</div>
              <div className="poolCard__name">{card.name}</div>
              <div className="poolCard__type">{card.type}</div>

              {card.type !== "SPELL" &&
                (card.attack !== null || card.hp !== null) && (
                  <div className="poolCard__stats">
                    {card.attack !== null && (
                      <span className="poolCard__stat--atk">
                        ATK {card.attack}
                      </span>
                    )}
                    {card.hp !== null && (
                      <span className="poolCard__stat--hp">HP {card.hp}</span>
                    )}
                  </div>
                )}

              <div className="poolCard__copies">
                Owned: {owned} &middot; In deck: <span>{inDeck}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
