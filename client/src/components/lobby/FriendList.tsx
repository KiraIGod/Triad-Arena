import React, { useState, useEffect, useRef, useCallback } from 'react'
import './FriendList.css'
import { FriendRequestsModal } from './FriendRequestModal'
import { useAppSelector } from '../../store'
import ChatModal from './ChatModal'
import { io } from 'socket.io-client'
import { Badge, notification } from 'antd'
import { isAxiosError } from 'axios'

import {
  fetchFriendsList,
  sendFriendRequest,
  Friend,
  FriendRequest,
  fetchUnreadCounts,
  markMessagesAsRead
} from '../../shared/api/friendsApi'

type FriendListProps = {
  privateArenaId?: string | null
  onSendInvite?: (arenaId: string, targetUserId: string) => Promise<{ error?: string }>
  onInviteResult?: (res: { error?: string }) => void
}

export const FriendList: React.FC<FriendListProps> = ({ privateArenaId, onSendInvite, onInviteResult }) => {
  const token = useAppSelector((s) => s.auth.token)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [addUsername, setAddUsername] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [activeChatFriend, setActiveChatFriend] = useState<Friend | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const activeChatRef = useRef<string | null>(null)

  const loadFriends = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetchFriendsList(token)
      setFriends(data.friends)
      setRequests(data.requests)

      // Не ломаем загрузку списка друзей из-за проблем с unread-счетчиками.
      // Сервер может временно падать (например, таблица чата не создана),
      // а заявки/друзья должны все равно отображаться.
      try {
        const counts = await fetchUnreadCounts(token)
        setUnreadCounts(counts)
      } catch (error) {
        console.error('Failed to load unread counts', error)
        setUnreadCounts({})
      }
    } catch (error) {
      console.error('Failed to load friends', error)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadFriends()
  }, [loadFriends])

  useEffect(() => {
    if (!token) return

    const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const socketUrl = rawUrl.replace(/\/api\/?$/, '')

    const socketInstance = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true
    })

    socketInstance.on('new_message_notification', (data: { senderId: string }) => {
      if (activeChatRef.current === data.senderId) return;

      setUnreadCounts((prev) => ({
        ...prev,
        [data.senderId]: (prev[data.senderId] || 0) + 1
      }))
    })

    socketInstance.on('friend_request_received', (data: { senderUsername: string }) => {
      notification.info({
        message: `New friend request from ${data.senderUsername}`,
        placement: 'top',
        className: 'arena-custom-notification',
        duration: 3,
      })
      loadFriends()
    })

    socketInstance.on('friend_request_accepted', (data: { receiverUsername: string }) => {
      notification.success({
        message: `${data.receiverUsername} accepted your request`,
        placement: 'top',
        className: 'arena-custom-notification',
        duration: 3,
      })
      loadFriends()
    })

    return () => {
      socketInstance.disconnect()
    }
  }, [token, loadFriends])

  useEffect(() => {
    activeChatRef.current = activeChatFriend?.id || null

    if (activeChatFriend && token) {
      setUnreadCounts((prev) => ({ ...prev, [activeChatFriend.id]: 0 }))
      markMessagesAsRead(token, activeChatFriend.id).catch((err) =>
        console.error("Ошибка при сбросе счетчика в БД:", err)
      )
    }
  }, [activeChatFriend, token])

  const onlineFriends = friends.filter((f) => f.status === "online")
  const offlineFriends = friends.filter((f) => f.status === "offline")

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addUsername.trim() || !token) return

    try {
      await sendFriendRequest(token, addUsername)

      notification.success({
        message: `Friend request sent to ${addUsername}`,
        placement: 'top',
        className: 'arena-custom-notification',
        duration: 3,
      })

      setAddUsername('')
      setIsAdding(false)
      loadFriends()
    }
    catch (error) {
      let errorMessage = 'Failed to send request'

      if (isAxiosError(error)) {
        errorMessage = error.response?.data?.message || errorMessage
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      notification.error({
        message: errorMessage,
        placement: 'top',
        className: 'arena-custom-notification',
      })
    }
  }

  const refreshData = () => {
    loadFriends()
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
              <Badge count={unreadCounts[friend.id]} offset={[6, -3]} size="small">
                <span className="friend-name">{friend.username}</span>
              </Badge>
              {privateArenaId && onSendInvite && (
                <button
                  className="friend-invite-btn"
                  onClick={() => {
                    onSendInvite(privateArenaId, friend.id).then((res) => onInviteResult?.(res))
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
              <Badge count={unreadCounts[friend.id]} offset={[6, -3]} size="small">
                <span className="friend-name">{friend.username}</span>
              </Badge>
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