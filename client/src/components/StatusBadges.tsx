export type StatusView = { type: string; turns?: number; amount?: number };

type StatusBadgesProps = {
  statuses?: StatusView[];
  emptyLabel?: string;
};

function formatStatusLabel(status: StatusView): string {
  const type = String(status?.type || "unknown").toUpperCase();
  const hasTurns = Number.isFinite(status?.turns);
  const hasAmount = Number.isFinite(status?.amount);

  if (type === "SHIELD" && hasAmount && hasTurns) return `${type} +${status.amount} \u2022 ${status.turns}t`;
  if (type === "SHIELD" && hasAmount) return `${type} +${status.amount}`;
  if (hasTurns) return `${type} x${status.turns}`;
  return type;
}

function getStatusBadgeClass(statusType?: string): string {
  const type = String(statusType || "").toLowerCase();
  if (type === "burn") return "game-status-badge game-status-badge--burn";
  if (type === "weak") return "game-status-badge game-status-badge--weak";
  if (type === "stun") return "game-status-badge game-status-badge--stun";
  if (type === "shield") return "game-status-badge game-status-badge--shield";
  return "game-status-badge";
}

export default function StatusBadges({
  statuses,
  emptyLabel = "None",
}: StatusBadgesProps) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return <>{emptyLabel}</>;
  }

  return (
    <>
      {statuses.map((status, index) => (
        <span
          key={`${status.type}-${status.turns ?? "na"}-${status.amount ?? "na"}-${index}`}
          className={getStatusBadgeClass(status.type)}
        >
          {formatStatusLabel(status)}
        </span>
      ))}
    </>
  );
}
