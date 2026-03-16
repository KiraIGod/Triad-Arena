const express = require('express')
const { Op } = require('sequelize')
const db = require('../db/models')
console.log('=== ЗАГРУЖЕННЫЕ МОДЕЛИ ===', Object.keys(db))
const User = db.User
const Friend = db.Friend
const ChatMessage = db.ChatMessage || db.chatMessage
const { jwtMiddleware } = require('../middlewares/jwt')
const { isUserOnline } = require('../sockets')

const router = express.Router()
const getUserId = (req) => req.user.id || req.user.userId || req.user.user_id

router.get('/', jwtMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req)

    if (!userId) {
      console.log("ОШИБКА GET: В токене нет ID. Вот что там есть:", req.user)
      return res.status(401).json({ message: 'Invalid token payload' })
    }

    const friendships = await Friend.findAll({
      where: {
        [Op.or]: [{ userId }, { friendId: userId }]
      },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'nickname'] },
        { model: User, as: 'receiver', attributes: ['id', 'nickname'] }
      ]
    })

    const friends = []
    const requests = []

    friendships.forEach(f => {
      const otherUser = f.userId === userId ? f.receiver : f.sender

      if (f.status === 'accepted') {
        friends.push({
          id: otherUser.id,
          username: otherUser.nickname,
          status: isUserOnline(otherUser.id) ? 'online' : 'offline'
        })
      } else if (f.status === 'pending') {
        if (f.friendId === userId) {
          requests.push({
            id: f.id,
            userId: otherUser.id,
            username: otherUser.nickname
          })
        }
      }
    })

    res.json({ friends, requests })
  }
  catch (error) {
    console.error('Error fetching friends:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

router.post('/request', jwtMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req)

    if (!userId) {
      console.log("ОШИБКА POST: В токене нет ID. Вот что там есть:", req.user)
      return res.status(401).json({ message: 'Invalid token payload' })
    }

    const { targetUsername } = req.body

    if (!targetUsername) {
      return res.status(400).json({ message: 'Username is required' })
    }

    const targetUser = await User.findOne({
      where: db.sequelize.where(
        db.sequelize.fn('lower', db.sequelize.col('nickname')),
        db.sequelize.fn('lower', targetUsername)
      )
    })

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (targetUser.id === userId) {
      return res.status(400).json({ message: 'Cannot add yourself' })
    }

    const existing = await Friend.findOne({
      where: {
        [Op.or]: [
          { userId, friendId: targetUser.id },
          { userId: targetUser.id, friendId: userId }
        ]
      }
    })

    if (existing) {
      return res.status(400).json({ message: 'Friendship or request already exists' })
    }

    await Friend.create({
      userId,
      friendId: targetUser.id,
      status: 'pending'
    })

    const io = req.app.get('io')
    if (io) {
      const sender = await User.findByPk(userId)
      io.to(targetUser.id).emit('friend_request_received', {
        senderUsername: sender ? sender.nickname : 'Неизвестный игрок'
      })
    }

    res.status(201).json({ message: 'Friend request sent successfully' })
  }
  catch (error) {
    console.error('Error sending friend request:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

router.put('/respond', jwtMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({ message: 'Invalid token payload' })
    }

    const { requestId, action } = req.body

    const request = await Friend.findByPk(requestId)

    if (!request || request.friendId !== userId || request.status !== 'pending') {
      return res.status(404).json({ message: 'Friend request not found' })
    }

    if (action === 'accept') {
      await request.update({ status: 'accepted' })

      const io = req.app.get('io')
      if (io) {
        const acceptor = await User.findByPk(userId)
        io.to(request.userId).emit('friend_request_accepted', {
          receiverUsername: acceptor ? acceptor.nickname : 'Неизвестный игрок'
        })
      }

      res.json({ message: 'Friend request accepted' })
    }
    else if (action === 'decline') {
      await request.destroy()
      res.json({ message: 'Friend request declined' })
    }
    else {
      res.status(400).json({ message: 'Invalid action' })
    }
  }
  catch (error) {
    console.error('Error responding to request:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

router.get('/:friendId/messages', jwtMiddleware, async (req, res) => {
  try {
    const myId = getUserId(req);
    const friendId = req.params.friendId;

    if (!myId) {
      return res.status(401).json({ message: 'Не авторизован' })
    }

    const messages = await ChatMessage.findAll({
      where: {
        [Op.or]: [
          { senderId: myId, receiverId: friendId },
          { senderId: friendId, receiverId: myId }
        ]
      },
      order: [['createdAt', 'ASC']]
    })

    return res.status(200).json(messages)
  }
  catch (error) {
    console.error('[Friends API] Ошибка загрузки истории чата:', error)
    return res.status(500).json({ message: 'Внутренняя ошибка сервера' })
  }
})

router.get('/messages/unread', jwtMiddleware, async (req, res) => {
  try {
    const myId = getUserId(req)
    if (!myId) return res.status(401).json({ message: 'Не авторизован' })

    const unreadCounts = await ChatMessage.findAll({
      where: { receiverId: myId, isRead: false },
      attributes: ['senderId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['senderId']
    })

    const countsMap = {}
    unreadCounts.forEach(item => {
      countsMap[item.senderId] = parseInt(item.get('count'), 10)
    })

    return res.status(200).json(countsMap)
  }
  catch (error) {
    console.error('[Friends API] Ошибка получения счетчиков:', error)
    return res.status(500).json({ message: 'Внутренняя ошибка сервера' })
  }
})

router.put('/:friendId/messages/read', jwtMiddleware, async (req, res) => {
  try {
    const myId = getUserId(req)
    const friendId = req.params.friendId

    await ChatMessage.update(
      { isRead: true },
      { where: { receiverId: myId, senderId: friendId, isRead: false } }
    )

    return res.status(200).json({ message: 'Сообщения прочитаны' })
  }
  catch (error) {
    console.error('[Friends API] Ошибка обновления статуса:', error)
    return res.status(500).json({ message: 'Внутренняя ошибка сервера' })
  }
})

module.exports = router