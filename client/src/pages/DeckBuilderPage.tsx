import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../store";
import {
  fetchAllCards,
  fetchUserCollection,
  fetchUserDeck,
  resetUserDeck,
  saveUserDeck,
  updateUserDeckPartial
} from "../shared/api/deckBuilderApi";
import type { DeckBuilderCard } from "../types/deckBuilder";
import CardPool from "../components/deck-builder/CardPool";
import CurrentDeck from "../components/deck-builder/CurrentDeck";
import CardModal from "../components/deck-builder/CardModal";

const MAX_DECK_SIZE = 20;

function toMap(items: Array<{ cardId: string; quantity: number }>): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.cardId] = item.quantity;
    return acc;
  }, {});
}

export default function DeckBuilderPage() {
  const token = useAppSelector((state) => state.auth.token);

  const [cards, setCards] = useState<DeckBuilderCard[]>([]);
  const [collectionByCardId, setCollectionByCardId] = useState<Record<string, number>>({});
  const [deckByCardId, setDeckByCardId] = useState<Record<string, number>>({});
  const [selectedCard, setSelectedCard] = useState<DeckBuilderCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const cardsById = useMemo<Record<string, DeckBuilderCard>>(
    () =>
      cards.reduce<Record<string, DeckBuilderCard>>((acc, card) => {
        acc[card.id] = card;
        return acc;
      }, {}),
    [cards]
  );

  const totalCards = useMemo(
    () => Object.values(deckByCardId).reduce((sum, quantity) => sum + quantity, 0),
    [deckByCardId]
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [cardsList, collection, deck] = await Promise.all([
          fetchAllCards(token),
          fetchUserCollection(token),
          fetchUserDeck(token)
        ]);
        setCards(cardsList);
        setCollectionByCardId(toMap(collection));
        setDeckByCardId(toMap(deck.cards));
      } catch (_err) {
        setError("Failed to load deck builder data");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [token]);

  const canAddCard = (cardId: string): boolean => {
    const owned = collectionByCardId[cardId] ?? 0;
    const inDeck = deckByCardId[cardId] ?? 0;
    if (totalCards >= MAX_DECK_SIZE) {
      return false;
    }
    return inDeck < owned;
  };

  const canRemoveCard = (cardId: string): boolean => {
    return (deckByCardId[cardId] ?? 0) > 0;
  };

  const handleAddCard = () => {
    if (!selectedCard || !canAddCard(selectedCard.id)) {
      return;
    }
    setDeckByCardId((prev) => ({
      ...prev,
      [selectedCard.id]: (prev[selectedCard.id] ?? 0) + 1
    }));
    setStatus(null);
  };

  const handleRemoveCard = () => {
    if (!selectedCard || !canRemoveCard(selectedCard.id)) {
      return;
    }
    setDeckByCardId((prev) => {
      const current = prev[selectedCard.id] ?? 0;
      const nextQuantity = current - 1;
      if (nextQuantity <= 0) {
        const { [selectedCard.id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [selectedCard.id]: nextQuantity };
    });
    setStatus(null);
  };

  const handleCommitDeck = async () => {
    if (!token || totalCards !== MAX_DECK_SIZE) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const deckItems = Object.entries(deckByCardId).map(([cardId, quantity]) => ({
        cardId,
        quantity
      }));
      const updatedDeck = await saveUserDeck(token, deckItems);
      setDeckByCardId(toMap(updatedDeck.cards));
      setStatus("Deck committed");
    } catch (_err) {
      setError("Failed to commit deck");
      setStatus(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProgress = async () => {
    if (!token) {
      return;
    }
    setIsUpdating(true);
    setError(null);
    try {
      const deckItems = Object.entries(deckByCardId).map(([cardId, quantity]) => ({
        cardId,
        quantity
      }));
      const updatedDeck = await updateUserDeckPartial(token, deckItems);
      setDeckByCardId(toMap(updatedDeck.cards));
      setStatus("Deck progress saved");
    } catch (_err) {
      setError("Failed to save deck progress");
      setStatus(null);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetDeck = async () => {
    if (!token) {
      return;
    }
    setIsResetting(true);
    setError(null);
    try {
      const resetDeck = await resetUserDeck(token);
      setDeckByCardId(toMap(resetDeck.cards));
      setSelectedCard(null);
      setStatus("Deck reset");
    } catch (_err) {
      setError("Failed to reset deck");
      setStatus(null);
    } finally {
      setIsResetting(false);
    }
  };

  if (!token) {
    return <div>Authorization required</div>;
  }

  if (isLoading) {
    return <div>Loading deck builder...</div>;
  }

  return (
    <main>
      <h1>Deck Builder</h1>
      {error ? <p>{error}</p> : null}
      {status ? <p>{status}</p> : null}

      <div>
        <CardPool
          cards={cards}
          collectionByCardId={collectionByCardId}
          deckByCardId={deckByCardId}
          onSelectCard={setSelectedCard}
        />
        <CurrentDeck
          deckByCardId={deckByCardId}
          cardsById={cardsById}
          totalCards={totalCards}
          maxCards={MAX_DECK_SIZE}
        />
      </div>

      <button
        type="button"
        onClick={() => void handleCommitDeck()}
        disabled={totalCards !== MAX_DECK_SIZE || isSaving || isUpdating || isResetting}
      >
        {isSaving ? "Saving..." : "Commit Deck"}
      </button>
      <button
        type="button"
        onClick={() => void handleSaveProgress()}
        disabled={isSaving || isUpdating || isResetting}
      >
        {isUpdating ? "Saving..." : "Save Progress"}
      </button>
      <button
        type="button"
        onClick={() => void handleResetDeck()}
        disabled={isSaving || isUpdating || isResetting}
      >
        {isResetting ? "Resetting..." : "Reset Deck"}
      </button>

      <CardModal
        card={selectedCard}
        isOpen={selectedCard !== null}
        canAdd={selectedCard ? canAddCard(selectedCard.id) : false}
        canRemove={selectedCard ? canRemoveCard(selectedCard.id) : false}
        onClose={() => setSelectedCard(null)}
        onAdd={handleAddCard}
        onRemove={handleRemoveCard}
      />
    </main>
  );
}
