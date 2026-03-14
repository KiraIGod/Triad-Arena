const { Sequelize } = require("sequelize")
const { sequelize } = require("../index")
const initUserModel = require("./User")
const initPlayerStatsModel = require("./PlayerStats")
const initCardModel = require("./Card")
const initUserCardModel = require("./UserCard")
const initDeckModel = require("./Deck")
const initDeckCardModel = require("./DeckCard")
const initMatchModel = require("./Match")
const initMatchStateModel = require("./MatchState")
const initMatchHistoryModel = require("./MatchHistory")
const initFriendModel = require('./Friend')
const initChatMessageModel = require('./ChatMessage')

const db = {}

db.User = initUserModel(sequelize)
db.PlayerStats = initPlayerStatsModel(sequelize)
db.Card = initCardModel(sequelize)
db.UserCard = initUserCardModel(sequelize)
db.Deck = initDeckModel(sequelize)
db.DeckCard = initDeckCardModel(sequelize)
db.Match = initMatchModel(sequelize)
db.MatchState = initMatchStateModel(sequelize)
db.MatchHistory = initMatchHistoryModel(sequelize)
db.Friend = initFriendModel(sequelize)
db.ChatMessage = initChatMessageModel(sequelize, Sequelize.DataTypes)
db.Game = db.Match

db.User.hasOne(db.PlayerStats, { foreignKey: "user_id", onDelete: "CASCADE" })
db.PlayerStats.belongsTo(db.User, { foreignKey: "user_id" })

db.User.hasMany(db.Deck, { foreignKey: "user_id", onDelete: "CASCADE" })
db.Deck.belongsTo(db.User, { foreignKey: "user_id" })

db.User.hasMany(db.UserCard, { foreignKey: "user_id", onDelete: "CASCADE" })
db.UserCard.belongsTo(db.User, { foreignKey: "user_id" })
db.Card.hasMany(db.UserCard, { foreignKey: "card_id", onDelete: "CASCADE" })
db.UserCard.belongsTo(db.Card, { foreignKey: "card_id" })

db.Deck.hasMany(db.DeckCard, { foreignKey: "deck_id", onDelete: "CASCADE" })
db.DeckCard.belongsTo(db.Deck, { foreignKey: "deck_id" })
db.DeckCard.belongsTo(db.Card, { foreignKey: "card_id" })

db.Match.belongsTo(db.User, { as: "player_one", foreignKey: "player_one_id" })
db.Match.belongsTo(db.User, { as: "player_two", foreignKey: "player_two_id" })
db.Match.belongsTo(db.User, { as: "winner", foreignKey: "winner_id" })
db.Match.belongsTo(db.Deck, { as: "player_one_deck", foreignKey: "player_one_deck_id" })
db.Match.belongsTo(db.Deck, { as: "player_two_deck", foreignKey: "player_two_deck_id" })

db.Match.hasOne(db.MatchState, { foreignKey: "match_id", onDelete: "CASCADE" })
db.MatchState.belongsTo(db.Match, { foreignKey: "match_id" })

db.Match.hasOne(db.MatchHistory, { foreignKey: "match_id" })
db.MatchHistory.belongsTo(db.Match, { foreignKey: "match_id" })
db.MatchHistory.belongsTo(db.User, { as: "history_player_one", foreignKey: "player_one_id" })
db.MatchHistory.belongsTo(db.User, { as: "history_player_two", foreignKey: "player_two_id" })
db.MatchHistory.belongsTo(db.User, { as: "history_winner", foreignKey: "winner_id" })

db.Friend.belongsTo(db.User, { foreignKey: 'userId', as: 'sender' })
db.Friend.belongsTo(db.User, { foreignKey: 'friendId', as: 'receiver' })

db.User.belongsToMany(db.User, {
  through: db.Friend,
  as: 'Friends',
  foreignKey: 'userId',
  otherKey: 'friendId'
})

db.User.belongsToMany(db.User, {
  through: db.Friend,
  as: 'FriendRequests',
  foreignKey: 'friendId',
  otherKey: 'userId'
})

db.ChatMessage.belongsTo(db.User, { foreignKey: 'senderId', as: 'sender' })
db.ChatMessage.belongsTo(db.User, { foreignKey: 'receiverId', as: 'receiver' })

db.User.hasMany(db.ChatMessage, { foreignKey: 'senderId', as: 'sentMessages' })
db.User.hasMany(db.ChatMessage, { foreignKey: 'receiverId', as: 'receivedMessages' })

db.sequelize = sequelize
db.Sequelize = Sequelize

module.exports = db