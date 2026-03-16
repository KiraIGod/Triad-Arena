import { useCallback, useReducer } from "react";
import type { MutableRefObject } from "react";
import type { CardModel } from "../../components/Card";
import type { HitTextEffect } from "../../components/BattleEffectsLayer";
import {
  attackWithUnit,
  endMatchTurn,
  playMatchCard,
  type MatchStatePayload,
  type UnitInstance,
} from "../../shared/socket/matchSocket";

const MAX_BOARD_UNITS = 5;
const SPELL_VISUAL_LEAD_MS = 90;
const SPELL_UNIT_BURST_DELAY_MS = 120;
const SPELL_HERO_BURST_DELAY_MS = 180;

export type AttackState =
  | { mode: "idle" }
  | { mode: "selectingTarget"; attackerInstanceId: string }
  | { mode: "selectingSpellTarget"; spellCardId: string; originalCardId: string; actionId: string };

type AttackStateAction =
  | { type: "set"; nextState: AttackState }
  | { type: "reset" }
  | { type: "selectTarget"; attackerInstanceId: string }
  | { type: "selectSpellTarget"; spellCardId: string; originalCardId: string; actionId: string };

type ViewStatus = { type: string; turns?: number; amount?: number };

type ViewPlayerState = {
  hp: number;
  shield: number;
  energy: number;
  statuses: ViewStatus[];
  board: UnitInstance[];
};

type UseGameActionsParams = {
  match: MatchStatePayload | null;
  userIdStr: string | null;
  isMyTurn: boolean;
  selfIndex: number;
  selfStats: ViewPlayerState;
  currentEnergy: number;
  handCards: CardModel[];
  playedCardIdsThisTurn: Set<string>;
  isSameUser: (value: string | number | null | undefined) => boolean;
  enemyHeroRef: MutableRefObject<HTMLDivElement | null>;
  hideBattlefieldHint: () => void;
  showBattlefieldHint: (message: string | null) => void;
  hideHandHint: () => void;
  showHandHint: (message: string | null) => void;
  spawnCardFlyEffect: (card: CardModel, targetRect?: DOMRect | null) => void;
  spawnSpellBurstEffect: (triadType: CardModel["triad_type"], targetRect?: DOMRect | null) => void;
  spawnHitTextEffect: (text: string, targetRect?: DOMRect | null, tone?: HitTextEffect["tone"]) => void;
  triggerEnemyHeroShake: () => void;
  triggerEnemyHeroFlash: () => void;
  triggerEnemyUnitShake: (unitId: string) => void;
  triggerEnemyUnitFlash: (unitId: string) => void;
  setSelectedCardId: React.Dispatch<React.SetStateAction<string | null>>;
  setMatchError: React.Dispatch<React.SetStateAction<string | null>>;
};

type UseGameActionsResult = {
  attackState: AttackState;
  setAttackState: React.Dispatch<React.SetStateAction<AttackState>>;
  getCardDisabledReason: (card: CardModel) => string | null;
  canPlayCard: (card: CardModel) => boolean;
  handleCardClick: (card: CardModel) => void;
  handleMyUnitClick: (unit: UnitInstance) => void;
  handleEnemyUnitClick: (unit: UnitInstance, targetRect?: DOMRect) => void;
  handleEnemyHeroClick: () => void;
  handleEndTurnClick: () => void;
};

function attackStateReducer(state: AttackState, action: AttackStateAction): AttackState {
  switch (action.type) {
    case "set":
      return action.nextState;
    case "reset":
      return { mode: "idle" };
    case "selectTarget":
      return { mode: "selectingTarget", attackerInstanceId: action.attackerInstanceId };
    case "selectSpellTarget":
      return {
        mode: "selectingSpellTarget",
        spellCardId: action.spellCardId,
        originalCardId: action.originalCardId,
        actionId: action.actionId,
      };
    default:
      return state;
  }
}

