export type ApiCardType = "unit" | "spell"
export type ApiTriadType = "assault" | "precision" | "arcane"
export type CardType = "UNIT" | "SPELL"

export type DeckBuilderCard = {
  id: string;
  name: string;
  type: CardType;
  triad_type: ApiTriadType;
  mana_cost: number;
  attack: number | null;
  hp: number | null;
  description: string;
  image: string;
  created_at: string;
}

export type CollectionItem = {
  cardId: string;
  quantity: number;
  card: DeckBuilderCard;
}

export type DeckItem = {
  cardId: string;
  quantity: number;
  card: DeckBuilderCard;
}

export type DeckData = {
  id: string;
  name: string;
  isActive: boolean;
  totalCards: number;
  maxCards: number;
  cards: DeckItem[];
}