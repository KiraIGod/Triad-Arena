const db = require('../db/models')
const ChatMessage = db.ChatMessage

function registerChatSocket(io, socket) {
  if (socket.data?.userId) {
    socket.join(socket.data.userId)
  }

  const getRoomName = (id1, id2) => {
    return [String(id1), String(id2)].sort().join('_')
  }

  socket.on("join_private_chat", (data) => {
    console.log(`[ChatSocket JOIN] Сокет ${socket.id} запросил вход в чат. Данные:`, data)

    const myId = data.myId || socket.data?.userId
    const friendId = data.friendId

    if (!myId || !friendId) {
      console.log(`[ChatSocket JOIN] ОШИБКА: Нет ID.`)
      return
    }

    const roomName = getRoomName(myId, friendId)
    socket.join(roomName)
    console.log(`[ChatSocket JOIN] Юзер ${myId} вошел в ${roomName}`)
  })

  socket.on("send_private_message", async (data) => {
    console.log(`[ChatSocket SEND] Запрос на отправку от ${socket.id}:`, data)

    const myId = data.myId || socket.data?.userId
    const friendId = data.friendId
    const text = data.text

    if (!myId || !friendId || !text) {
      console.error('[ChatSocket SEND] ОШИБКА: Не хватает данных!')
      return
    }

    const roomName = getRoomName(myId, friendId)

    try {
      const newMessage = await ChatMessage.create({
        senderId: myId,
        receiverId: friendId,
        text: text
      })

      console.log(`[ChatSocket SEND] БД: Сообщение ${newMessage.id} сохранено!`)

      const messageData = {
        id: newMessage.id,
        senderId: newMessage.senderId,
        text: newMessage.text,
        timestamp: newMessage.createdAt
      }

      io.to(roomName).emit("receive_private_message", messageData)
      console.log(`[ChatSocket SEND] Отправлено в комнату ${roomName}`)

      socket.to(friendId).emit('new_message_notification', {
        senderId: myId
      })
    }
      catch (error) {
      console.error('[ChatSocket Error] Ошибка БД:', error)
    }
  })
}

module.exports = registerChatSocket
