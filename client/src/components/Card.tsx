import { useState, type KeyboardEvent } from "react";

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

const triadAccents: Record<TriadType, string> = {
  ASSAULT: "#A83E36",
  PRECISION: "#C9A962",
  ARCANE: "#8B5CF6"
};

const sizeMap: Record<NonNullable<GameCardProps["size"]>, { width: number; height: number }> = {
  small: { width: 152, height: 232 },
  normal: { width: 180, height: 270 },
  large: { width: 210, height: 320 }
};

function typeLabel(type: CardType): string {
  if (type === "UNIT") return "Unit";
  if (type === "SPELL") return "Spell";
  return "Artifact";
}

function toImageUrl(image: string): string {
  if (!image) return "";
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return `${import.meta.env.VITE_STATIC_URL}/${image}`;
}

export function GameCard({
  card,
  onClick,
  disabled = false,
  size = "normal",
  className
}: GameCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const isInteractive = Boolean(onClick) && !disabled;
  const accentColor = triadAccents[card.triad_type] || "#A83E36";
  const selectedColor = "#336f9b";
  const dimensions = sizeMap[size];
  const showStats = card.type !== "SPELL" && (card.attack !== null || card.hp !== null);

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
      className={className}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : -1}
      aria-disabled={disabled}
      onClick={isInteractive ? handleClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        cursor: isInteractive ? "pointer" : "default",
        userSelect: "none",
        transition: "transform 0.2s ease, opacity 0.2s ease",
        transform: isHovering && !disabled ? "translateY(-4px)" : "none",
        opacity: disabled ? 0.72 : 1
      }}
    >
      <div
        className="h-full flex flex-col ink-border-thin parchment-texture"
        style={{
          background: "linear-gradient(135deg, #1A1612 0%, #0E0E0E 100%)",
          boxShadow: "inset 0 0 12px rgba(0, 0, 0, 0.8), 0 4px 0 rgba(0, 0, 0, 0.4)"
        }}
      >
        <div className="px-3 py-2 relative" style={{ background: "rgba(0, 0, 0, 0.5)" }}>
          <div className="flex justify-between items-center mb-1">
            <span
              className="uppercase"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 12,
                color: "#D9C7A8",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textShadow: "1px 1px 0 #000000"
              }}
            >
              {card.name}
            </span>
            <span
              className="uppercase px-2 py-1"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 8,
                color: "#0E0E0E",
                fontWeight: 700,
                letterSpacing: "0.1em",
                background: accentColor,
                border: "1px solid #000000"
              }}
            >
              {card.triad_type.toLowerCase()}
            </span>
          </div>
          <div style={{ height: 2, background: "#000000", boxShadow: `0 1px 0 ${accentColor}40` }} />
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div
            className="absolute inset-0 z-20 pointer-events-none"
            style={{ boxShadow: "inset 0 0 20px rgba(0, 0, 0, 0.9)", border: "1px solid #000000" }}
          />
          <img
            src={toImageUrl(card.image)}
            alt={card.name}
            className="w-full h-full"
            style={{
              objectFit: "cover",
              objectPosition: "center 30%",
              filter: "saturate(0.7) contrast(1.3) brightness(0.72)"
            }}
          />
          <div className="absolute inset-0 pointer-events-none darkest-vignette" />
        </div>

        <div className="px-3 py-3" style={{ background: "rgba(0, 0, 0, 0.7)" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center flex-shrink-0 relative"
              style={{
                width: 36,
                height: 36,
                border: "2px solid #000000",
                background: accentColor,
                boxShadow: `inset 0 0 8px rgba(0, 0, 0, 0.6), 0 0 12px ${accentColor}60`
              }}
            >
              <span
                className="comic-text-shadow"
                style={{ fontFamily: "var(--font-heading)", fontSize: 20, color: "#D9C7A8", fontWeight: 900 }}
              >
                {card.mana_cost}
              </span>
              <div className="absolute -top-1 -left-1 w-2 h-2 bg-black" />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-black" />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-body)",
                  fontSize: 10,
                  color: "#8B7E6F",
                  lineHeight: "1.3",
                  letterSpacing: "0.02em"
                }}
              >
                {card.description}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontFamily: "var(--font-body)",
                  fontSize: 9,
                  color: "#D9C7A8",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase"
                }}
              >
                {typeLabel(card.type)}
                {showStats ? ` | ATK ${card.attack ?? 0} | HP ${card.hp ?? 0}` : ""}
              </span>
            </div>
          </div>
        </div>

        {isHovering && !disabled && (
          <div style={{ height: 3, background: selectedColor, boxShadow: `0 0 12px ${selectedColor}` }} />
        )}
      </div>
    </article>
  );
}
