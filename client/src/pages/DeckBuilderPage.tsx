import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../store";
import {
  fetchAllCards,
  fetchUserCollection,
  fetchUserDecks,
  createDeck,
  deleteDeck,
  renameDeck,
  activateDeck,
  resetUserDeck,
  updateUserDeckPartial,
} from "../shared/api/deckBuilderApi";
import type { DeckBuilderCard, DeckData } from "../types/deckBuilder";
import CardPool from "../components/deck-builder/CardPool";
import CurrentDeck from "../components/deck-builder/CurrentDeck";
import CardModal from "../components/deck-builder/CardModal";
import CardViewer from "../components/deck-builder/CardViewer";
import "./DeckBuilder.css";

const MAX_DECK_SIZE = 20;
const MAX_DECKS = 3;
const MAX_COPIES_PER_CARD = 2;

function toMap(
  items: Array<{ cardId: string; quantity: number }>,
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.cardId] = item.quantity;
    return acc;
  }, {});
}

export default function DeckBuilderPage() {
  const navigate = useNavigate();
  const token = useAppSelector((state) => state.auth.token);

  const [cards, setCards] = useState<DeckBuilderCard[]>([]);
  const [collectionByCardId, setCollectionByCardId] = useState<
    Record<string, number>
  >({});
  const [decks, setDecks] = useState<DeckData[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [deckByCardId, setDeckByCardId] = useState<Record<string, number>>({});
  const [selectedCard, setSelectedCard] = useState<DeckBuilderCard | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [renamingDeckId, setRenamingDeckId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const cardsById = useMemo<Record<string, DeckBuilderCard>>(
    () =>
      cards.reduce<Record<string, DeckBuilderCard>>((acc, card) => {
        acc[card.id] = card;
        return acc;
      }, {}),
    [cards],
  );

  const totalCards = useMemo(
    () =>
      Object.values(deckByCardId).reduce((sum, quantity) => sum + quantity, 0),
    [deckByCardId],
  );

  const syncDeckCards = useCallback((deck: DeckData | undefined) => {
    if (!deck) {
      setDeckByCardId({});
      return;
    }
    setDeckByCardId(toMap(deck.cards));
  }, []);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [cardsList, collection, userDecks] = await Promise.all([
          fetchAllCards(token),
          fetchUserCollection(token),
          fetchUserDecks(token),
        ]);
        setCards(cardsList);
        setCollectionByCardId(toMap(collection));
        setDecks(userDecks);

        const active = userDecks.find((d) => d.isActive) ?? userDecks[0];
        if (active) {
          setActiveDeckId(active.id);
          syncDeckCards(active);
        }
      } catch {
        setError("Failed to load deck builder data");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [token, syncDeckCards]);

  const switchToDeck = (deckId: string) => {
    setActiveDeckId(deckId);
    const deck = decks.find((d) => d.id === deckId);
    syncDeckCards(deck);
    setStatus(null);
    setError(null);
  };

  const canAddCard = (cardId: string): boolean => {
    const owned = collectionByCardId[cardId] ?? 0;
    const inDeck = deckByCardId[cardId] ?? 0;
    if (totalCards >= MAX_DECK_SIZE) return false;
    if (inDeck >= MAX_COPIES_PER_CARD) return false;
    return inDeck < owned;
  };

  const canRemoveCard = (cardId: string): boolean => {
    return (deckByCardId[cardId] ?? 0) > 0;
  };

  const handleAddCard = () => {
    if (!selectedCard || !canAddCard(selectedCard.id)) return;
    setDeckByCardId((prev) => ({
      ...prev,
      [selectedCard.id]: (prev[selectedCard.id] ?? 0) + 1,
    }));
    setStatus(null);
  };

  const handleRemoveCard = () => {
    if (!selectedCard || !canRemoveCard(selectedCard.id)) return;
    removeCardFromDeck(selectedCard.id);
  };

  const addCardToDeck = (cardId: string) => {
    const inDeck = deckByCardId[cardId] ?? 0;
    if (inDeck >= MAX_COPIES_PER_CARD) {
      setError("Не более 2 одинаковых карт в колоде");
      return;
    }
    if (!canAddCard(cardId)) return;
    setError(null);
    setDeckByCardId((prev) => ({
      ...prev,
      [cardId]: (prev[cardId] ?? 0) + 1,
    }));
    setStatus(null);
  };

  const removeCardFromDeck = (cardId: string) => {
    setDeckByCardId((prev) => {
      const current = prev[cardId] ?? 0;
      if (current <= 0) return prev;
      const next = current - 1;
      if (next <= 0) {
        const { [cardId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [cardId]: next };
    });
    setStatus(null);
  };

  const handleSaveProgress = async () => {
    if (!token || !activeDeckId) return;
    setIsUpdating(true);
    setError(null);
    try {
      const deckItems = Object.entries(deckByCardId).map(
        ([cardId, quantity]) => ({ cardId, quantity }),
      );
      const updatedDeck = await updateUserDeckPartial(
        token,
        activeDeckId,
        deckItems,
      );
      setDecks((prev) =>
        prev.map((d) => (d.id === updatedDeck.id ? updatedDeck : d)),
      );
      setDeckByCardId(toMap(updatedDeck.cards));
      setStatus("Deck progress saved");
    } catch {
      setError("Failed to save deck progress");
      setStatus(null);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetDeck = async () => {
    if (!token || !activeDeckId) return;
    setIsResetting(true);
    setError(null);
    try {
      const resetDeckData = await resetUserDeck(token, activeDeckId);
      setDecks((prev) =>
        prev.map((d) => (d.id === resetDeckData.id ? resetDeckData : d)),
      );
      setDeckByCardId(toMap(resetDeckData.cards));
      setSelectedCard(null);
      setStatus("Deck reset");
    } catch {
      setError("Failed to reset deck");
      setStatus(null);
    } finally {
      setIsResetting(false);
    }
  };

  const handleCreateDeck = async () => {
    if (!token || decks.length >= MAX_DECKS) return;
    setError(null);
    try {
      const name = `Deck ${decks.length + 1}`;
      const newDeck = await createDeck(token, name);
      setDecks((prev) => [...prev, newDeck]);
      setActiveDeckId(newDeck.id);
      syncDeckCards(newDeck);
      setStatus("New deck created");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create deck";
      setError(msg);
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (!token || decks.length <= 1) return;
    setError(null);
    try {
      const updatedDecks = await deleteDeck(token, deckId);
      setDecks(updatedDecks);

      if (activeDeckId === deckId) {
        const active = updatedDecks.find((d) => d.isActive) ?? updatedDecks[0];
        if (active) {
          setActiveDeckId(active.id);
          syncDeckCards(active);
        }
      }
      setStatus("Deck deleted");
    } catch {
      setError("Failed to delete deck");
    }
  };

  const handleStartRename = (deck: DeckData) => {
    setRenamingDeckId(deck.id);
    setRenameValue(deck.name);
  };

  const handleConfirmRename = async () => {
    if (!token || !renamingDeckId || !renameValue.trim()) {
      setRenamingDeckId(null);
      return;
    }
    try {
      const updated = await renameDeck(
        token,
        renamingDeckId,
        renameValue.trim(),
      );
      setDecks((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch {
      setError("Failed to rename deck");
    } finally {
      setRenamingDeckId(null);
    }
  };

  const handleSetActive = async (deckId: string) => {
    if (!token) return;
    setError(null);
    try {
      const updatedDecks = await activateDeck(token, deckId);
      setDecks(updatedDecks);
      setStatus("Active deck changed");
    } catch {
      setError("Failed to set active deck");
    }
  };

  if (!token) {
    return <div className="deckBuilder">Authorization required</div>;
  }

  if (isLoading) {
    return <div className="deckBuilder">Loading deck builder...</div>;
  }

  const anyBusy = isUpdating || isResetting;

  return (
    <main className="deckBuilder">
      <div className="deckBuilder__header">
        <div className="deckBuilder__headerLeft">
          <button
            type="button"
            className="deckBuilder__btn deckBuilder__btn--back"
            onClick={() => navigate("/lobby")}
          >
            Back
          </button>
          <h1 className="deckBuilder__title">Deck Builder</h1>
        </div>

        <div className="deckBuilder__actions">
          <button
            type="button"
            className="deckBuilder__btn deckBuilder__btn--viewer"
            onClick={() => setIsViewerOpen(true)}
          >
            View mode
          </button>
          <button
            type="button"
            className="deckBuilder__btn deckBuilder__btn--secondary"
            onClick={() => void handleSaveProgress()}
            disabled={anyBusy}
          >
            {isUpdating ? "Saving..." : "Save Progress"}
          </button>
          <button
            type="button"
            className="deckBuilder__btn deckBuilder__btn--secondary"
            onClick={() => void handleResetDeck()}
            disabled={anyBusy}
          >
            {isResetting ? "Resetting..." : "Reset Deck"}
          </button>
        </div>
      </div>

      {/* Deck Tabs */}
      <div className="deckTabs">
        {decks.map((deck) => (
          <div
            key={deck.id}
            className={`deckTabs__tab ${deck.id === activeDeckId ? "deckTabs__tab--active" : ""} ${deck.isActive ? "deckTabs__tab--default" : ""}`}
          >
            {renamingDeckId === deck.id ? (
              <div className="deckTabs__renameWrap">
                <input
                  className="deckTabs__renameInput"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => void handleConfirmRename()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleConfirmRename();
                    }
                    if (e.key === "Escape") setRenamingDeckId(null);
                  }}
                  maxLength={30}
                  autoFocus
                />
              </div>
            ) : (
              <button
                type="button"
                className="deckTabs__tabBtn"
                onClick={() => switchToDeck(deck.id)}
              >
                <span className="deckTabs__name">{deck.name}</span>
                <span className="deckTabs__count">
                  {deck.totalCards}/{MAX_DECK_SIZE}
                </span>
              </button>
            )}

            <div className="deckTabs__controls">
              <button
                type="button"
                className="deckTabs__controlBtn"
                onClick={() => handleStartRename(deck)}
                title="Rename the deck"
              >
                ✎
              </button>
              {deck.isActive ? (
                <span className="deckTabs__activeBadge" title="Game deck">
                  ★
                </span>
              ) : (
                <button
                  type="button"
                  className="deckTabs__controlBtn"
                  onClick={() => void handleSetActive(deck.id)}
                  title="Make active for the game"
                >
                  ☆
                </button>
              )}
              {decks.length > 1 && (
                <button
                  type="button"
                  className="deckTabs__controlBtn deckTabs__controlBtn--delete"
                  onClick={() => void handleDeleteDeck(deck.id)}
                  title="Delete deck"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}

        {decks.length < MAX_DECKS && (
          <button
            type="button"
            className="deckTabs__addBtn"
            onClick={() => void handleCreateDeck()}
          >
            + New deck
          </button>
        )}
      </div>

      {error && (
        <p className="deckBuilder__feedback deckBuilder__feedback--error">
          {error}
        </p>
      )}
      {status && (
        <p className="deckBuilder__feedback deckBuilder__feedback--status">
          {status}
        </p>
      )}

      <div className="deckBuilder__body">
        <CardPool
          cards={cards}
          collectionByCardId={collectionByCardId}
          deckByCardId={deckByCardId}
          maxDeckSize={MAX_DECK_SIZE}
          maxCopiesPerCard={MAX_COPIES_PER_CARD}
          totalCards={totalCards}
          onAddCard={addCardToDeck}
        />
        <CurrentDeck
          deckByCardId={deckByCardId}
          cardsById={cardsById}
          totalCards={totalCards}
          maxCards={MAX_DECK_SIZE}
          onRemoveCard={removeCardFromDeck}
        />
      </div>

      <CardModal
        card={selectedCard}
        isOpen={selectedCard !== null}
        canAdd={selectedCard ? canAddCard(selectedCard.id) : false}
        canRemove={selectedCard ? canRemoveCard(selectedCard.id) : false}
        inDeck={selectedCard ? (deckByCardId[selectedCard.id] ?? 0) : 0}
        owned={selectedCard ? (collectionByCardId[selectedCard.id] ?? 0) : 0}
        onClose={() => setSelectedCard(null)}
        onAdd={handleAddCard}
        onRemove={handleRemoveCard}
      />

      {isViewerOpen && (
        <CardViewer
          cards={cards}
          collectionByCardId={collectionByCardId}
          deckByCardId={deckByCardId}
          onAddCard={addCardToDeck}
          onRemoveCard={removeCardFromDeck}
          canAddCard={canAddCard}
          canRemoveCard={canRemoveCard}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </main>
  );
}
