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
    isActive: boolean;
    totalCards: number;
    maxCards: number;
    cards: Array<{
      cardId: string;
      quantity: number;
      card: ApiCard;
    }>;
  };
};

type DecksResponse = {
  decks: DeckResponse["deck"][];
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

export async function fetchUserDecks(token: string): Promise<DeckData[]> {
  const { data } = await api.get<DecksResponse>("/deck-builder/decks", withAuth(token));
  return data.decks.map(mapDeck);
}

export async function createDeck(token: string, name: string): Promise<DeckData> {
  const { data } = await api.post<DeckResponse>(
    "/deck-builder/decks",
    { name },
    withAuth(token)
  );
  return mapDeck(data.deck);
}

export async function deleteDeck(token: string, deckId: string): Promise<DeckData[]> {
  const { data } = await api.delete<DecksResponse>(
    `/deck-builder/decks/${deckId}/delete`,
    withAuth(token)
  );
  return data.decks.map(mapDeck);
}

export async function renameDeck(token: string, deckId: string, name: string): Promise<DeckData> {
  const { data } = await api.put<DeckResponse>(
    `/deck-builder/decks/${deckId}/rename`,
    { name },
    withAuth(token)
  );
  return mapDeck(data.deck);
}

export async function activateDeck(token: string, deckId: string): Promise<DeckData[]> {
  const { data } = await api.put<DecksResponse>(
    `/deck-builder/decks/${deckId}/activate`,
    {},
    withAuth(token)
  );
  return data.decks.map(mapDeck);
}

export async function saveUserDeck(
  token: string,
  deckId: string,
  deckItems: Array<{ cardId: string; quantity: number }>
): Promise<DeckData> {
  const { data } = await api.put<DeckResponse>(
    `/deck-builder/decks/${deckId}`,
    { deckItems },
    withAuth(token)
  );
  return mapDeck(data.deck);
}

export async function updateUserDeckPartial(
  token: string,
  deckId: string,
  deckItems: Array<{ cardId: string; quantity: number }>
): Promise<DeckData> {
  const { data } = await api.patch<DeckResponse>(
    `/deck-builder/decks/${deckId}`,
    { deckItems },
    withAuth(token)
  );
  return mapDeck(data.deck);
}

export async function resetUserDeck(token: string, deckId: string): Promise<DeckData> {
  const { data } = await api.delete<DeckResponse>(
    `/deck-builder/decks/${deckId}`,
    withAuth(token)
  );
  return mapDeck(data.deck);
}
