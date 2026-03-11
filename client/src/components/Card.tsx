import { type KeyboardEvent } from "react";
import { toStaticUrl } from "../shared/lib/toStaticUrl";
import "./Card.css";

export type CardType = "UNIT" | "SPELL" | "ARTIFACT";
export type TriadType = "ASSAULT" | "PRECISION" | "ARCANE";

export interface CardModel {
  id: string;
  name: string;
  type: CardType;
  triad_type: TriadType;
  mana_cost: number;
  attack: number | null;
  hp: number | null;
  description: string;
  image: string;
  created_at: string;
}

export interface GameCardProps {
  card: CardModel;
  onClick?: (card: CardModel) => void;
  disabled?: boolean;
  size?: "small" | "normal" | "large";
  className?: string;
}

function typeLabel(type: CardType): string {
  if (type === "UNIT") return "Unit";
  if (type === "SPELL") return "Spell";
  return "Artifact";
}

function triadClass(triad: TriadType): string {
  if (triad === "ASSAULT") return "game-card--assault";
  if (triad === "PRECISION") return "game-card--precision";
  return "game-card--arcane";
}

export function GameCard({
  card,
  onClick,
  disabled = false,
  size = "normal",
  className
}: GameCardProps) {
  const isInteractive = Boolean(onClick) && !disabled;
  const showStats = card.type !== "SPELL" && (card.attack !== null || card.hp !== null);
  const classes = [
    "game-card",
    `game-card--${size}`,
    triadClass(card.triad_type),
    isInteractive ? "is-interactive" : "",
    disabled ? "is-disabled" : "",
    className || ""
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = () => {
    if (!isInteractive || !onClick) return;
    onClick(card);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!isInteractive || !onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(card);
    }
  };

  return (
    <article
      className={classes}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : -1}
      aria-disabled={disabled}
      onClick={isInteractive ? handleClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
    >
      <div className="game-card__shell ink-border-thin parchment-texture">
        <div className="game-card__header">
          <div className="game-card__head-row">
            <span className="game-card__name uppercase">
              {card.name}
            </span>
          </div>
          <div className="game-card__header-divider" />
        </div>

        <div className="game-card__art">
          <div className="game-card__art-frame" />
          <img
            className="game-card__image"
            src={toStaticUrl(card.image)}
            alt={card.name}
          />
          <div className="game-card__vignette darkest-vignette" />
        </div>

        <div className="game-card__body">
          <div className="game-card__body-row">
            <div className="game-card__mana">
              <span className="game-card__mana-value comic-text-shadow">
                {card.mana_cost}
              </span>
              <div className="game-card__mana-corner game-card__mana-corner--tl" />
              <div className="game-card__mana-corner game-card__mana-corner--br" />
            </div>

            <div className="game-card__meta">
              <span className="game-card__description">
                {card.description}
              </span>
              <span className="game-card__type">
                <strong>{typeLabel(card.type)}</strong>
                {showStats ? ` | ATK ${card.attack ?? 0} | HP ${card.hp ?? 0}` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="game-card__hover-glow" />
      </div>
    </article>
  );
}
