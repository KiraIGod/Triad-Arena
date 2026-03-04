const { Sequelize } = require("sequelize");
const { sequelize } = require("../index");
const initUserModel = require("./User");
const initPlayerStatsModel = require("./PlayerStats");
const initCardModel = require("./Card");
const initDeckModel = require("./Deck");
const initDeckCardModel = require("./DeckCard");
const initMatchModel = require("./Match");
const initMatchStateModel = require("./MatchState");
const initMatchHistoryModel = require("./MatchHistory");

const db = {};

db.User = initUserModel(sequelize);
db.PlayerStats = initPlayerStatsModel(sequelize);
db.Card = initCardModel(sequelize);
db.Deck = initDeckModel(sequelize);
db.DeckCard = initDeckCardModel(sequelize);
db.Match = initMatchModel(sequelize);
db.MatchState = initMatchStateModel(sequelize);
db.MatchHistory = initMatchHistoryModel(sequelize);

db.User.hasOne(db.PlayerStats, { foreignKey: "user_id", onDelete: "CASCADE" });
db.PlayerStats.belongsTo(db.User, { foreignKey: "user_id" });

db.User.hasMany(db.Deck, { foreignKey: "user_id", onDelete: "CASCADE" });
db.Deck.belongsTo(db.User, { foreignKey: "user_id" });

db.Deck.hasMany(db.DeckCard, { foreignKey: "deck_id", onDelete: "CASCADE" });
db.DeckCard.belongsTo(db.Deck, { foreignKey: "deck_id" });
db.DeckCard.belongsTo(db.Card, { foreignKey: "card_id" });

db.Match.belongsTo(db.User, { as: "player_one", foreignKey: "player_one_id" });
db.Match.belongsTo(db.User, { as: "player_two", foreignKey: "player_two_id" });
db.Match.belongsTo(db.User, { as: "winner", foreignKey: "winner_id" });
db.Match.belongsTo(db.Deck, { as: "player_one_deck", foreignKey: "player_one_deck_id" });
db.Match.belongsTo(db.Deck, { as: "player_two_deck", foreignKey: "player_two_deck_id" });

db.Match.hasOne(db.MatchState, { foreignKey: "match_id", onDelete: "CASCADE" });
db.MatchState.belongsTo(db.Match, { foreignKey: "match_id" });

db.Match.hasOne(db.MatchHistory, { foreignKey: "match_id" });
db.MatchHistory.belongsTo(db.Match, { foreignKey: "match_id" });
db.MatchHistory.belongsTo(db.User, { as: "history_player_one", foreignKey: "player_one_id" });
db.MatchHistory.belongsTo(db.User, { as: "history_player_two", foreignKey: "player_two_id" });
db.MatchHistory.belongsTo(db.User, { as: "history_winner", foreignKey: "winner_id" });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
