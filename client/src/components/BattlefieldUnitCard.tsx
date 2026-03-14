import type { ReactNode } from "react";
import { motion } from "motion/react";
import { GameCard, type CardModel } from "./Card";
import type { UnitInstance } from "../shared/socket/matchSocket";

type StatusView = { type: string; turns?: number; amount?: number };

type BattlefieldUnitCardProps = {
  unit: UnitInstance;
  enterIndex: number;
  isOwn: boolean;
  isMyTurn: boolean;
  isAnyTargetingMode: boolean;
  selectedAttackerId: string | null;
  cardCatalog: Record<string, CardModel>;
  onOwnUnitClick: (unit: UnitInstance) => void;
  onEnemyUnitClick: (unit: UnitInstance, targetRect?: DOMRect) => void;
  onMount?: (unitId: string, element: HTMLDivElement | null) => void;
  renderStatuses: (statuses?: StatusView[]) => ReactNode;
};

export default function BattlefieldUnitCard({
  unit,
  enterIndex,
  isOwn,
  isMyTurn,
  isAnyTargetingMode,
  selectedAttackerId,
  cardCatalog,
  onOwnUnitClick,
  onEnemyUnitClick,
  onMount,
  renderStatuses,
}: BattlefieldUnitCardProps) {
  const isSelected = isOwn && unit.instanceId === selectedAttackerId;
  const isAttackable = isOwn && isMyTurn && unit.canAttack && !isAnyTargetingMode;
  const isTargetable = !isOwn && isAnyTargetingMode;
  const isSick = !unit.canAttack && !unit.hasAttacked;
  const unitShield = Array.isArray(unit.statuses)
    ? unit.statuses
      .filter((status) => String(status?.type || "").toLowerCase() === "shield")
      .reduce((total, status) => total + (Number(status?.amount) || 0), 0)
    : 0;

  let unitClass = "battlefield-unit-card";
  if (isSelected) unitClass += " battlefield-unit--selected";
  if (isAttackable) unitClass += " battlefield-unit--can-attack";
  if (isTargetable) unitClass += " battlefield-unit--targetable";
  if (isSick) unitClass += " battlefield-unit--sick";

  const base = cardCatalog[unit.cardId];
  const card: CardModel = {
    id: unit.cardId,
    name: unit.name || base?.name || "Unknown Unit",
    type: String(base?.type || "UNIT").toUpperCase() as CardModel["type"],
    triad_type: String(unit.triad_type || base?.triad_type || "ASSAULT").toUpperCase() as CardModel["triad_type"],
    mana_cost: base?.mana_cost ?? 0,
    attack: unit.attack,
    hp: unit.hp,
    description: base?.description || "Unit on the battlefield",
    image: unit.image || base?.image || "crimson_duelist.png",
    created_at: base?.created_at || "",
  };

  return (
    <motion.div
      className={unitClass}
      ref={(element) => onMount?.(unit.instanceId, element)}
      onClick={(event) => {
        if (isOwn) {
          onOwnUnitClick(unit);
          return;
        }

        onEnemyUnitClick(unit, event.currentTarget.getBoundingClientRect());
      }}
      title={isSick ? "Summoning sickness - can attack next turn" : unit.canAttack ? "Ready to attack" : "Already attacked"}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 1.5, filter: "blur(3px)" }}
      whileHover={isAttackable || isTargetable ? { y: -2 } : undefined}
      transition={{
        duration: 2,
        ease: "easeOut",
        delay: enterIndex * 0.06,
      }}
    >
      <GameCard card={card} size="small" />
      {unitShield > 0 && <span className="battlefield-unit__shield">SH {unitShield}</span>}
      {Array.isArray(unit.statuses) && unit.statuses.length > 0 && (
        <div className="battlefield-unit__statuses">
          {renderStatuses(unit.statuses)}
        </div>
      )}
      {isSelected && <span className="battlefield-unit__badge">{"\u2694"}</span>}
    </motion.div>
  );
}
