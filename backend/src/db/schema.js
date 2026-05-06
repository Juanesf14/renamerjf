const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, '../../renamerjf.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    specialty TEXT,
    phone TEXT,
    fax TEXT,
    email TEXT,
    address TEXT,
    hours TEXT,
    portal_url TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS document_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rename_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider_id TEXT,
    doc_type_id INTEGER,
    original_name TEXT NOT NULL,
    new_name TEXT NOT NULL,
    dos_start TEXT,
    dos_end TEXT,
    update_date TEXT,
    pip_exhausted INTEGER DEFAULT 0,
    renamed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (provider_id) REFERENCES providers(id),
    FOREIGN KEY (doc_type_id) REFERENCES document_types(id)
  );
`)

// Seed de document_types si la tabla está vacía
const count = db.prepare('SELECT COUNT(*) as count FROM document_types').get()
if (count.count === 0) {
  const insert = db.prepare('INSERT INTO document_types (code, label) VALUES (?, ?)')
  const types = [
    ['B',  'Medical Bills'],
    ['MR', 'Medical Records'],
    ['PD', 'Police Report'],
    ['LT', 'Letter'],
    ['RX', 'Prescription'],
    ['IN', 'Insurance'],
    ['OT', 'Other']
  ]
  types.forEach(([code, label]) => insert.run(code, label))
  console.log('Document types seeded.')
}

module.exports = db