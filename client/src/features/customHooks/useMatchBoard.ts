import { useCallback, useRef, useState } from "react";
import type { CardModel } from "../../components/Card";
import type { MatchStatePayload } from "../../shared/socket/matchSocket";

export type PlayedBoardCard = {
  card: CardModel;
  playerId: string | null;
};

function toCardModel(card: NonNullable<NonNullable<MatchStatePayload["events"]>[number]["payload"]["card"]>): CardModel {
  return {
    id: card.id,
    name: card.name,
    type: String(card.type).toUpperCase() as CardModel["type"],
    triad_type: String(card.triad_type).toUpperCase() as CardModel["triad_type"],
    mana_cost: card.mana_cost,
    attack: card.attack,
    hp: card.hp,
    description: card.description,
    image: card.image || "crimson_duelist.png",
    created_at: card.created_at
  };
}

export function useMatchBoard() {
  const [playedCards, setPlayedCards] = useState<PlayedBoardCard[]>([]);
  const [cardCatalog, setCardCatalog] = useState<Record<string, CardModel>>({});
  const processedKeysRef = useRef<Set<string>>(new Set());

  const applyEvents = useCallback((events?: MatchStatePayload["events"]) => {
    if (!Array.isArray(events) || !events.length) return;

    for (const event of events) {
      if (event?.type !== "CARD_PLAYED") continue;
      const payload = event.payload || {};
      if (!payload.card) continue;

      const uniqueKey =
        (typeof payload.actionId === "string" && payload.actionId) ||
        `${event.eventId}:${String(payload.playerId || "")}:${String(payload.cardId || "")}`;

      if (processedKeysRef.current.has(uniqueKey)) continue;
      processedKeysRef.current.add(uniqueKey);

      const mappedCard = toCardModel(payload.card);
      setCardCatalog((prev) => ({ ...prev, [mappedCard.id]: mappedCard }));
      setPlayedCards((prev) => [
        ...prev,
        { card: mappedCard, playerId: typeof payload.playerId === "string" ? payload.playerId : null }
      ]);
    }
  }, []);

  const resetBoard = useCallback(() => {
    processedKeysRef.current.clear();
    setPlayedCards([]);
    setCardCatalog({});
  }, []);

  return {
    playedCards,
    cardCatalog,
    applyEvents,
    resetBoard
  };
}
