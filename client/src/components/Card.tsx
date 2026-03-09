import React from "react"

// ============ Types ============

export type CardType = "UNIT" | "SPELL" | "ARTIFACT"
export type TriadType = "ASSAULT" | "PRECISION" | "ARCANE"

export interface CardModel {
  id: string
  name: string
  type: CardType
  triad_type: TriadType
  mana_cost: number
  attack: number | null
  hp: number | null
  description: string
  image: string
  created_at: string
}

export interface GameCardProps {
  card: CardModel
  onClick?: (card: CardModel) => void
  disabled?: boolean
  size?: "small" | "normal" | "large"
  className?: string
}

// ============ Helpers ============

function triadToModifier(triadType: TriadType): string {
  const map: Record<TriadType, string> = {
    ASSAULT: "assault",
    PRECISION: "precision",
    ARCANE: "arcane",
  }
  return map[triadType]
}

function typeLabel(type: CardType): string {
  const map: Record<CardType, string> = {
    UNIT: "Unit",
    SPELL: "Spell",
    ARTIFACT: "Artifact",
  }
  return map[type]
}

// ============ Component ============

export const GameCard: React.FC<GameCardProps> = ({
  card,
  onClick,
  disabled = false,
  size = "normal",
  className,
}) => {
  const triadModifier = triadToModifier(card.triad_type)
  const showStats =
    card.type !== "SPELL" && (card.attack !== null || card.hp !== null)

  const baseClass = "game-card"
  const triadClass = `game-card--${triadModifier}`
  const sizeClass = `game-card--size-${size}`
  const classNames = [baseClass, triadClass, sizeClass, className]
    .filter(Boolean)
    .join(" ")

  const handleClick = (): void => {
    if (disabled || !onClick) return
    onClick(card)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (disabled || !onClick) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick(card)
    }
  }

  const isInteractive = Boolean(onClick) && !disabled

  return (
    <article
      className={classNames}
      role={isInteractive ? "button" : undefined}
      tabIndex={disabled ? -1 : isInteractive ? 0 : undefined}
      aria-disabled={disabled ? true : undefined}
      onClick={isInteractive ? handleClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
    >
      <header className="game-card__header">
        <div className="game-card__mana" aria-label="Mana cost">
          {card.mana_cost}
        </div>
        <div className="game-card__meta">
          <div className="game-card__name">{card.name}</div>
          <div className="game-card__type">{typeLabel(card.type)}</div>
          <div className="game-card__triad">{card.triad_type}</div>
        </div>
      </header>

      <div className="game-card__art" aria-hidden="true">
        <img
        src={`${import.meta.env.VITE_STATIC_URL}/${card.image}`}
        alt={card.name}
        className="game-card__art-image"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover"
        }}
        />
      </div>

      <section className="game-card__body">
        <p className="game-card__description">{card.description}</p>
      </section>

      <footer className="game-card__footer">
        {showStats && (
          <div className="game-card__stats" aria-label="Stats">
            {card.attack !== null && (
              <div className="game-card__stat game-card__stat--attack">
                <span className="game-card__stat-label">ATK</span>
                <span className="game-card__stat-value">{card.attack}</span>
              </div>
            )}
            {card.hp !== null && (
              <div className="game-card__stat game-card__stat--hp">
                <span className="game-card__stat-label">HP</span>
                <span className="game-card__stat-value">{card.hp}</span>
              </div>
            )}
          </div>
        )}
      </footer>
    </article>
  )
}

/*
  Example mock card and render:

  const mockCard: CardModel = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Fire Drake",
    type: "UNIT",
    triad_type: "ASSAULT",
    mana_cost: 4,
    attack: 5,
    hp: 4,
    description: "Deals 1 damage to a random enemy on play.",
    created_at: "2025-03-04T12:00:00Z",
  };

  // Spell example (no stats):
  const mockSpell: CardModel = {
    id: "660e8400-e29b-41d4-a716-446655440001",
    name: "Lightning Bolt",
    type: "SPELL",
    triad_type: "ARCANE",
    mana_cost: 2,
    attack: null,
    hp: null,
    description: "Deal 3 damage to target unit.",
    created_at: "2025-03-04T12:00:00Z",
  };

  // Usage:
  <GameCard card={mockCard} size="normal" onClick={(c) => console.log(c)} />
  <GameCard card={mockSpell} size="small" disabled />
*/
