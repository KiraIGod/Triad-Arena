import { useMemo, useState } from 'react'
import type { DeckBuilderCard } from "../../types/deckBuilder"

type CardPoolProps = {
  cards: DeckBuilderCard[]
  collectionByCardId: Record<string, number>
  deckByCardId: Record<string, number>
  maxDeckSize: number
  totalCards: number
  onAddCard: (cardId: string) => void
  onSelectCard: (card: DeckBuilderCard) => void
}

type SortKey = 'mana' | 'type' | 'nameDesc'

function triadModifier(triad: string): string {
  const map: Record<string, string> = {
    assault: "assault",
    precision: "precision",
    arcane: "arcane",
  }
  return map[triad] ?? ""
}

export default function CardPool({
  cards,
  collectionByCardId,
  deckByCardId,
  maxDeckSize,
  totalCards,
  onAddCard,
  onSelectCard,
}: CardPoolProps) {
  const [sortKey, setSortKey] = useState<SortKey>('mana')

  const sortedCards = useMemo(() => {
    const copied = [...cards]

    switch (sortKey) {
      case 'mana':
        return copied.sort((a, b) => a.mana_cost - b.mana_cost)

      case 'type':
        return copied.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name)
          }
          return a.type.localeCompare(b.type)
        })
      case 'nameDesc':
        return copied.sort((a, b) => b.name.localeCompare(a.name))
      default:
        return copied
    }
  }, [cards, sortKey])

  return (
    <section className="cardPool">
      <div className="cardPool__header">
        <h2 className="cardPool__title">Card Pool</h2>
        <span className="cardPool__count">{cards.length} cards</span>

        <div className='cardPool__sort'>
          <label style={{ marginRight: 8 }}>Sort by:</label>
          <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value='mana'>Mana cost</option>
            <option value='type'>Type</option>
            <option value='nameDesc'>Name (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="cardPool__grid">
        {sortedCards.map((card) => {
          const owned = collectionByCardId[card.id] ?? 0;
          const inDeck = deckByCardId[card.id] ?? 0;
          const modifier = triadModifier(card.triad_type);
          const exhausted = inDeck >= owned || totalCards >= maxDeckSize;

          return (
            <div
              key={card.id}
              className={`poolCard ${modifier ? `poolCard--${modifier}` : ""} ${exhausted ? "poolCard--exhausted" : ""}`}
              onClick={() => !exhausted && onAddCard(card.id)}
            >
              <div className="poolCard__mana">{card.mana_cost}</div>
              <button
                type="button"
                className="poolCard__infoBtn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCard(card);
                }}
                aria-label={`Info about ${card.name}`}
              >
                i
              </button>
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
            </div>
          )
        })}
      </div>
    </section>
  )
}
