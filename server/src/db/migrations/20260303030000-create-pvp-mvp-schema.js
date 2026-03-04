"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await queryInterface.createTable("users", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password_hash: {
        type: Sequelize.STRING,
        allowNull: false
      },
      nickname: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW")
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW")
      }
    });

    await queryInterface.createTable("player_stats", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      rating: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1000
      },
      wins: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      losses: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      games_played: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW")
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW")
      }
    });

    await queryInterface.createTable("cards", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM("unit", "spell"),
        allowNull: false
      },
      triad_type: {
        type: Sequelize.ENUM("assault", "precision", "arcane"),
        allowNull: false
      },
      mana_cost: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      attack: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      hp: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW")
      }
    });

    await queryInterface.createTable("decks", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW")
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW")
      }
    });

    await queryInterface.createTable("deck_cards", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      deck_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "decks",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      card_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "cards",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false
      }
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE deck_cards ADD CONSTRAINT deck_cards_quantity_lte_2 CHECK (quantity <= 2);"
    );

    await queryInterface.addConstraint("deck_cards", {
      fields: ["deck_id", "card_id"],
      type: "unique",
      name: "deck_cards_deck_id_card_id_unique"
    });

    await queryInterface.createTable("matches", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      player_one_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id"
        },
        onUpdate: "CASCADE"
      },
      player_two_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id"
        },
        onUpdate: "CASCADE"
      },
      player_one_deck_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "decks",
          key: "id"
        },
        onUpdate: "CASCADE"
      },
      player_two_deck_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "decks",
          key: "id"
        },
        onUpdate: "CASCADE"
      },
      status: {
        type: Sequelize.ENUM("searching", "active", "finished"),
        allowNull: false
      },
      winner_id: {
        type: Sequelize.UUID,
        allowNull: true
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      finished_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW")
      }
    });

    await queryInterface.createTable("match_states", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      match_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "matches",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      game_state: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW")
      }
    });

    await queryInterface.createTable("match_history", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      match_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      player_one_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      player_two_id: {
        type: Sequelize.UUID,
        allowNull: true
      },
      winner_id: {
        type: Sequelize.UUID,
        allowNull: true
      },
      total_turns: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      player_one_final_hp: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      player_two_final_hp: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      finished_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("match_history");
    await queryInterface.dropTable("match_states");
    await queryInterface.dropTable("matches");
    await queryInterface.dropTable("deck_cards");
    await queryInterface.dropTable("decks");
    await queryInterface.dropTable("cards");
    await queryInterface.dropTable("player_stats");
    await queryInterface.dropTable("users");

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_matches_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_cards_triad_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_cards_type";');
  }
};
