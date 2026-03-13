type LeaveArenaConfirmModalProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};


export default function LeaveArenaConfirmModal({
  open,
  onCancel,
  onConfirm,
}: LeaveArenaConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="game-overlay game-overlay--confirm">
      <div className="game-overlay__panel parchment-panel game-state">
        <span className="comic-text-shadow">Leave arena?</span>
        <div className="game-actions" style={{ marginTop: 12, justifyContent: "center" }}>
          <button type="button" className="game-end-turn game-end-turn--gold" onClick={onCancel}>
            Stay
          </button>
          <button type="button" className="game-end-turn stress-warning" onClick={onConfirm}>
            Leave
          </button>
        </div>
      </div>
    </div>
  )
}
