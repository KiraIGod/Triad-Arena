import { useCallback, useReducer, useRef } from "react";
import type { CardModel } from "../../components/Card";
import type {
  BattleEffect,
  HitTextEffect,
  SpellBurstEffect,
} from "../../components/BattleEffectsLayer";

type UnitShakeState = {
  id: string | null;
  token: number;
};

type BattleEffectsState = {
  battleEffects: BattleEffect[];
  enemyHeroShakeToken: number;
  enemyHeroFlashToken: number;
  enemyUnitShake: UnitShakeState;
  enemyUnitFlash: UnitShakeState;
};

type BattleEffectsAction =
  | { type: "cardFlySpawned"; effect: Extract<BattleEffect, { type: "card_fly" }> }
  | { type: "effectSpawned"; effect: Exclude<BattleEffect, { type: "card_fly" }> }
  | { type: "effectCompleted"; effect: BattleEffect }
  | { type: "enemyHeroShakeTriggered" }
  | { type: "enemyHeroFlashTriggered" }
  | { type: "enemyUnitShakeTriggered"; unitId: string }
  | { type: "enemyUnitFlashTriggered"; unitId: string };

type UseBattleEffectsResult = {
  battleEffects: BattleEffect[];
  enemyHeroShakeToken: number;
  enemyHeroFlashToken: number;
  enemyUnitShake: UnitShakeState;
  enemyUnitFlash: UnitShakeState;
  handCardElementsRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  selfUnitsZoneRef: React.MutableRefObject<HTMLDivElement | null>;
  enemyHeroRef: React.MutableRefObject<HTMLDivElement | null>;
  spawnCardFlyEffect: (card: CardModel, targetRect?: DOMRect | null) => void;
  spawnSpellBurstEffect: (triadType: CardModel["triad_type"], targetRect?: DOMRect | null) => void;
  spawnHitTextEffect: (text: string, targetRect?: DOMRect | null, tone?: HitTextEffect["tone"]) => void;
  triggerEnemyHeroShake: () => void;
  triggerEnemyHeroFlash: () => void;
  triggerEnemyUnitShake: (unitId: string) => void;
  triggerEnemyUnitFlash: (unitId: string) => void;
  completeEffect: (effect: BattleEffect) => void;
};

const initialState: BattleEffectsState = {
  battleEffects: [],
  enemyHeroShakeToken: 0,
  enemyHeroFlashToken: 0,
  enemyUnitShake: { id: null, token: 0 },
  enemyUnitFlash: { id: null, token: 0 },
};

function battleEffectsReducer(
  state: BattleEffectsState,
  action: BattleEffectsAction
): BattleEffectsState {
  switch (action.type) {
    case "cardFlySpawned": {
      return {
        ...state,
        battleEffects: [...state.battleEffects, action.effect],
      };
    }

    case "effectSpawned":
      return {
        ...state,
        battleEffects: [...state.battleEffects, action.effect],
      };

    case "effectCompleted": {
      return {
        ...state,
        battleEffects: state.battleEffects.filter((entry) => entry.id !== action.effect.id),
      };
    }

    case "enemyHeroShakeTriggered":
      return {
        ...state,
        enemyHeroShakeToken: state.enemyHeroShakeToken + 1,
      };

    case "enemyHeroFlashTriggered":
      return {
        ...state,
        enemyHeroFlashToken: state.enemyHeroFlashToken + 1,
      };

    case "enemyUnitShakeTriggered":
      return {
        ...state,
        enemyUnitShake: {
          id: action.unitId,
          token: state.enemyUnitShake.token + 1,
        },
      };

    case "enemyUnitFlashTriggered":
      return {
        ...state,
        enemyUnitFlash: {
          id: action.unitId,
          token: state.enemyUnitFlash.token + 1,
        },
      };

    default:
      return state;
  }
}

