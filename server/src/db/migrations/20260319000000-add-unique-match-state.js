"use strict";

// Adds a UNIQUE constraint on match_states.match_id.
//
// The Sequelize model already declares unique: true on this field, but the
// original table-creation migration did not include the constraint at the DB
// level. Without it, two concurrent socket events (match:sync + match:join)
// from the same player entering a fresh match could both succeed in
// inserting a duplicate row, causing a "Validation error" to be emitted to
// the client.  With the constraint in place, findOrCreate in ensureMatchState
// handles the race condition correctly.
//
// Using CREATE UNIQUE INDEX IF NOT EXISTS so the migration is idempotent:
// environments where sequelize.sync() already added the index won't fail.

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "match_states_match_id_unique" ON "match_states" ("match_id")'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS "match_states_match_id_unique"'
    );
  }
};
