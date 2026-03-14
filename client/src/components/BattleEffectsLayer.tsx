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

export type SpellBurstEffect = {
  id: string;
  type: "spell_burst";
  triadType: "ASSAULT" | "PRECISION" | "ARCANE";
  target: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

export type BattleEffect = CardFlyEffect | SpellBurstEffect;

type BattleEffectsLayerProps = {
  effects: BattleEffect[];
  onComplete: (effect: BattleEffect) => void;
};

export default function BattleEffectsLayer({
  effects,
  onComplete,
}: BattleEffectsLayerProps) {
  return (
    <div className="battle-effects-layer">
      <AnimatePresence>
        {effects.map((effect) => {
          if (effect.type === "spell_burst") {
            const size = Math.max(effect.target.width, effect.target.height, 72);
            const left = effect.target.left + effect.target.width / 2 - size / 2;
            const top = effect.target.top + effect.target.height / 2 - size / 2;

            return (
              <motion.div
                key={effect.id}
                className={`battle-effects-layer__burst battle-effects-layer__burst--${effect.triadType.toLowerCase()}`}
                style={{
                  left,
                  top,
                  width: size,
                  height: size,
                }}
                initial={{
                  opacity: 0,
                  scale: 0.4,
                }}
                animate={{
                  opacity: [0, 0.95, 0],
                  scale: [0.4, 1.15, 1.4],
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                onAnimationComplete={() => onComplete(effect)}
              />
            );
          }

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