export function useBattleEffects(): UseBattleEffectsResult {
  const [state, dispatch] = useReducer(battleEffectsReducer, initialState);

  const handCardElementsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const selfUnitsZoneRef = useRef<HTMLDivElement | null>(null);
  const enemyHeroRef = useRef<HTMLDivElement | null>(null);

  const spawnCardFlyEffect = useCallback((card: CardModel, targetRect?: DOMRect | null) => {
    const fromElement = handCardElementsRef.current[card.id];
    const toRect = targetRect ?? selfUnitsZoneRef.current?.getBoundingClientRect() ?? null;

    if (!fromElement || !toRect) return;

    const fromRect = fromElement.getBoundingClientRect();
    const targetWidth = fromRect.width * 0.8;
    const targetHeight = fromRect.height * 0.8;
    const targetLeft =
      targetRect
        ? toRect.left + 16
        : toRect.left + toRect.width / 2 - targetWidth / 2;
    const targetTop =
      targetRect
        ? toRect.top + 16
        : toRect.top + toRect.height / 2 - targetHeight / 2;

    dispatch({
      type: "cardFlySpawned",
      effect: {
        id: `fly-${Date.now()}-${card.id}`,
        type: "card_fly",
        playedCardId: card.id.split(":")[0],
        card,
        from: {
          left: fromRect.left,
          top: fromRect.top,
          width: fromRect.width,
          height: fromRect.height,
        },
        to: {
          left: targetLeft,
          top: targetTop,
          width: targetWidth,
          height: targetHeight,
        },
      },
    });
  }, []);

  const spawnSpellBurstEffect = useCallback((
    triadType: CardModel["triad_type"],
    targetRect?: DOMRect | null
  ) => {
    if (!targetRect) return;

    dispatch({
      type: "effectSpawned",
      effect: {
        id: `burst-${Date.now()}-${triadType}`,
        type: "spell_burst",
        triadType,
        target: {
          left: targetRect.left,
          top: targetRect.top,
          width: targetRect.width,
          height: targetRect.height,
        },
      } satisfies SpellBurstEffect,
    });
  }, []);

  const spawnHitTextEffect = useCallback((
    text: string,
    targetRect?: DOMRect | null,
    tone: HitTextEffect["tone"] = "damage"
  ) => {
    if (!targetRect) return;

    dispatch({
      type: "effectSpawned",
      effect: {
        id: `hit-text-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "hit_text",
        text,
        tone,
        target: {
          left: targetRect.left,
          top: targetRect.top,
          width: targetRect.width,
          height: targetRect.height,
        },
      } satisfies HitTextEffect,
    });
  }, []);

  const triggerEnemyHeroShake = useCallback(() => {
    dispatch({ type: "enemyHeroShakeTriggered" });
  }, []);

  const triggerEnemyHeroFlash = useCallback(() => {
    dispatch({ type: "enemyHeroFlashTriggered" });
  }, []);

  const triggerEnemyUnitShake = useCallback((unitId: string) => {
    dispatch({ type: "enemyUnitShakeTriggered", unitId });
  }, []);

  const triggerEnemyUnitFlash = useCallback((unitId: string) => {
    dispatch({ type: "enemyUnitFlashTriggered", unitId });
  }, []);

  const completeEffect = useCallback((effect: BattleEffect) => {
    dispatch({ type: "effectCompleted", effect });
  }, []);

  return {
    battleEffects: state.battleEffects,
    enemyHeroShakeToken: state.enemyHeroShakeToken,
    enemyHeroFlashToken: state.enemyHeroFlashToken,
    enemyUnitShake: state.enemyUnitShake,
    enemyUnitFlash: state.enemyUnitFlash,
    handCardElementsRef,
    selfUnitsZoneRef,
    enemyHeroRef,
    spawnCardFlyEffect,
    spawnSpellBurstEffect,
    spawnHitTextEffect,
    triggerEnemyHeroShake,
    triggerEnemyHeroFlash,
    triggerEnemyUnitShake,
    triggerEnemyUnitFlash,
    completeEffect,
  };
}
