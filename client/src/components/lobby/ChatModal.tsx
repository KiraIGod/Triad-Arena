import React, { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppSelector } from '../../store/index'
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
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const token = useAppSelector(state => state.auth.token)
  const myUserId = useAppSelector(state => state.auth.userId)

  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
      auth: { token }
    })

    socketRef.current.emit('join_private_chat', { friendId: friend.id });

    socketRef.current.on('receive_private_message', (message: Message) => {
      setMessages(prev => [...prev, message])
    })

    return () => {
      socketRef.current?.disconnect()
    }
  }, [friend.id, token])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    socketRef.current?.emit('send_private_message', {
      friendId: friend.id,
      text: inputText.trim()
    })

    setInputText('')
  }

  return (
    <div className="arena-chat-modal">
      <div className="chat-header">
        <span>Чат с {friend.username}</span>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => {
          const isMine = msg.senderId === myUserId;
          return (
            <div key={msg.id} className={`message-wrapper ${isMine ? 'mine' : 'theirs'}`}>
              <div className="message-bubble">{msg.text}</div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="chat-input-area">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Введите сообщение..."
          className="chat-input"
        />
        <button type="submit" className="chat-send-btn">➤</button>
      </form>
    </div>
  )
}

export default ChatModal