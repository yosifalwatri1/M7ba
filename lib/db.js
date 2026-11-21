'use strict';
/**
 * اتصال قاعدة البيانات.
 * - على Vercel (أو أي استضافة): Postgres عبر DATABASE_URL (مثل Neon).
 * - محلياً بدون DATABASE_URL: Postgres مدمج (PGlite) يحفظ في مجلد data/.
 * الواجهة واحدة: query(sql, params) → { rows, count }، و exec(sql) لعدة أوامر.
 * علامات ? في الاستعلامات تتحوّل تلقائياً إلى $1, $2 …
 */
const path = require('node:path');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    norm TEXT NOT NULL UNIQUE,
    created BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS aliases (
    norm TEXT PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    raw TEXT NOT NULL,
    norm TEXT NOT NULL,
    teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
    status TEXT NOT NULL,          -- matched | pending | discarded
    method TEXT NOT NULL,          -- picked | auto | alias | admin | none
    device TEXT NOT NULL UNIQUE,
    created BIGINT NOT NULL,
    reason TEXT NOT NULL DEFAULT ''
  );
  ALTER TABLE votes ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
  CREATE INDEX IF NOT EXISTS votes_status ON votes(status);
  CREATE INDEX IF NOT EXISTS votes_teacher ON votes(teacher_id);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires BIGINT NOT NULL);
  CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT NOT NULL, at BIGINT NOT NULL);
  CREATE INDEX IF NOT EXISTS login_attempts_ip ON login_attempts(ip, at);
`;

const numbered = (sql) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

async function connect({ dataDir } = {}) {
  const url = connectionString();
  let db;
  if (url) {
    const { Pool } = require('pg');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    const pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 10_000,
      ssl: local || /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false },
    });
    db = {
      kind: 'postgres',
      async query(sql, params = []) {
        const r = await pool.query(numbered(sql), params);
        return { rows: r.rows, count: r.rowCount || 0 };
      },
      async exec(sql) { await pool.query(sql); },
      close: () => pool.end(),
    };
  } else if (process.env.VERCEL) {
    throw Object.assign(new Error('لم تُربط قاعدة بيانات بالموقع بعد. أضف قاعدة Neon من تبويب Storage في Vercel ثم أعد النشر.'),
      { code: 'NO_DATABASE' });
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = path.join(dataDir || path.join(__dirname, '..', 'data'), 'pglite');
    require('node:fs').mkdirSync(dir, { recursive: true });
    const pg = new PGlite(dir);
    await pg.waitReady;
    db = {
      kind: 'pglite',
      async query(sql, params = []) {
        const r = await pg.query(numbered(sql), params);
        return { rows: r.rows, count: r.affectedRows || 0 };
      },
      async exec(sql) { await pg.exec(sql); },
      close: () => pg.close(),
    };
  }
  await db.exec(SCHEMA);
  return db;
}

module.exports = { connect };
