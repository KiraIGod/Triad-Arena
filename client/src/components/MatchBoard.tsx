import { GameCard, type CardModel } from "./Card";

type MatchBoardProps = {
  cards: CardModel[];
};

export default function MatchBoard({ cards }: MatchBoardProps) {
  return (
    <section className="game-board" aria-label="Match board">
      <div >
        {/* <p className="game-board__title">Played Cards</p> */}
        <div className="game-board__cards">
          {cards.map((card, index) => (
            <div key={`${card.id}-board-${index}`} className="game-board__card-slot">
              <GameCard card={card} size="small" disabled />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
