import api from "./axios";
import type {
  ApiCardType,
  CollectionItem,
  DeckBuilderCard,
  DeckData,
  DeckItem
} from "../../types/deckBuilder";

type ApiCard = Omit<DeckBuilderCard, "type"> & {
  type: ApiCardType;
};

type CollectionResponse = {
  collection: Array<{
    cardId: string;
    quantity: number;
    card: ApiCard;
  }>;
};

type DeckResponse = {
  deck: {
    id: string;
    name: string;
    totalCards: number;
    maxCards: number;
    cards: Array<{
      cardId: string;
      quantity: number;
      card: ApiCard;
    }>;
  };
};

function withAuth(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
}

function mapCard(card: ApiCard): DeckBuilderCard {
  return {
    ...card,
    type: card.type.toUpperCase() as DeckBuilderCard["type"]
  };
}

function mapDeck(deck: DeckResponse["deck"]): DeckData {
  return {
    ...deck,
    cards: deck.cards.map<DeckItem>((item) => ({
      ...item,
      card: mapCard(item.card)
    }))
  };
}

export async function fetchAllCards(token: string): Promise<DeckBuilderCard[]> {
  const { data } = await api.get<{ cards: ApiCard[] }>("/deck-builder/cards", withAuth(token));
  return data.cards.map(mapCard);
}

export async function fetchUserCollection(token: string): Promise<CollectionItem[]> {
  const { data } = await api.get<CollectionResponse>("/deck-builder/collection", withAuth(token));
  return data.collection.map((item) => ({
    ...item,
    card: mapCard(item.card)
  }));
}

export async function fetchUserDeck(token: string): Promise<DeckData> {
  const { data } = await api.get<DeckResponse>("/deck-builder/deck", withAuth(token));
  return mapDeck(data.deck);
}

export async function saveUserDeck(
  token: string,
  deckItems: Array<{ cardId: string; quantity: number }>
): Promise<DeckData> {
  const { data } = await api.put<DeckResponse>(
    "/deck-builder/deck",
    { deckItems },
    withAuth(token)
  );
  return mapDeck(data.deck);
}

export async function updateUserDeckPartial(
  token: string,
  deckItems: Array<{ cardId: string; quantity: number }>
): Promise<DeckData> {
  const { data } = await api.patch<DeckResponse>(
    "/deck-builder/deck",
    { deckItems },
    withAuth(token)
  );
  return mapDeck(data.deck);
}

export async function resetUserDeck(token: string): Promise<DeckData> {
  const { data } = await api.delete<DeckResponse>("/deck-builder/deck", withAuth(token));
  return mapDeck(data.deck);
}
