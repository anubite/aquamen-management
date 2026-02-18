const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('members').del();
  await knex('groups').del();
  await knex('users').del();

  // Inserts groups
  await knex('groups').insert([
    { id: 'A', trainer: 'Trainer A' },
    { id: 'B', trainer: 'Trainer B' },
    { id: 'C', trainer: 'Trainer C' }
  ]);

  // Insert default admin user
  const passwordHash = await bcrypt.hash('milujemeAI', 10);
  await knex('users').insert({
    username: 'aquamen',
    password: passwordHash
  });
};
