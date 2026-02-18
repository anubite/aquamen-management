const knex = require('knex');
const knexConfig = require('./knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

const db = knex(config);

const initDb = async () => {
  try {
    console.log('Running migrations...');
    await db.migrate.latest();

    // Check if database is empty to run seeds
    const groupsCount = await db('groups').count('id as count').first();
    if (groupsCount.count === 0) {
      console.log('Seeding initial data...');
      await db.seed.run();
    }
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

module.exports = { db, initDb };
