import { useState } from "react"
import type { DeckBuilderCard } from "../../types/deckBuilder"
import { toStaticUrl } from "../../shared/lib/toStaticUrl"

type CurrentDeckProps = {
  deckByCardId: Record<string, number>
  cardsById: Record<string, DeckBuilderCard>
  totalCards: number
  maxCards: number
  onRemoveCard: (cardId: string) => void
}

function triadLabel(triad: string): string {
  const map: Record<string, string> = {
    assault: "Assault",
    precision: "Precision",
    arcane: "Arcane",
  }
  return map[triad] ?? triad
}

export default function CurrentDeck({
  deckByCardId,
  cardsById,
  totalCards,
  maxCards,
  onRemoveCard,
}: CurrentDeckProps) {
  const [hoveredCard, setHoveredCard] = useState<DeckBuilderCard | null>(null)
  const [tooltipY, setTooltipY] = useState(0)

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
    )

  const isFull = totalCards >= maxCards

  const handleMouseEnter = (card: DeckBuilderCard, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltipY(rect.top)
    setHoveredCard(card)
  }

  const showStats =
    hoveredCard &&
    hoveredCard.type !== "SPELL" &&
    (hoveredCard.attack !== null || hoveredCard.hp !== null)

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
            <li
              key={entry.cardId}
              className="currentDeck__item"
              onClick={() => onRemoveCard(entry.cardId)}
              onMouseEnter={(e) => handleMouseEnter(entry.card, e)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="currentDeck__itemMana">
                {entry.card.mana_cost}
              </div>
              <div className="currentDeck__itemName">{entry.card.name}</div>
              <div className="currentDeck__itemQty">×{entry.quantity}</div>
            </li>
          ))}
        </ul>
      )}

      {hoveredCard && (
        <div
          className="deckTooltip"
          style={{ top: Math.max(0, tooltipY - 60) }}
        >
          <img
            className="deckTooltip__image"
            src={toStaticUrl(hoveredCard.image)}
            alt={hoveredCard.name}
          />
          <div className="deckTooltip__body">
            <div className="deckTooltip__name">{hoveredCard.name}</div>
            <div className="deckTooltip__meta">
              {hoveredCard.type} &middot; {triadLabel(hoveredCard.triad_type)} &middot; Mana: {hoveredCard.mana_cost}
            </div>
            <p className="deckTooltip__desc">{hoveredCard.description}</p>
            {showStats && (
              <div className="deckTooltip__stats">
                {hoveredCard.attack !== null && (
                  <span className="deckTooltip__stat--atk">ATK {hoveredCard.attack}</span>
                )}
                {hoveredCard.hp !== null && (
                  <span className="deckTooltip__stat--hp">HP {hoveredCard.hp}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
