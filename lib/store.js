'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const N = require('./names');

function open(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'votes.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      norm TEXT NOT NULL UNIQUE,
      created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS aliases (
      norm TEXT PRIMARY KEY,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw TEXT NOT NULL,
      norm TEXT NOT NULL,
      teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      status TEXT NOT NULL,          -- matched | pending | discarded
      method TEXT NOT NULL,          -- picked | auto | alias | admin | none
      device TEXT NOT NULL UNIQUE,
      created INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS votes_status ON votes(status);
    CREATE INDEX IF NOT EXISTS votes_teacher ON votes(teacher_id);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
  `);
  // ترقية قواعد البيانات القديمة: خانة «لماذا اخترته؟»
  if (!db.prepare('PRAGMA table_info(votes)').all().some((c) => c.name === 'reason')) {
    db.exec("ALTER TABLE votes ADD COLUMN reason TEXT NOT NULL DEFAULT ''");
  }
  return new Store(db);
}

class Store {
  constructor(db) {
    this.db = db;
    this._teachers = null;
  }

  // ---------- الإعدادات ----------
  getSetting(key, fallback = null) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : fallback;
  }
  setSetting(key, value) {
    this.db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, String(value));
  }
  publicSettings() {
    return {
      school: this.getSetting('school', ''),
      title: this.getSetting('title', 'من هو معلّمك المفضّل؟'),
      open: this.getSetting('open', '1') === '1',
    };
  }

  // ---------- المعلّمون ----------
  teachers() {
    if (!this._teachers) {
      this._teachers = this.db.prepare('SELECT id, name, norm FROM teachers ORDER BY name').all()
        .map((t) => ({ ...t, tokens: N.tokenize(t.name) }));
    }
    return this._teachers;
  }
  _dirty() { this._teachers = null; }

  addTeachers(names) {
    const added = [], skipped = [];
    const ins = this.db.prepare('INSERT INTO teachers(name, norm, created) VALUES(?, ?, ?)');
    for (const rawName of names) {
      const name = String(rawName).replace(/\s+/g, ' ').trim().slice(0, 80);
      const norm = N.normKey(name);
      if (!norm) continue;
      if (this.db.prepare('SELECT 1 FROM teachers WHERE norm = ?').get(norm)) { skipped.push(name); continue; }
      const r = ins.run(name, norm, Date.now());
      added.push({ id: Number(r.lastInsertRowid), name });
    }
    this._dirty();
    if (added.length) this.rematchPending();
    return { added, skipped };
  }

  renameTeacher(id, newName) {
    const name = String(newName).replace(/\s+/g, ' ').trim().slice(0, 80);
    const norm = N.normKey(name);
    if (!norm) throw new Error('الاسم فارغ');
    const clash = this.db.prepare('SELECT id FROM teachers WHERE norm = ? AND id != ?').get(norm, id);
    if (clash) throw new Error('يوجد معلّم آخر بهذا الاسم');
    this.db.prepare('UPDATE teachers SET name = ?, norm = ? WHERE id = ?').run(name, norm, id);
    this._dirty();
    this.rematchPending();
  }

  deleteTeacher(id) {
    // أصواته ترجع إلى قائمة المراجعة ولا تُحذف
    this.db.prepare("UPDATE votes SET teacher_id = NULL, status = 'pending', method = 'none' WHERE teacher_id = ?").run(id);
    this.db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
    this._dirty();
    this.rematchPending();
  }

  mergeTeachers(fromId, intoId) {
    if (fromId === intoId) return;
    const from = this.db.prepare('SELECT * FROM teachers WHERE id = ?').get(fromId);
    const into = this.db.prepare('SELECT * FROM teachers WHERE id = ?').get(intoId);
    if (!from || !into) throw new Error('المعلّم غير موجود');
    this.db.prepare('UPDATE votes SET teacher_id = ? WHERE teacher_id = ?').run(intoId, fromId);
    this.db.prepare('UPDATE aliases SET teacher_id = ? WHERE teacher_id = ?').run(intoId, fromId);
    this.db.prepare('DELETE FROM teachers WHERE id = ?').run(fromId);
    this.db.prepare('INSERT OR REPLACE INTO aliases(norm, teacher_id) VALUES(?, ?)').run(from.norm, intoId);
    this._dirty();
  }

  // ---------- المطابقة ----------
  /** يحاول ربط اسم مكتوب بمعلّم. */
  resolve(raw) {
    const tokens = N.tokenize(raw);
    const norm = tokens.map(N.core).join(' ');
    const alias = this.db.prepare('SELECT teacher_id FROM aliases WHERE norm = ?').get(norm);
    if (alias) {
      const t = this.teachers().find((x) => x.id === alias.teacher_id);
      if (t) return { norm, teacher: t, method: 'alias', candidates: [], ambiguous: false };
    }
    const d = N.decide(tokens, this.teachers());
    return { norm, teacher: d.teacher, method: 'auto', candidates: d.candidates, ambiguous: d.ambiguous };
  }

  suggest(q) {
    const tokens = N.tokenize(q);
    if (!tokens.length || tokens.join('').length < 2) return [];
    return N.rank(tokens, this.teachers(), { prefix: true, min: 0.45 }).slice(0, 6)
      .map(({ id, name }) => ({ id, name }));
  }

  /** يعيد فحص الأسماء المعلّقة بعد أي تغيير في قائمة المعلّمين */
  rematchPending() {
    const rows = this.db.prepare("SELECT DISTINCT norm, raw FROM votes WHERE status = 'pending' GROUP BY norm").all();
    const upd = this.db.prepare("UPDATE votes SET teacher_id = ?, status = 'matched', method = ? WHERE status = 'pending' AND norm = ?");
    let moved = 0;
    for (const row of rows) {
      const r = this.resolve(row.raw);
      if (r.teacher) moved += Number(upd.run(r.teacher.id, r.method, row.norm).changes);
    }
    return moved;
  }

  // ---------- التصويت ----------
  hasVoted(device) {
    return !!this.db.prepare('SELECT 1 FROM votes WHERE device = ?').get(device);
  }

  castVote({ raw, teacherId, device, force, reason }) {
    raw = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    reason = String(reason || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    const ins = this.db.prepare('INSERT INTO votes(raw, norm, teacher_id, status, method, device, created, reason) VALUES(?, ?, ?, ?, ?, ?, ?, ?)');

    if (teacherId) {
      const t = this.teachers().find((x) => x.id === teacherId);
      if (!t) throw new Error('المعلّم غير موجود');
      ins.run(raw || t.name, N.normKey(raw || t.name), t.id, 'matched', 'picked', device, Date.now(), reason);
      return { status: 'counted', teacher: t.name };
    }

    const r = this.resolve(raw);
    if (!r.norm) throw new Error('اكتب اسم المعلّم');
    if (r.teacher) {
      ins.run(raw, r.norm, r.teacher.id, 'matched', r.method, device, Date.now(), reason);
      return { status: 'counted', teacher: r.teacher.name };
    }
    // غير واضح: اطلب من الطالب أن يختار قبل تسجيل الصوت
    if (!force && r.candidates.length) {
      return { status: 'choose', candidates: r.candidates.slice(0, 5).map(({ id, name }) => ({ id, name })) };
    }
    ins.run(raw, r.norm, null, 'pending', 'none', device, Date.now(), reason);
    return { status: 'pending' };
  }

  // ---------- لوحة التحكم ----------
  dashboard() {
    const teachers = this.teachers();
    const counts = new Map(this.db.prepare(
      "SELECT teacher_id AS id, COUNT(*) AS c FROM votes WHERE status = 'matched' GROUP BY teacher_id").all().map((r) => [r.id, r.c]));
    // لكل صيغة موحّدة نعرض أكثر كتابة تكرّرت بين الطلاب
    const variantRows = this.db.prepare(
      "SELECT teacher_id AS id, norm, raw, COUNT(*) AS c FROM votes WHERE status = 'matched' GROUP BY teacher_id, norm, raw ORDER BY c DESC").all();
    const variants = new Map();
    for (const v of variantRows) {
      if (!variants.has(v.id)) variants.set(v.id, new Map());
      const m = variants.get(v.id);
      if (m.has(v.norm)) m.get(v.norm).count += v.c;
      else m.set(v.norm, { norm: v.norm, raw: v.raw, count: v.c });
    }
    const variantsOf = (id) => [...(variants.get(id) || new Map()).values()].sort((a, b) => b.count - a.count);
    const reasons = new Map();
    for (const r of this.db.prepare(
      "SELECT id, teacher_id AS tid, reason FROM votes WHERE status = 'matched' AND reason != '' ORDER BY id DESC").all()) {
      if (!reasons.has(r.tid)) reasons.set(r.tid, []);
      reasons.get(r.tid).push({ id: r.id, text: r.reason });
    }
    const counted = [...counts.values()].reduce((a, b) => a + b, 0);
    const results = teachers.map((t) => {
      const votes = counts.get(t.id) || 0;
      return {
        id: t.id, name: t.name, votes,
        pct: counted ? Math.round((votes / counted) * 1000) / 10 : 0,
        variants: variantsOf(t.id),
        reasons: reasons.get(t.id) || [],
      };
    }).sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'ar'));
    let rankNo = 0, prevVotes = null;
    results.forEach((r, i) => {
      if (r.votes !== prevVotes) { rankNo = i + 1; prevVotes = r.votes; }
      r.rank = rankNo;
    });

    const pendingMap = new Map();
    for (const r of this.db.prepare(
      "SELECT norm, raw, COUNT(*) AS c FROM votes WHERE status = 'pending' GROUP BY norm, raw ORDER BY c DESC").all()) {
      if (pendingMap.has(r.norm)) pendingMap.get(r.norm).count += r.c;
      else pendingMap.set(r.norm, { norm: r.norm, raw: r.raw, count: r.c });
    }
    const pendingRows = [...pendingMap.values()];
    const groups = N.cluster(pendingRows).map((g) => ({
      label: g.label,
      ambiguous: g.ambiguous || N.decide(g.tokens, teachers).ambiguous,
      count: g.count,
      names: g.names,
      suggestions: N.rank(g.tokens, teachers, { min: 0.4 }).slice(0, 4).map(({ id, name }) => ({ id, name })),
    }));
    const pending = pendingRows.reduce((s, r) => s + r.count, 0);
    const discarded = this.db.prepare("SELECT COUNT(*) AS c FROM votes WHERE status = 'discarded'").get().c;

    return {
      settings: { ...this.publicSettings(), publicUrl: this.getSetting('publicUrl', '') },
      totals: { counted, pending, discarded, all: counted + pending + discarded, teachers: teachers.length },
      results,
      pending: groups,
    };
  }

  /** المدير يحسم مجموعة أسماء معلّقة */
  resolvePending({ norms, teacherId, newTeacherName, discard }) {
    if (!Array.isArray(norms) || !norms.length) throw new Error('لا توجد أسماء');
    if (discard) {
      const st = this.db.prepare("UPDATE votes SET status = 'discarded' WHERE status = 'pending' AND norm = ?");
      for (const n of norms) st.run(n);
      return;
    }
    if (newTeacherName) {
      const { added } = this.addTeachers([newTeacherName]);
      teacherId = added.length ? added[0].id
        : (this.db.prepare('SELECT id FROM teachers WHERE norm = ?').get(N.normKey(newTeacherName)) || {}).id;
    }
    const t = this.teachers().find((x) => x.id === teacherId);
    if (!t) throw new Error('اختر معلّماً');
    const upd = this.db.prepare("UPDATE votes SET teacher_id = ?, status = 'matched', method = 'admin' WHERE status = 'pending' AND norm = ?");
    const alias = this.db.prepare('INSERT OR REPLACE INTO aliases(norm, teacher_id) VALUES(?, ?)');
    for (const n of norms) {
      upd.run(t.id, n);
      // تذكّر هذا القرار للأصوات القادمة، إلا إذا كان الاسم يحتمل معلّماً آخر
      const others = N.rank(n.split(' '), this.teachers()).filter((c) => c.id !== t.id);
      if (!others.length) alias.run(n, t.id);
    }
  }

  /** فصل صيغة مكتوبة عن معلّم وإعادتها للمراجعة (تصحيح ربط خاطئ) */
  detachVariant(teacherId, norm) {
    this.db.prepare('DELETE FROM aliases WHERE norm = ? AND teacher_id = ?').run(norm, teacherId);
    this.db.prepare("UPDATE votes SET teacher_id = NULL, status = 'pending', method = 'none' WHERE teacher_id = ? AND norm = ? AND status = 'matched'")
      .run(teacherId, norm);
  }

  /** حذف تعليق غير لائق (الصوت نفسه يبقى محسوباً) */
  clearReason(voteId) {
    this.db.prepare("UPDATE votes SET reason = '' WHERE id = ?").run(voteId);
  }

  resetVotes() {
    this.db.exec('DELETE FROM votes; DELETE FROM aliases;');
  }

  exportRows() {
    return this.db.prepare(`
      SELECT v.id, v.raw, t.name AS teacher, v.status, v.method, v.created, v.reason
      FROM votes v LEFT JOIN teachers t ON t.id = v.teacher_id ORDER BY v.id`).all();
  }

  // ---------- الجلسات ----------
  addSession(tokenHash, expires) {
    this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    this.db.prepare('INSERT INTO sessions(token, expires) VALUES(?, ?)').run(tokenHash, expires);
  }
  hasSession(tokenHash) {
    return !!this.db.prepare('SELECT 1 FROM sessions WHERE token = ? AND expires > ?').get(tokenHash, Date.now());
  }
  dropSession(tokenHash) {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(tokenHash);
  }
}

module.exports = { open };
