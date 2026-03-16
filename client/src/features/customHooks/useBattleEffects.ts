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
  selfHeroShakeToken: number;
  selfHeroFlashToken: number;
  enemyHeroShakeToken: number;
  enemyHeroFlashToken: number;
  selfUnitShake: UnitShakeState;
  selfUnitFlash: UnitShakeState;
  enemyUnitShake: UnitShakeState;
  enemyUnitFlash: UnitShakeState;
};

type BattleEffectsAction =
  | { type: "cardFlySpawned"; effect: Extract<BattleEffect, { type: "card_fly" }> }
  | { type: "effectSpawned"; effect: Exclude<BattleEffect, { type: "card_fly" }> }
  | { type: "effectCompleted"; effect: BattleEffect }
  | { type: "selfHeroShakeTriggered" }
  | { type: "selfHeroFlashTriggered" }
  | { type: "enemyHeroShakeTriggered" }
  | { type: "enemyHeroFlashTriggered" }
  | { type: "selfUnitShakeTriggered"; unitId: string }
  | { type: "selfUnitFlashTriggered"; unitId: string }
  | { type: "enemyUnitShakeTriggered"; unitId: string }
  | { type: "enemyUnitFlashTriggered"; unitId: string };

type UseBattleEffectsResult = {
  battleEffects: BattleEffect[];
  selfHeroShakeToken: number;
  selfHeroFlashToken: number;
  enemyHeroShakeToken: number;
  enemyHeroFlashToken: number;
  selfUnitShake: UnitShakeState;
  selfUnitFlash: UnitShakeState;
  enemyUnitShake: UnitShakeState;
  enemyUnitFlash: UnitShakeState;
  handCardElementsRef: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  opponentHandZoneRef: React.MutableRefObject<HTMLDivElement | null>;
  selfUnitsZoneRef: React.MutableRefObject<HTMLDivElement | null>;
  enemyUnitsZoneRef: React.MutableRefObject<HTMLDivElement | null>;
  enemyHeroRef: React.MutableRefObject<HTMLDivElement | null>;
  spawnCardFlyEffect: (card: CardModel, targetRect?: DOMRect | null) => void;
  spawnOpponentUnitFlyEffect: (card: CardModel, targetRect?: DOMRect | null) => void;
  spawnSpellBurstEffect: (triadType: CardModel["triad_type"], targetRect?: DOMRect | null) => void;
  spawnHitTextEffect: (text: string, targetRect?: DOMRect | null, tone?: HitTextEffect["tone"]) => void;
  triggerSelfHeroShake: () => void;
  triggerSelfHeroFlash: () => void;
  triggerSelfUnitShake: (unitId: string) => void;
  triggerSelfUnitFlash: (unitId: string) => void;
  triggerEnemyHeroShake: () => void;
  triggerEnemyHeroFlash: () => void;
  triggerEnemyUnitShake: (unitId: string) => void;
  triggerEnemyUnitFlash: (unitId: string) => void;
  completeEffect: (effect: BattleEffect) => void;
};

