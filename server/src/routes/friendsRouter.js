const express = require('express')
const { Op } = require('sequelize')
const { User, Friend } = require('../db/models');
const { jwtMiddleware } = require('../middlewares/jwt')

const router = express.Router()

const getUserId = (req) => req.user.id || req.user.userId || req.user.user_id;

router.get('/', jwtMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      console.log("ОШИБКА GET: В токене нет ID. Вот что там есть:", req.user);
      return res.status(401).json({ message: 'Invalid token payload' });
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
          status: 'offline'
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
  } catch (error) {
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

    const targetUser = await User.findOne({ where: { nickname: targetUsername } })

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

    res.status(201).json({ message: 'Friend request sent successfully' })
  } catch (error) {
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
      res.json({ message: 'Friend request accepted' })
    } else if (action === 'decline') {
      await request.destroy()
      res.json({ message: 'Friend request declined' })
    } else {
      res.status(400).json({ message: 'Invalid action' })
    }
  } catch (error) {
    console.error('Error responding to request:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

module.exports = router