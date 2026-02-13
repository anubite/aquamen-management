const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.SQLITE_DB_PATH || path.resolve(__dirname, 'aquamen.sqlite');
const db = new sqlite3.Database(dbPath);

const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Check for old schema
      db.all("PRAGMA table_info(groups)", (err, columns) => {
        if (err) return;
        const hasIdentifier = columns && columns.some(col => col.name === 'identifier');

        db.serialize(() => {
          if (hasIdentifier) {
            console.log("Renaming old groups table to migrate...");
            db.run("DROP TABLE IF EXISTS groups_old");
            db.run("ALTER TABLE groups RENAME TO groups_old");
          }

          // 2. Create groups table with correct schema
          db.run(`
            CREATE TABLE IF NOT EXISTS groups (
              id TEXT PRIMARY KEY,
              trainer TEXT
            )
          `, () => {
            // 3. Migrate data from groups_old if it exists
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='groups_old'", (err, row) => {
              if (row) {
                db.run("INSERT OR IGNORE INTO groups (id, trainer) SELECT identifier, trainer_name FROM groups_old", () => {
                  db.run("DROP TABLE groups_old");
                });
              }

              // 4. Initialize default groups
              const defaultGroups = [['A', 'Trainer A'], ['B', 'Trainer B'], ['C', 'Trainer C']];
              const stmt = db.prepare("INSERT OR IGNORE INTO groups (id, trainer) VALUES (?, ?)");
              defaultGroups.forEach(g => stmt.run(g));
              stmt.finalize();

              // 5. Migrate members
              db.all("PRAGMA table_info(members)", (err, columns) => {
                const hasGroupId = columns && columns.some(col => col.name === 'group_id');
                if (!hasGroupId) {
                  console.log("Migrating members table...");
                  db.serialize(() => {
                    db.run(`
                      CREATE TABLE IF NOT EXISTS members_new (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        surname TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE,
                        group_id TEXT,
                        status TEXT CHECK(status IN ('Active', 'Canceled')) DEFAULT 'Active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (group_id) REFERENCES groups(id)
                      )
                    `);
                    const hasGroupName = columns && columns.some(col => col.name === 'group_name');
                    const groupCol = hasGroupName ? 'group_name' : 'NULL';
                    db.run(`
                      INSERT INTO members_new (id, name, surname, email, group_id, status, created_at)
                      SELECT id, name, surname, email, ${groupCol}, status, created_at FROM members
                    `);
                    db.run("DROP TABLE members");
                    db.run("ALTER TABLE members_new RENAME TO members", () => {
                      console.log("Migration complete.");
                      resolve();
                    });
                  });
                } else {
                  resolve();
                }
              });
            });
          });
        });
      });

      // 6. simple users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL
        )
      `);
    });
  });
};

module.exports = { db, initDb };
