const { Op } = require('sequelize')
const { ChatMessage } = require('../models')

router.get('/:friendId/messages', async (req, res) => {
  try {
    const myId = getUserId(req)
    const friendId = req.params.friendId

    const messages = await ChatMessage.findAll({
      where: {
        [Op.or]: [
          { senderId: myId, receiverId: friendId },
          { senderId: friendId, receiverId: myId }
        ]
      },
      order: [['createdAt', 'ASC']]
    })

    res.json(messages)
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки истории чата' })
  }
})