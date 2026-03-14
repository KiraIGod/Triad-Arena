import React, { useState, useEffect } from 'react'
import './FriendList.css'
import { FriendRequestsModal } from './FriendRequestModal'
import { fetchFriendsList, sendFriendRequest, Friend, FriendRequest } from '../../shared/api/friendsApi'
import { useAppSelector } from '../../store'
import ChatModal from './ChatModal'

type FriendListProps = {
  privateArenaId?: string | null;
  onSendInvite?: (arenaId: string, targetUserId: string) => Promise<{ error?: string }>;
  onInviteResult?: (res: { error?: string }) => void;
};

export const FriendList: React.FC<FriendListProps> = ({ privateArenaId, onSendInvite, onInviteResult }) => {
  const token = useAppSelector((s) => s.auth.token)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [addUsername, setAddUsername] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const [activeChatFriend, setActiveChatFriend] = useState<Friend | null>(null)

  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)

  const loadFriends = async () => {
    if (!token) return
    try {
      setLoading(true)
      const data = await fetchFriendsList(token)
      setFriends(data.friends)
      setRequests(data.requests)
    }
    catch (error) {
      console.error('Failed to load friends', error)
    }
    finally {
      setLoading(false)
    }
  };

  useEffect(() => {
    loadFriends()
  }, [token])

  const onlineFriends = friends.filter((f) => f.status === "online")
  const offlineFriends = friends.filter((f) => f.status === "offline")

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addUsername.trim() || !token) return

    try {
      await sendFriendRequest(token, addUsername)
      alert('Request sent successfully!')
      setAddUsername('')
      setIsAdding(false)
      loadFriends()
    }
    catch (error: any) {
      alert(error.response?.data?.message || 'Failed to send request')
    }
  }

  const refreshData = () => {
    loadFriends();
  }

  if (loading) {
    return (
      <div
        className="friend-list-container"
        style={{
          padding: "20px",
          textAlign: "center",
        }}
      >
        Loading...
      </div>
    )
  }

  return (
    <div className="friend-list-container">
      <div className="friend-list-header">
        <h3 className="friend-list-title">FRIENDS</h3>
        <button
          className="friend-add-btn"
          onClick={() => setIsAdding(!isAdding)}
          title="Add Friend"
        >
          +
        </button>
      </div>

      {isAdding && (
        <form className="friend-add-form" onSubmit={handleAddFriend}>
          <input
            type="text"
            placeholder="Enter username..."
            value={addUsername}
            onChange={(e) => setAddUsername(e.target.value)}
            className="friend-input"
          />
          <button type="submit" className="friend-submit-btn">
            SEND
          </button>
        </form>
      )}

      <div className="friend-list-content">
        <div className="friend-group">
          <div className="friend-group-title">
            ONLINE ({onlineFriends.length})
          </div>
          {onlineFriends.map(friend => (
            <div
              key={friend.id}
              className="friend-item"
              onDoubleClick={() => setActiveChatFriend(friend)}
              style={{ cursor: 'pointer' }}
            >
              <span className="status-dot online"></span>
              <span className="friend-name">{friend.username}</span>
              {privateArenaId && onSendInvite && (
                <button
                  className="friend-invite-btn"
                  onClick={() => {
                    onSendInvite(privateArenaId, friend.id).then((res) => onInviteResult?.(res));
                  }}
                  title={`Invite ${friend.username}`}
                >
                  Invite
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="friend-group">
          <div className="friend-group-title">
            OFFLINE ({offlineFriends.length})
          </div>
          {offlineFriends.map(friend => (
            <div
              key={friend.id}
              className="friend-item offline-item"
              onDoubleClick={() => setActiveChatFriend(friend)}
              style={{ cursor: 'pointer' }}
            >
              <span className="status-dot offline"></span>
              <span className="friend-name">{friend.username}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        className="friend-requests-btn"
        onClick={() => setIsModalOpen(true)}
      >
        FRIEND REQUESTS
        {requests.length > 0 && (
          <span className="request-badge">{requests.length}</span>
        )}
      </button>

      {isModalOpen && (
        <FriendRequestsModal
          onClose={() => setIsModalOpen(false)}
          requests={requests}
          onRespond={refreshData}
          token={token}
        />
      )}

      {activeChatFriend && (
        <ChatModal
          friend={activeChatFriend}
          onClose={() => setActiveChatFriend(null)}
        />
      )}
    </div>
  )
}
