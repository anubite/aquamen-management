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
                    // We can't use AUTOINCREMENT with a specific start value easily in SQLite without inserting a dummy
                    // or using a trigger/manual id. 
                    // An easy way is to insert a dummy and delete, but SQLite ID starts at 1.
                    // Better: use a trigger or manual ID calculation as requested: last ID + 1, starting at 1000.
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
