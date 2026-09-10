import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'messages.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Error opening database', err);
});

export const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

export const getQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const getOne = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

async function tableExists(name) {
  const row = await getOne(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [name]
  );
  return Boolean(row);
}

async function tableHasColumn(table, column) {
  const rows = await getQuery(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

async function addColumnIfMissing(table, column, ddl) {
  if (!(await tableHasColumn(table, column))) {
    await runQuery(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

async function migrate() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient TEXT NOT NULL,
      content TEXT NOT NULL,
      scheduled_for DATETIME NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      image_url TEXT,
      whatsapp_phone TEXT,
      whatsapp_name TEXT
    )
  `);
  await addColumnIfMissing('scheduled_messages', 'image_url', 'image_url TEXT');
  await addColumnIfMissing('scheduled_messages', 'whatsapp_phone', 'whatsapp_phone TEXT');
  await addColumnIfMissing('scheduled_messages', 'whatsapp_name', 'whatsapp_name TEXT');
  await addColumnIfMissing('scheduled_messages', 'user_id', 'user_id INTEGER');

  await runQuery(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      identifier TEXT NOT NULL,
      search_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await addColumnIfMissing('contacts', 'user_id', 'user_id INTEGER');

  await runQuery(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await addColumnIfMissing('templates', 'user_id', 'user_id INTEGER');

  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      theme TEXT NOT NULL DEFAULT 'lima',
      agenda_view TEXT NOT NULL DEFAULT 'month',
      week_starts_on TEXT NOT NULL DEFAULT 'monday',
      timezone TEXT NOT NULL DEFAULT '',
      hour_clock TEXT NOT NULL DEFAULT '24h',
      language TEXT NOT NULL DEFAULT 'es',
      logo_data_url TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await addColumnIfMissing('users', 'email_verified_at', 'email_verified_at TEXT');
  await addColumnIfMissing('users', 'email_verify_hash', 'email_verify_hash TEXT');
  await addColumnIfMissing('users', 'email_verify_expires', 'email_verify_expires TEXT');
  await addColumnIfMissing('users', 'email_verify_sent_at', 'email_verify_sent_at TEXT');
  await addColumnIfMissing('users', 'email_verify_day', 'email_verify_day TEXT');
  await addColumnIfMissing('users', 'email_verify_day_count', 'email_verify_day_count INTEGER DEFAULT 0');
  await addColumnIfMissing('users', 'email_verify_fails', 'email_verify_fails INTEGER DEFAULT 0');
  await addColumnIfMissing('users', 'session_version', 'session_version INTEGER DEFAULT 0');
  await addColumnIfMissing('users', 'welcome_seen_at', 'welcome_seen_at TEXT');
  await addColumnIfMissing('users', 'setup_seen_at', 'setup_seen_at TEXT');
  await addColumnIfMissing('users', 'terms_accepted_at', 'terms_accepted_at TEXT');

  await runQuery(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  const version = await getOne(`SELECT value FROM app_meta WHERE key = 'schema_version'`);
  if (version?.value !== '2' && (await tableExists('contacts'))) {
    await runQuery(`DROP TABLE IF EXISTS contacts_new`);
    await runQuery(`
      CREATE TABLE contacts_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        identifier TEXT NOT NULL,
        search_key TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, identifier),
        UNIQUE(user_id, search_key)
      )
    `);
    await runQuery(`
      INSERT INTO contacts_new (id, user_id, name, identifier, search_key, created_at)
      SELECT id, user_id, name, identifier, search_key, created_at FROM contacts
    `);
    await runQuery(`DROP TABLE contacts`);
    await runQuery(`ALTER TABLE contacts_new RENAME TO contacts`);
  }

  await runQuery(
    `CREATE INDEX IF NOT EXISTS idx_messages_user_scheduled ON scheduled_messages (user_id, scheduled_for)`
  );
  await runQuery(
    `CREATE INDEX IF NOT EXISTS idx_messages_user_status ON scheduled_messages (user_id, status)`
  );
  await runQuery(
    `CREATE INDEX IF NOT EXISTS idx_templates_user_updated ON templates (user_id, updated_at)`
  );

  await runQuery(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', '2')`);

  const verifiedBackfill = await getOne(`SELECT value FROM app_meta WHERE key = 'email_verified_backfill'`);
  if (!verifiedBackfill?.value) {
    await runQuery(`UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL`);
    await runQuery(
      `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('email_verified_backfill', '1')`
    );
  }

  const welcomeBackfill = await getOne(`SELECT value FROM app_meta WHERE key = 'welcome_seen_backfill'`);
  if (!welcomeBackfill?.value) {
    await runQuery(`UPDATE users SET welcome_seen_at = created_at WHERE welcome_seen_at IS NULL`);
    await runQuery(
      `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('welcome_seen_backfill', '1')`
    );
  }

  const setupBackfill = await getOne(`SELECT value FROM app_meta WHERE key = 'setup_seen_backfill'`);
  if (!setupBackfill?.value) {
    await runQuery(
      `UPDATE users SET setup_seen_at = COALESCE(welcome_seen_at, created_at) WHERE setup_seen_at IS NULL AND welcome_seen_at IS NOT NULL`
    );
    await runQuery(
      `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('setup_seen_backfill', '1')`
    );
  }
}

export const dbReady = migrate().catch((err) => {
  console.error('Database migration failed', err);
  throw err;
});
