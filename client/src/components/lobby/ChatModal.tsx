import React, { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppSelector } from '../../store/index'
import { Modal } from 'antd'
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable'
import { Resizable } from 'react-resizable'
import { fetchChatHistory } from '../../shared/api/friendsApi'
import 'react-resizable/css/styles.css'
import './ChatModal.css'

interface Message {
  id: string
  senderId: string
  text: string
  timestamp: string
}

interface Friend {
  id: string
  username: string
}

interface ChatModalProps {
  friend: Friend
  onClose: () => void
}

const ChatModal = ({ friend, onClose }: ChatModalProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isInitialScroll = useRef(true)

  const token = useAppSelector((state) => state.auth.token)
  const myUserId = useAppSelector((state) => state.auth.userId)

  const draggleRef = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState({
    left: 0,
    top: 0,
    bottom: 0,
    right: 0
  })
  const [disabled, setDisabled] = useState(true)

  const [width, setWidth] = useState(320)
  const [height, setHeight] = useState(400)

  useEffect(() => {
    const loadHistory = async () => {
      if (!token || !friend.id) return

      try {
        setIsLoadingHistory(true);
        const history = await fetchChatHistory(token, friend.id)

        const formattedHistory = history.map((msg) => ({
          id: msg.id,
          senderId: msg.senderId,
          text: msg.text,
          timestamp: msg.createdAt
        }))

        setMessages(formattedHistory)
      }
        catch (error) {
        console.error('Ошибка загрузки истории чата:', error)
      }
        finally {
        setIsLoadingHistory(false)
      }
    }

    loadHistory()
  }, [friend.id, token])

  useEffect(() => {
    if (!token) return;

    const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const socketUrl = rawUrl.replace(/\/api\/?$/, '')

    const socketInstance = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5
    })

    socketInstance.on('connect', () => {
      socketInstance.emit('join_private_chat', {
        friendId: friend.id,
        myId: myUserId
      })
    })

    socketInstance.on('receive_private_message', (message: Message) => {
      setMessages((prev) => [...prev, message])
    })

    socketRef.current = socketInstance

    return () => {
      socketInstance.disconnect();
      socketRef.current = null
    }
  }, [friend.id, token, myUserId])

  useEffect(() => {
    if (messages.length === 0) return;

    if (isInitialScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      isInitialScroll.current = false;
    }
      else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || !socketRef.current?.connected) return

    socketRef.current.emit('send_private_message', {
      friendId: friend.id,
      text: inputText.trim(),
      myId: myUserId
    })

    setInputText('')
  }

  const onStartDrag = (_event: DraggableEvent, uiData: DraggableData) => {
    const { clientWidth, clientHeight } = window.document.documentElement
    const targetRect = draggleRef.current?.getBoundingClientRect()
    if (!targetRect) return
    setBounds({
      left: -targetRect.left + uiData.x,
      right: clientWidth - (targetRect.right - uiData.x),
      top: -targetRect.top + uiData.y,
      bottom: clientHeight - (targetRect.bottom - uiData.y),
    })
  }

  return (
    <Modal
      title={
        <div
          style={{
            width: '100%',
            cursor: 'move',
            color: '#c9a34e'
          }}
          onMouseOver={() => disabled && setDisabled(false)}
          onMouseOut={() => setDisabled(true)}
          className="chat-modal-drag-handle"
        >
          Чат с {friend.username}
        </div>
      }
      open={true}
      onCancel={onClose}
      footer={null}
      mask={false}
      maskClosable={false}
      width={width}
      style={{
        top: '20vh',
        left: 360,
        margin: 0,
        padding: 0,
        position: 'absolute'
      }}
      modalRender={(modal) => (
        <Draggable
          disabled={disabled}
          bounds={bounds}
          nodeRef={draggleRef}
          onStart={onStartDrag}
          handle=".chat-modal-drag-handle"
          cancel=".react-resizable-handle"
        >
          <div ref={draggleRef} style={{ pointerEvents: 'auto' }}>
            <Resizable
              width={width}
              height={height}
              minConstraints={[280, 300]}
              maxConstraints={[800, 800]}
              onResizeStop={(e, data) => {
                setWidth(data.size.width);
                setHeight(data.size.height);
              }}
              onResize={(e, data) => {
                setWidth(data.size.width);
                setHeight(data.size.height);
              }}
            >
              <div
                className="chat-resizable-container"
                style={{
                    width: `${width}px`,
                    height: `${height}px`
                  }}
              >
                {modal}
              </div>
            </Resizable>
          </div>
        </Draggable>
      )}
      className="arena-antd-chat-modal"
    >
      <div className="chat-messages">
        {isLoadingHistory ? (
          <div style={{
              color: '#c9a34e',
              textAlign: 'center',
              marginTop: '20px'
            }}>
            Загрузка истории...
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === myUserId;
            return (
              <div key={msg.id} className={`message-wrapper ${isMine ? 'mine' : 'theirs'}`}>
                <div className="message-bubble">{msg.text}</div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="chat-input-area">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Введите сообщение..."
          className="chat-input"
          disabled={isLoadingHistory}
        />
        <button type="submit" className="chat-send-btn" disabled={isLoadingHistory}>➤</button>
      </form>
    </Modal>
  )
}

export default ChatModal