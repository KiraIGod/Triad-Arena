import React from "react";
import "./FriendList.css";
import {
  FriendRequest,
  respondToFriendRequest,
} from "../../shared/api/friendsApi";

interface FriendRequestsModalProps {
  onClose: () => void;
  requests: FriendRequest[];
  onRespond: () => void;
  token: string | null;
}

export const FriendRequestsModal: React.FC<FriendRequestsModalProps> = ({
  onClose,
  requests,
  onRespond,
  token,
}) => {
  const handleResponse = async (
    requestId: string,
    action: "accept" | "decline",
  ) => {
    if (!token) return;
    try {
      await respondToFriendRequest(token, requestId, action);
      onRespond();
    } catch (error) {
      console.error(`Failed to ${action} request`, error);
      alert(`Failed to ${action} request`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>FRIEND REQUESTS</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {requests.length === 0 ? (
            <p
              className="no-requests"
              style={{
                color: "#8a7a6a",
                textAlign: "center",
              }}
            >
              No pending requests.
            </p>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="request-item">
                <span className="request-name">{req.username}</span>
                <div className="request-actions">
                  <button
                    className="req-btn accept"
                    onClick={() => handleResponse(req.id, "accept")}
                    title="Accept"
                  >
                    ✓
                  </button>
                  <button
                    className="req-btn decline"
                    onClick={() => handleResponse(req.id, "decline")}
                    title="Decline"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
