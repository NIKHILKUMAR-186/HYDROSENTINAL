const Database = require('better-sqlite3');
require("dotenv").config();

const dbPath = process.env.DATABASE_PATH || './hydrosentinal.db';

let db = null;

function getDb() {
  if (!db) {
    db = new Database(dbPath);
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
  }
  return db;
}

async function initializeDatabase() {
  const database = getDb();

  // Create the readings table if it does not already exist.
  database.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      ph REAL,
      tds REAL,
      turbidity REAL,
      temperature REAL,
      status TEXT,
      timestamp TEXT NOT NULL,
      UNIQUE(user_id, device_id, timestamp)
    );
  `);
}

module.exports = {
  getDb,
  initializeDatabase,
};
