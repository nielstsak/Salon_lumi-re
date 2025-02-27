const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.db');

db.serialize(()=>{
  // appointments table => phone TEXT
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      start TEXT,
      end TEXT,
      phone TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      reason TEXT,
      type TEXT CHECK(type IN ('BLOCK','VACATION')) NOT NULL DEFAULT 'BLOCK'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS working_hours (
      day_of_week INTEGER CHECK(day_of_week BETWEEN 1 AND 7),
      start TEXT,
      end TEXT,
      PRIMARY KEY(day_of_week)
    )
  `);
});

db.close();
