import { AnimatePresence, motion } from "motion/react";
import { GameCard, type CardModel } from "./Card";

export type CardFlyEffect = {
  id: string;
  type: "card_fly";
  playedCardId: string;
  card: CardModel;
  from: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  to: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

type BattleEffectsLayerProps = {
  effects: CardFlyEffect[];
  onComplete: (effect: CardFlyEffect) => void;
};

export default function BattleEffectsLayer({
  effects,
  onComplete,
}: BattleEffectsLayerProps) {
  return (
    <div className="battle-effects-layer">
      <AnimatePresence>
        {effects.map((effect) => {
          if (effect.type !== "card_fly") return null;

          return (
            <motion.div
              key={effect.id}
              className="battle-effects-layer__card"
              initial={{
                left: effect.from.left,
                top: effect.from.top,
                width: effect.from.width,
                height: effect.from.height,
                opacity: 1,
                scale: 1,
              }}
              animate={{
                left: effect.to.left,
                top: effect.to.top,
                width: effect.to.width,
                height: effect.to.height,
                opacity: 0.92,
                scale: 0.92,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
              onAnimationComplete={() => onComplete(effect)}
            >
              <GameCard card={effect.card} size="normal" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
