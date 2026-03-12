import { useMemo, useState, useEffect } from "react";
import type { DeckBuilderCard } from "../../types/deckBuilder";
import { toStaticUrl } from "../../shared/lib/toStaticUrl";

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
type TriadType = "assault" | "precision" | "arcane";

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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const [selectedManas, setSelectedManas] = useState<number[]>([]);
  const [selectedTriads, setSelectedTriads] = useState<TriadType[]>([]);

  const manaOptions = [1, 2, 3, 4, 5];
  const triadOptions: { value: TriadType; label: string; color: string }[] = [
    { value: "assault", label: "Assault", color: "#a83232" },
    { value: "precision", label: "Precision", color: "#b8962e" },
    { value: "arcane", label: "Arcane", color: "#7b3daa" },
  ];

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(timerId);
    };
  }, [searchQuery]);

  const toggleMana = (mana: number) => {
    setSelectedManas((prev) =>
      prev.includes(mana) ? prev.filter((m) => m !== mana) : [...prev, mana],
    );
  };

  const toggleTriad = (triad: TriadType) => {
    setSelectedTriads((prev) =>
      prev.includes(triad) ? prev.filter((t) => t !== triad) : [...prev, triad],
    );
  };

  const filteredAndSortedCards = useMemo(() => {
    const filtered = cards.filter((card) => {
      if (sortKey === "mana" && selectedManas.length > 0) {
        if (!selectedManas.includes(card.mana_cost)) return false;
      }

      if (sortKey === "type" && selectedTriads.length > 0) {
        if (
          !selectedTriads.includes(card.triad_type.toLowerCase() as TriadType)
        )
          return false;
      }

      const query = debouncedSearchQuery.trim().toLowerCase();

      if (!query) return true;

      const isNumber = /^\d+$/.test(query);

      if (isNumber) {
        return card.mana_cost === parseInt(query, 10);
      }

      if (query === "spell" || query === "unit" || query === "artifact") {
        return card.type.toLowerCase() === query;
      }

      return card.name.toLowerCase().includes(query);
    });

    switch (sortKey) {
      case "mana":
        return filtered.sort((a, b) => a.mana_cost - b.mana_cost);

      case "type":
        return filtered.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type.localeCompare(b.type);
        });

      case "nameDesc":
        return filtered.sort((a, b) => a.name.localeCompare(b.name));

      default:
        return filtered;
    }
  }, [cards, sortKey, debouncedSearchQuery, selectedManas, selectedTriads]);
  return (
    <section className="cardPool">
      <div className="cardPool__header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
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
          className="cardPool__controls-row"
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "20px",
            marginBottom: "20px",
            width: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.05)",
          }}
        >
          <div
            className="cardPool__filters"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minHeight: "36px",
              flexShrink: 0,
            }}
          >
            {sortKey === "mana" && (
              <>
                <span
                  style={{
                    color: "#888",
                    fontSize: "12px",
                    marginRight: "4px",
                    textTransform: "uppercase",
                  }}
                >
                  Mana:
                </span>

                {manaOptions.map((mana) => {
                  const isActive = selectedManas.includes(mana);
                  return (
                    <button
                      key={mana}
                      onClick={() => toggleMana(mana)}
                      title={`Filter by ${mana} mana`}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        border: isActive
                          ? "2px solid #D4AF37"
                          : "1px solid #444",
                        backgroundColor: isActive ? "#1A4A8A" : "#111",
                        color: isActive ? "#fff" : "#888",
                        fontWeight: "bold",
                        fontSize: "14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                        boxShadow: isActive
                          ? "0 0 8px rgba(26, 74, 138, 0.6)"
                          : "none",
                        flexShrink: 0,
                      }}
                    >
                      {mana}
                    </button>
                  );
                })}
                {selectedManas.length > 0 && (
                  <button
                    onClick={() => setSelectedManas([])}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#ff4444",
                      cursor: "pointer",
                      fontSize: "12px",
                      marginLeft: "4px",
                    }}
                  >
                    Clear
                  </button>
                )}
              </>
            )}

            {sortKey === "type" && (
              <>
                <span
                  style={{
                    color: "#888",
                    fontSize: "12px",
                    marginRight: "4px",
                    textTransform: "uppercase",
                  }}
                >
                  Type:
                </span>
                {triadOptions.map((triad) => {
                  const isActive = selectedTriads.includes(triad.value);
                  return (
                    <button
                      key={triad.value}
                      onClick={() => toggleTriad(triad.value)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "4px",
                        border: isActive
                          ? `1px solid ${triad.color}`
                          : "1px solid #444",
                        backgroundColor: isActive ? triad.color : "#111",
                        color: isActive ? "#fff" : "#888",
                        fontWeight: "bold",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: isActive
                          ? `0 0 8px ${triad.color}80`
                          : "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {triad.label}
                    </button>
                  );
                })}
                {selectedTriads.length > 0 && (
                  <button
                    onClick={() => setSelectedTriads([])}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#ff4444",
                      cursor: "pointer",
                      fontSize: "12px",
                      marginLeft: "4px",
                    }}
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>

          <div
            className="cardPool__search"
            style={{
              display: "flex",
              flex: "1 1 auto",
              minWidth: "200px",
            }}
          >
            <input
              type="text"
              placeholder="Search by name, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "4px",
                border: "1px solid #444",
                background: "#1a1a1a",
                color: "#fff",
                fontSize: "14px",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div
            className="cardPool__sort"
            style={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <label
              style={{
                marginRight: "8px",
                color: "#aaa",
                fontSize: "14px",
                whiteSpace: "nowrap",
              }}
            >
              Sort by:
            </label>
            <select
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as SortKey);
                setSelectedManas([]);
                setSelectedTriads([]);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "4px",
                border: "1px solid #444",
                background: "#1a1a1a",
                color: "#fff",
                cursor: "pointer",
                fontSize: "14px",
                minWidth: "140px",
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

              {card.image && (
                <div className="poolCard__imageWrap">
                  <img
                    className="poolCard__image"
                    src={toStaticUrl(card.image)}
                    alt={card.name}
                    loading="lazy"
                  />
                </div>
              )}

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