export function useGameActions({
  match,
  userIdStr,
  isMyTurn,
  selfIndex,
  selfStats,
  currentEnergy,
  handCards,
  playedCardIdsThisTurn,
  isSameUser,
  enemyHeroRef,
  hideBattlefieldHint,
  showBattlefieldHint,
  hideHandHint,
  showHandHint,
  spawnCardFlyEffect,
  spawnSpellBurstEffect,
  spawnHitTextEffect,
  triggerEnemyHeroShake,
  triggerEnemyHeroFlash,
  triggerEnemyUnitShake,
  triggerEnemyUnitFlash,
  setSelectedCardId,
  setMatchError,
}: UseGameActionsParams): UseGameActionsResult {
  const [attackState, dispatchAttackState] = useReducer(attackStateReducer, { mode: "idle" } as AttackState);

  const setAttackState = useCallback<React.Dispatch<React.SetStateAction<AttackState>>>((next) => {
    if (typeof next === "function") {
      dispatchAttackState({
        type: "set",
        nextState: (next as (prev: AttackState) => AttackState)(attackState),
      });
      return;
    }

    dispatchAttackState({ type: "set", nextState: next });
  }, [attackState]);

  const resetActionUi = useCallback(() => {
    dispatchAttackState({ type: "reset" });
    hideBattlefieldHint();
    hideHandHint();
    setSelectedCardId(null);
    setMatchError(null);
  }, [hideBattlefieldHint, hideHandHint, setMatchError, setSelectedCardId]);

  const getCardDisabledReason = useCallback((card: CardModel): string | null => {
    if (!match || !userIdStr) return "Match is not ready";
    if (selfIndex < 0) return "You are not part of this match";
    if (match.state.finished) return "Match already finished";
    if (!isMyTurn) return "Wait for your turn";
    if (card.type === "UNIT" && (selfStats.board?.length ?? 0) >= MAX_BOARD_UNITS) {
      return "Board is full";
    }
    if (playedCardIdsThisTurn.size >= 3) return "Card limit reached (3 cards per turn)";
    if (playedCardIdsThisTurn.has(card.id.split(":")[0])) return "Card already played this turn";
    if (currentEnergy < card.mana_cost) return "Not enough energy";
    if ((selfStats.statuses || []).some((status) => status?.type === "stun")) return "You are stunned";
    return null;
  }, [currentEnergy, isMyTurn, match, playedCardIdsThisTurn, selfIndex, selfStats.board, selfStats.statuses, userIdStr]);

  const canPlayCard = useCallback((card: CardModel): boolean => getCardDisabledReason(card) === null, [getCardDisabledReason]);

  const handleCardClick = useCallback((card: CardModel) => {
    if (attackState.mode === "selectingSpellTarget" && attackState.spellCardId === card.id) {
      dispatchAttackState({ type: "reset" });
      setSelectedCardId(null);
      hideBattlefieldHint();
      hideHandHint();
      return;
    }

    dispatchAttackState({ type: "reset" });
    hideBattlefieldHint();
    hideHandHint();
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));

    const reason = getCardDisabledReason(card);
    showHandHint(reason);
    if (reason || !match) return;

    const originalCardId = card.id.split(":")[0];
    const actionId = `${Date.now()}-${originalCardId}-${Math.random().toString(36).slice(2)}`;

    if (card.type === "SPELL") {
      dispatchAttackState({
        type: "selectSpellTarget",
        spellCardId: card.id,
        originalCardId,
        actionId,
      });
      showBattlefieldHint("Select a target: enemy unit or enemy hero");
      return;
    }

    spawnCardFlyEffect(card);
    playMatchCard({ matchId: match.matchId, cardId: originalCardId, actionId, version: match.state.version });
  }, [
    attackState,
    getCardDisabledReason,
    hideBattlefieldHint,
    hideHandHint,
    match,
    setSelectedCardId,
    showBattlefieldHint,
    showHandHint,
    spawnCardFlyEffect,
  ]);

  const handleMyUnitClick = useCallback((unit: UnitInstance) => {
    if (!isMyTurn || !match) return;

    if (attackState.mode === "selectingSpellTarget") {
      dispatchAttackState({ type: "reset" });
      setSelectedCardId(null);
      hideBattlefieldHint();
      hideHandHint();
      return;
    }

    if (attackState.mode === "selectingTarget" && attackState.attackerInstanceId === unit.instanceId) {
      dispatchAttackState({ type: "reset" });
      hideBattlefieldHint();
      hideHandHint();
      return;
    }

    if (!unit.canAttack) {
      showBattlefieldHint("This unit cannot attack yet");
      return;
    }

    setSelectedCardId(null);
    hideBattlefieldHint();
    hideHandHint();
    dispatchAttackState({ type: "selectTarget", attackerInstanceId: unit.instanceId });
  }, [attackState, hideBattlefieldHint, hideHandHint, isMyTurn, match, setSelectedCardId, showBattlefieldHint]);

  const handleEnemyUnitClick = useCallback((unit: UnitInstance, targetRect?: DOMRect) => {
    if (!match) return;

    if (attackState.mode === "selectingSpellTarget") {
      const spellCard = handCards.find((card) => card.id === attackState.spellCardId);
      if (spellCard) {
        triggerEnemyUnitShake(unit.instanceId);
        triggerEnemyUnitFlash(unit.instanceId);
        spawnCardFlyEffect(spellCard, targetRect);

        window.setTimeout(() => {
          const baseDamage = Math.max(0, Number(spellCard.attack) || 0);
          spawnHitTextEffect(
            baseDamage > 0 ? `-${baseDamage}` : "Hit",
            targetRect,
            spellCard.triad_type.toLowerCase() as HitTextEffect["tone"]
          );
        }, SPELL_UNIT_BURST_DELAY_MS - 20);

        window.setTimeout(() => {
          spawnSpellBurstEffect(spellCard.triad_type, targetRect);
        }, SPELL_UNIT_BURST_DELAY_MS);
      }

      window.setTimeout(() => {
        playMatchCard({
          matchId: match.matchId,
          cardId: attackState.originalCardId,
          actionId: attackState.actionId,
          version: match.state.version,
          targetType: "unit",
          targetId: unit.instanceId,
        });
      }, SPELL_VISUAL_LEAD_MS);

      resetActionUi();
      return;
    }

    if (attackState.mode !== "selectingTarget") return;

    const actionId = `atk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    triggerEnemyUnitFlash(unit.instanceId);
    const attackerDamage = Math.max(
      0,
      Number(selfStats.board.find((entry) => entry.instanceId === attackState.attackerInstanceId)?.attack) || 0
    );
    spawnHitTextEffect(`-${attackerDamage}`, targetRect);
    attackWithUnit({
      matchId: match.matchId,
      unitId: attackState.attackerInstanceId,
      targetType: "unit",
      targetId: unit.instanceId,
      actionId,
      version: match.state.version,
    });

    resetActionUi();
  }, [
    attackState,
    handCards,
    match,
    resetActionUi,
    selfStats.board,
    spawnCardFlyEffect,
    spawnHitTextEffect,
    spawnSpellBurstEffect,
    triggerEnemyUnitFlash,
    triggerEnemyUnitShake,
  ]);

  const handleEnemyHeroClick = useCallback(() => {
    if (!match) return;

    const enemyHeroId = match.players.find((id) => !isSameUser(id));

    if (attackState.mode === "selectingSpellTarget") {
      if (!enemyHeroId) {
        setMatchError("Enemy hero target not found");
        return;
      }

      const spellCard = handCards.find((card) => card.id === attackState.spellCardId);
      if (spellCard) {
        triggerEnemyHeroShake();
        triggerEnemyHeroFlash();
        const targetRect = enemyHeroRef.current?.getBoundingClientRect() ?? null;
        spawnCardFlyEffect(spellCard, targetRect);
        window.setTimeout(() => {
          const baseDamage = Math.max(0, Number(spellCard.attack) || 0);
          spawnHitTextEffect(
            baseDamage > 0 ? `-${baseDamage}` : "Hit",
            targetRect,
            spellCard.triad_type.toLowerCase() as HitTextEffect["tone"]
          );
        }, SPELL_HERO_BURST_DELAY_MS - 40);

        window.setTimeout(() => {
          spawnSpellBurstEffect(spellCard.triad_type, targetRect);
        }, SPELL_HERO_BURST_DELAY_MS);
      }

      window.setTimeout(() => {
        playMatchCard({
          matchId: match.matchId,
          cardId: attackState.originalCardId,
          actionId: attackState.actionId,
          version: match.state.version,
          targetType: "hero",
          targetId: enemyHeroId,
        });
      }, SPELL_VISUAL_LEAD_MS);

      resetActionUi();
      return;
    }

    if (attackState.mode !== "selectingTarget") return;

    if (!enemyHeroId) {
      setMatchError("Enemy hero target not found");
      return;
    }

    const actionId = `atk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    triggerEnemyHeroFlash();

    const targetRect = enemyHeroRef.current?.getBoundingClientRect() ?? null;
    spawnHitTextEffect(
      `-${Math.max(0, Number(selfStats.board.find((entry) => entry.instanceId === attackState.attackerInstanceId)?.attack) || 0)}`,
      targetRect
    );

    attackWithUnit({
      matchId: match.matchId,
      unitId: attackState.attackerInstanceId,
      targetType: "hero",
      targetId: enemyHeroId,
      actionId,
      version: match.state.version,
    });

    resetActionUi();
  }, [
    attackState,
    enemyHeroRef,
    handCards,
    isSameUser,
    match,
    resetActionUi,
    selfStats.board,
    setMatchError,
    spawnCardFlyEffect,
    spawnHitTextEffect,
    spawnSpellBurstEffect,
    triggerEnemyHeroFlash,
    triggerEnemyHeroShake,
  ]);

  const handleEndTurnClick = useCallback(() => {
    setSelectedCardId(null);
    hideHandHint();
    dispatchAttackState({ type: "reset" });
    hideBattlefieldHint();

    if (!match || !userIdStr) return;
    if (match.state.finished || !isSameUser(match.state.activePlayer)) return;

    endMatchTurn({ matchId: match.matchId, version: match.state.version });
  }, [hideBattlefieldHint, hideHandHint, isSameUser, match, setSelectedCardId, userIdStr]);

  return {
    attackState,
    setAttackState,
    getCardDisabledReason,
    canPlayCard,
    handleCardClick,
    handleMyUnitClick,
    handleEnemyUnitClick,
    handleEnemyHeroClick,
    handleEndTurnClick,
  };
}
