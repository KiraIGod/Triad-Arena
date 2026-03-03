import { GameCard, type CardModel } from "../components/Card";

const DEMO_CARDS: CardModel[] = [
  // ДЕМО ТЕМА ДЛЯ ОТРИСОВКИ !!!
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Fire Drake",
    type: "UNIT",
    triad_type: "ASSAULT",
    mana_cost: 4,
    attack: 5,
    hp: 4,
    description: "Deals 1 damage to a random enemy on play.",
    created_at: "2025-03-04T12:00:00Z",
  },
  {
    id: "660e8400-e29b-41d4-a716-446655440001",
    name: "Lightning Bolt",
    type: "SPELL",
    triad_type: "ARCANE",
    mana_cost: 2,
    attack: null,
    hp: null,
    description: "Deal 3 damage to target unit.",
    created_at: "2025-03-04T12:00:00Z",
  },
  {
    id: "770e8400-e29b-41d4-a716-446655440002",
    name: "Shadow Striker",
    type: "UNIT",
    triad_type: "PRECISION",
    mana_cost: 3,
    attack: 4,
    hp: 2,
    description: "First strike.",
    created_at: "2025-03-04T12:00:00Z",
  },
];

export default function GamePage() {
  const handleCardClick = (card: CardModel) => {
    console.log("Card clicked:", card.id, card.name);
  };

  return (
    <div className="game-page">
      <h1 className="game-page__title">Game</h1>
      <p className="game-page__subtitle">Game page placeholder.</p>
      <section className="game-page__hand" aria-label="Hand">
        {DEMO_CARDS.map((card) => (
          <GameCard
            key={card.id}
            card={card}
            size="normal"
            onClick={handleCardClick}
          />
        ))}
      </section>
    </div>
  );
}