const initialState: BattleEffectsState = {
  battleEffects: [],
  selfHeroShakeToken: 0,
  selfHeroFlashToken: 0,
  enemyHeroShakeToken: 0,
  enemyHeroFlashToken: 0,
  selfUnitShake: { id: null, token: 0 },
  selfUnitFlash: { id: null, token: 0 },
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

    case "selfHeroShakeTriggered":
      return {
        ...state,
        selfHeroShakeToken: state.selfHeroShakeToken + 1,
      };

    case "selfHeroFlashTriggered":
      return {
        ...state,
        selfHeroFlashToken: state.selfHeroFlashToken + 1,
      };

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

    case "selfUnitShakeTriggered":
      return {
        ...state,
        selfUnitShake: {
          id: action.unitId,
          token: state.selfUnitShake.token + 1,
        },
      };

    case "selfUnitFlashTriggered":
      return {
        ...state,
        selfUnitFlash: {
          id: action.unitId,
          token: state.selfUnitFlash.token + 1,
        },
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
  const opponentHandZoneRef = useRef<HTMLDivElement | null>(null);
  const selfUnitsZoneRef = useRef<HTMLDivElement | null>(null);
  const enemyUnitsZoneRef = useRef<HTMLDivElement | null>(null);
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

  const spawnOpponentUnitFlyEffect = useCallback((card: CardModel, targetRect?: DOMRect | null) => {
    const fromZone = opponentHandZoneRef.current;
    const toZone = enemyUnitsZoneRef.current;

    if (!fromZone) return;
    if (!targetRect && !toZone) return;

    const fromZoneRect = fromZone.getBoundingClientRect();
    const toZoneRect = targetRect ?? toZone?.getBoundingClientRect();
    if (!toZoneRect) return;
    const fromWidth = 116;
    const fromHeight = 176;
    const toWidth = fromWidth * 0.8;
    const toHeight = fromHeight * 0.8;
    const fromLeft = fromZoneRect.left + fromZoneRect.width / 2 - fromWidth / 2;
    const fromTop = fromZoneRect.top + fromZoneRect.height / 2 - fromHeight / 2;
    const toLeft = toZoneRect.left + toZoneRect.width / 2 - toWidth / 2;
    const toTop = toZoneRect.top + toZoneRect.height / 2 - toHeight / 2;

    dispatch({
      type: "cardFlySpawned",
      effect: {
        id: `opp-fly-${Date.now()}-${card.id}`,
        type: "card_fly",
        playedCardId: card.id,
        card,
        from: {
          left: fromLeft,
          top: fromTop,
          width: fromWidth,
          height: fromHeight,
        },
        to: {
          left: toLeft,
          top: toTop,
          width: toWidth,
          height: toHeight,
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

  const triggerSelfHeroShake = useCallback(() => {
    dispatch({ type: "selfHeroShakeTriggered" });
  }, []);

  const triggerSelfHeroFlash = useCallback(() => {
    dispatch({ type: "selfHeroFlashTriggered" });
  }, []);

  const triggerEnemyHeroShake = useCallback(() => {
    dispatch({ type: "enemyHeroShakeTriggered" });
  }, []);

  const triggerEnemyHeroFlash = useCallback(() => {
    dispatch({ type: "enemyHeroFlashTriggered" });
  }, []);

  const triggerSelfUnitShake = useCallback((unitId: string) => {
    dispatch({ type: "selfUnitShakeTriggered", unitId });
  }, []);

  const triggerSelfUnitFlash = useCallback((unitId: string) => {
    dispatch({ type: "selfUnitFlashTriggered", unitId });
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
    selfHeroShakeToken: state.selfHeroShakeToken,
    selfHeroFlashToken: state.selfHeroFlashToken,
    enemyHeroShakeToken: state.enemyHeroShakeToken,
    enemyHeroFlashToken: state.enemyHeroFlashToken,
    selfUnitShake: state.selfUnitShake,
    selfUnitFlash: state.selfUnitFlash,
    enemyUnitShake: state.enemyUnitShake,
    enemyUnitFlash: state.enemyUnitFlash,
    handCardElementsRef,
    opponentHandZoneRef,
    selfUnitsZoneRef,
    enemyUnitsZoneRef,
    enemyHeroRef,
    spawnCardFlyEffect,
    spawnOpponentUnitFlyEffect,
    spawnSpellBurstEffect,
    spawnHitTextEffect,
    triggerSelfHeroShake,
    triggerSelfHeroFlash,
    triggerSelfUnitShake,
    triggerSelfUnitFlash,
    triggerEnemyHeroShake,
    triggerEnemyHeroFlash,
    triggerEnemyUnitShake,
    triggerEnemyUnitFlash,
    completeEffect,
  };
}
