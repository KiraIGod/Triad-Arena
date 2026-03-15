import { AnimatePresence, motion } from "motion/react";
import { GameCard, type CardModel } from "./Card";
import "./BattleEffectsLayer.css";

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

export type HitTextEffect = {
  id: string;
  type: "hit_text";
  text: string;
  tone?: "damage" | "assault" | "precision" | "arcane";
  target: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

export type BattleEffect = CardFlyEffect | SpellBurstEffect | HitTextEffect;

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
          if (effect.type === "hit_text") {
            const left = effect.target.left + effect.target.width / 2;
            const top = effect.target.top + Math.max(16, effect.target.height * 0.2);

            return (
              <motion.div
                key={effect.id}
                className={`battle-effects-layer__hit-text battle-effects-layer__hit-text--${effect.tone || "damage"}`}
                style={{ left, top }}
                initial={{ opacity: 0, y: 12, scale: 0.92 }}
                animate={{ opacity: [0, 1, 1, 0], y: [12, -4, -18, -34], scale: [0.92, 1.04, 1, 0.98] }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                onAnimationComplete={() => onComplete(effect)}
              >
                {effect.text}
              </motion.div>
            );
          }

          if (effect.type === "spell_burst") {
            const size = Math.max(effect.target.width, effect.target.height, 96);
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
                  scale: 0.2,
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.2, 1.1, 1.55],
                }}
                transition={{ duration: 0.65, ease: "easeOut" }}
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
