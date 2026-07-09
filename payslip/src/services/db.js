const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './payroll.db');

let db = null;

async function getDB() {
  if (db) return db;

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Initialize tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payee_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      token TEXT NOT NULL,
      chain TEXT NOT NULL,
      frequency TEXT NOT NULL,
      last_paid_at INTEGER,
      next_payment_at INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER,
      payee_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      token TEXT NOT NULL,
      tx_hash TEXT,
      paid_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      FOREIGN KEY(schedule_id) REFERENCES schedules(id)
    );

    CREATE TABLE IF NOT EXISTS processed_messages (
      message_id TEXT PRIMARY KEY,
      processed_at INTEGER NOT NULL
    );
  `);

  return db;
}

module.exports = {
  getDB
};
