const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'aquamen.sqlite');
const db = new sqlite3.Database(dbPath);

const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Members table
      db.run(`
        CREATE TABLE IF NOT EXISTS members (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          surname TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          group_name TEXT CHECK(group_name IN ('A', 'B', 'C')),
          status TEXT CHECK(status IN ('Active', 'Canceled')) DEFAULT 'Active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Ensure first member starts at 1000
      db.get("SELECT COUNT(*) as count FROM members", (err, row) => {
        if (err) return reject(err);
        if (row.count === 0) {
          console.log("Database initialized: no members found.");
        }
      });

      // Simple users table for login
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL
        )
      `);

      resolve();
    });
  });
};

module.exports = { db, initDb };
