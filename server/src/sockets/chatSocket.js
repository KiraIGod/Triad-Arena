function registerChatSocket(io) {
  io.on("connection", (socket) => {

    socket.on("join_private_chat", ({ friendId }) => {
      if (!friendId) return

      const myId = socket.data?.userId
      if (!myId) return

      const roomName = [myId, friendId].sort().join('_')
      socket.join(roomName)
    })

    socket.on("send_private_message", ({ friendId, text }) => {
      if (!friendId || !text) return

      const myId = socket.data?.userId
      if (!myId) return

      const roomName = [myId, friendId].sort().join('_')

      const messageData = {
        id: Date.now().toString(),
        senderId: myId,
        text,
        timestamp: new Date().toISOString()
      }

      io.to(roomName).emit("receive_private_message", messageData)
    })

  })
}

module.exports = registerChatSocket