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
        className="ink-border-thin parchment-texture"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #1A1612 0%, #0E0E0E 100%)",
          boxShadow: "inset 0 0 12px rgba(0, 0, 0, 0.8), 0 4px 0 rgba(0, 0, 0, 0.4)"
        }}
      >
        <div style={{ position: "relative", padding: "8px 12px", background: "rgba(0, 0, 0, 0.5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
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
            {/* <span
              className="uppercase"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 10,
                color: "#0E0E0E",
                fontWeight: 700,
                letterSpacing: "0.1em",
                background: accentColor,
                border: "1px solid #000000",
                padding: "4px 4px"
              }}
            >
              {card.triad_type.toLowerCase()}
            </span> */}
          </div>
          <div style={{ height: 2, background: "#000000", boxShadow: `0 1px 0 ${accentColor}40` }} />
        </div>

        <div style={{ position: "relative", overflow: "hidden", flex: 1 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              pointerEvents: "none",
              boxShadow: "inset 0 0 20px rgba(0, 0, 0, 0.9)",
              border: "1px solid #000000"
            }}
          />
          <img
            src={toImageUrl(card.image)}
            alt={card.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 30%",
              filter: "saturate(0.7) contrast(1.3) brightness(0.72)"
            }}
          />
          <div className="darkest-vignette" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        </div>

        <div style={{ padding: "12px", background: "rgba(0, 0, 0, 0.7)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
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
              <div style={{ position: "absolute", top: -4, left: -4, width: 8, height: 8, background: "#000" }} />
              <div style={{ position: "absolute", right: -4, bottom: -4, width: 8, height: 8, background: "#000" }} />
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
          <div style={{ height: 3, background: accentColor, boxShadow: `0 0 12px ${accentColor}` }} />
        )}
      </div>
    </article>
  );
}
