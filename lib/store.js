'use strict';
const { connect } = require('./db');
const N = require('./names');

async function open(opts) {
  return new Store(await connect(opts));
}

const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

class Store {
  constructor(db) {
    this.db = db;
    this._teachers = null;
    this._teachersAt = 0;
  }

  async one(sql, params) { return (await this.db.query(sql, params)).rows[0] || null; }
  async all(sql, params) { return (await this.db.query(sql, params)).rows; }
  async run(sql, params) { return (await this.db.query(sql, params)).count; }

  // ---------- الإعدادات ----------
  async getSetting(key, fallback = null) {
    const row = await this.one('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : fallback;
  }
  async setSetting(key, value) {
    await this.run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value',
      [key, String(value)]);
  }
  async settings() {
    const map = new Map((await this.all('SELECT key, value FROM settings')).map((r) => [r.key, r.value]));
    return {
      school: map.get('school') || '',
      title: map.get('title') || 'من هو معلّمك المفضّل؟',
      open: (map.get('open') ?? '1') === '1',
      publicUrl: map.get('publicUrl') || '',
      adminHash: map.get('adminHash') || '',
    };
  }
  async publicSettings() {
    const { school, title, open } = await this.settings();
    return { school, title, open };
  }

  // ---------- المعلّمون ----------
  // قائمة صغيرة: تُقرأ من القاعدة مع ذاكرة قصيرة (عدة نسخ من الخادم قد تعمل معاً)
  async teachers() {
    if (!this._teachers || Date.now() - this._teachersAt > 2000) {
      this._teachers = (await this.all('SELECT id, name, norm, subject FROM teachers ORDER BY name'))
        .map((t) => ({ ...t, tokens: N.tokenize(t.name) }));
      this._teachersAt = Date.now();
    }
    return this._teachers;
  }
  _dirty() { this._teachers = null; }

  /** كل سطر: «الاسم | المادة» (المادة اختيارية). المعلّم الموجود تُحدَّث مادته فقط. */
  async addTeachers(entries) {
    const added = [], skipped = [];
    for (const entry of entries) {
      const parts = String(entry || '').split(/\s*[|:؛]\s*|\s+[-–—]\s+/);
      const name = clean(parts[0], 80);
      const subject = clean(parts.slice(1).join(' '), 40);
      const norm = N.normKey(name);
      if (!norm) continue;
      const row = await this.one(
        'INSERT INTO teachers(name, norm, created, subject) VALUES(?, ?, ?, ?) ON CONFLICT(norm) DO NOTHING RETURNING id',
        [name, norm, Date.now(), subject]);
      if (row) added.push({ id: row.id, name });
      else {
        if (subject) await this.run('UPDATE teachers SET subject = ? WHERE norm = ?', [subject, norm]);
        skipped.push(name);
      }
    }
    this._dirty();
    if (added.length) await this.rematchPending();
    return { added, skipped };
  }

  async renameTeacher(id, newName) {
    const name = clean(newName, 80);
    const norm = N.normKey(name);
    if (!norm) throw new Error('الاسم فارغ');
    if (await this.one('SELECT id FROM teachers WHERE norm = ? AND id != ?', [norm, id])) throw new Error('يوجد معلّم آخر بهذا الاسم');
    await this.run('UPDATE teachers SET name = ?, norm = ? WHERE id = ?', [name, norm, id]);
    this._dirty();
    await this.rematchPending();
  }

  async setSubject(id, subject) {
    await this.run('UPDATE teachers SET subject = ? WHERE id = ?', [clean(subject, 40), id]);
    this._dirty();
  }

  // ---------- اللعبة ----------
  /** المواد ومعلّموها، وعدد أسئلة الغوص لكل مادة. لا تُرسَل أي أصوات للطالب. */
  async game() {
    this._dirty();
    const teachers = await this.teachers();
    const qc = new Map((await this.all('SELECT subject, COUNT(*)::int AS c FROM questions GROUP BY subject')).map((r) => [r.subject, r.c]));
    const bySubject = new Map();
    for (const t of teachers) {
      if (!t.subject) continue;
      if (!bySubject.has(t.subject)) bySubject.set(t.subject, []);
      bySubject.get(t.subject).push({ id: t.id, name: t.name });
    }
    return {
      subjects: [...bySubject].map(([name, list]) => ({ name, teachers: list, questions: qc.get(name) || 0 }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
      teachers: teachers.map((t) => ({ id: t.id, name: t.name, subject: t.subject })),
    };
  }

  /** ثلاثة أسئلة عشوائية من المادة، بلا الإجابات */
  async diveQuestions(subject) {
    return (await this.all('SELECT id, q, choices FROM questions WHERE subject = ? ORDER BY random() LIMIT 3', [clean(subject, 40)]))
      .map((r) => ({ id: r.id, q: r.q, choices: JSON.parse(r.choices) }));
  }

  /** يحسب اللؤلؤ على الخادم: إجابة صحيحة = لؤلؤة (ثلاث كحدّ أقصى) */
  async scorePearls(answers) {
    if (!answers || typeof answers !== 'object') return 0;
    const ids = Object.keys(answers).map(Number).filter(Number.isInteger).slice(0, 3);
    let pearls = 0;
    for (const id of ids) {
      const row = await this.one('SELECT answer FROM questions WHERE id = ?', [id]);
      if (row && row.answer === Number(answers[id])) pearls++;
    }
    return pearls;
  }

  /** للتعلّم: يُظهر للطالب الإجابة الصحيحة بعد أن يجيب */
  async checkAnswer(id, choice) {
    const row = await this.one('SELECT answer FROM questions WHERE id = ?', [Number(id)]);
    if (!row) throw new Error('السؤال غير موجود.');
    return { correct: row.answer === Number(choice), answer: row.answer };
  }

  async listQuestions() {
    return (await this.all('SELECT id, subject, q, choices, answer FROM questions ORDER BY subject, id'))
      .map((r) => ({ ...r, choices: JSON.parse(r.choices) }));
  }
  async addQuestion({ subject, q, choices, answer }) {
    subject = clean(subject, 40); q = clean(q, 200);
    choices = (Array.isArray(choices) ? choices : []).map((c) => clean(c, 80)).filter(Boolean).slice(0, 4);
    answer = Number(answer);
    if (!subject) throw new Error('اختر المادة.');
    if (!q) throw new Error('اكتب السؤال.');
    if (choices.length < 2) throw new Error('اكتب خيارين على الأقل.');
    if (!(answer >= 0 && answer < choices.length)) throw new Error('حدّد الإجابة الصحيحة.');
    await this.run('INSERT INTO questions(subject, q, choices, answer, created) VALUES(?, ?, ?, ?, ?)',
      [subject, q, JSON.stringify(choices), answer, Date.now()]);
  }
  async deleteQuestion(id) { await this.run('DELETE FROM questions WHERE id = ?', [id]); }

  async deleteTeacher(id) {
    // أصواته ترجع إلى قائمة المراجعة ولا تُحذف
    await this.run("UPDATE votes SET teacher_id = NULL, status = 'pending', method = 'none' WHERE teacher_id = ?", [id]);
    await this.run('DELETE FROM teachers WHERE id = ?', [id]);
    this._dirty();
    await this.rematchPending();
  }

  async mergeTeachers(fromId, intoId) {
    if (fromId === intoId) return;
    const from = await this.one('SELECT * FROM teachers WHERE id = ?', [fromId]);
    const into = await this.one('SELECT * FROM teachers WHERE id = ?', [intoId]);
    if (!from || !into) throw new Error('المعلّم غير موجود');
    await this.run('UPDATE votes SET teacher_id = ? WHERE teacher_id = ?', [intoId, fromId]);
    await this.run('UPDATE aliases SET teacher_id = ? WHERE teacher_id = ?', [intoId, fromId]);
    await this.run('DELETE FROM teachers WHERE id = ?', [fromId]);
    await this.setAlias(from.norm, intoId);
    this._dirty();
  }

  setAlias(norm, teacherId) {
    return this.run('INSERT INTO aliases(norm, teacher_id) VALUES(?, ?) ON CONFLICT(norm) DO UPDATE SET teacher_id = EXCLUDED.teacher_id',
      [norm, teacherId]);
  }

  // ---------- المطابقة ----------
  /** يحاول ربط اسم مكتوب بمعلّم. */
  async resolve(raw, teachers) {
    teachers = teachers || await this.teachers();
    const tokens = N.tokenize(raw);
    const norm = tokens.map(N.core).join(' ');
    const alias = norm && await this.one('SELECT teacher_id FROM aliases WHERE norm = ?', [norm]);
    if (alias) {
      const t = teachers.find((x) => x.id === alias.teacher_id);
      if (t) return { norm, teacher: t, method: 'alias', candidates: [], ambiguous: false };
    }
    const d = N.decide(tokens, teachers);
    return { norm, teacher: d.teacher, method: 'auto', candidates: d.candidates, ambiguous: d.ambiguous };
  }

  async suggest(q) {
    const tokens = N.tokenize(q);
    if (!tokens.length || tokens.join('').length < 2) return [];
    return N.rank(tokens, await this.teachers(), { prefix: true, min: 0.45 }).slice(0, 6)
      .map(({ id, name }) => ({ id, name }));
  }

  /** يعيد فحص الأسماء المعلّقة بعد أي تغيير في قائمة المعلّمين */
  async rematchPending() {
    this._dirty();
    const teachers = await this.teachers();
    const rows = await this.all("SELECT norm, MIN(raw) AS raw FROM votes WHERE status = 'pending' GROUP BY norm");
    let moved = 0;
    for (const row of rows) {
      const r = await this.resolve(row.raw, teachers);
      if (r.teacher) {
        moved += await this.run("UPDATE votes SET teacher_id = ?, status = 'matched', method = ? WHERE status = 'pending' AND norm = ?",
          [r.teacher.id, r.method, row.norm]);
      }
    }
    return moved;
  }

  // ---------- التصويت ----------
  async hasVoted(device) {
    return !!(await this.one('SELECT 1 AS x FROM votes WHERE device = ?', [device]));
  }

  async castVote({ raw, teacherId, device, force, reason, subject, pearls }) {
    raw = clean(raw, 80);
    reason = clean(reason, 300);
    subject = clean(subject, 40);
    pearls = Math.max(0, Math.min(3, Number(pearls) || 0));
    const insert = (name, norm, tid, status, method) => this.run(
      'INSERT INTO votes(raw, norm, teacher_id, status, method, device, created, reason, subject, pearls) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, norm, tid, status, method, device, Date.now(), reason, subject, pearls]);
    const teachers = await this.teachers();

    if (teacherId) {
      const t = teachers.find((x) => x.id === teacherId);
      if (!t) throw new Error('المعلّم غير موجود');
      await insert(raw || t.name, N.normKey(raw || t.name), t.id, 'matched', 'picked');
      return { status: 'counted', teacher: t.name };
    }

    const r = await this.resolve(raw, teachers);
    if (!r.norm) throw new Error('اكتب اسم المعلّم');
    if (r.teacher) {
      await insert(raw, r.norm, r.teacher.id, 'matched', r.method);
      return { status: 'counted', teacher: r.teacher.name };
    }
    // غير واضح: اطلب من الطالب أن يختار قبل تسجيل الصوت
    if (!force && r.candidates.length) {
      return { status: 'choose', candidates: r.candidates.slice(0, 5).map(({ id, name }) => ({ id, name })) };
    }
    await insert(raw, r.norm, null, 'pending', 'none');
    return { status: 'pending' };
  }

  // ---------- لوحة التحكم ----------
  async dashboard() {
    this._dirty();
    const teachers = await this.teachers();
    const [countRows, variantRows, reasonRows, pendingRaw, discardedRow, settings] = await Promise.all([
      this.all("SELECT teacher_id AS id, COUNT(*)::int AS c, COALESCE(SUM(pearls), 0)::int AS p FROM votes WHERE status = 'matched' GROUP BY teacher_id"),
      // لكل صيغة موحّدة نعرض أكثر كتابة تكرّرت بين الطلاب
      this.all("SELECT teacher_id AS id, norm, raw, COUNT(*)::int AS c FROM votes WHERE status = 'matched' GROUP BY teacher_id, norm, raw ORDER BY c DESC"),
      this.all("SELECT id, teacher_id AS tid, reason FROM votes WHERE status = 'matched' AND reason != '' ORDER BY id DESC"),
      this.all("SELECT norm, raw, COUNT(*)::int AS c FROM votes WHERE status = 'pending' GROUP BY norm, raw ORDER BY c DESC"),
      this.one("SELECT COUNT(*)::int AS c FROM votes WHERE status = 'discarded'"),
      this.settings(),
    ]);
    const counts = new Map(countRows.map((r) => [r.id, r.c]));
    const pearlsOf = new Map(countRows.map((r) => [r.id, r.p]));
    const variants = new Map();
    for (const v of variantRows) {
      if (!variants.has(v.id)) variants.set(v.id, new Map());
      const m = variants.get(v.id);
      if (m.has(v.norm)) m.get(v.norm).count += v.c;
      else m.set(v.norm, { norm: v.norm, raw: v.raw, count: v.c });
    }
    const variantsOf = (id) => [...(variants.get(id) || new Map()).values()].sort((a, b) => b.count - a.count);
    const reasons = new Map();
    for (const r of reasonRows) {
      if (!reasons.has(r.tid)) reasons.set(r.tid, []);
      reasons.get(r.tid).push({ id: r.id, text: r.reason });
    }
    const counted = [...counts.values()].reduce((a, b) => a + b, 0);
    const results = teachers.map((t) => {
      const votes = counts.get(t.id) || 0;
      return {
        id: t.id, name: t.name, subject: t.subject, votes, pearls: pearlsOf.get(t.id) || 0,
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
    for (const r of pendingRaw) {
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
    const discarded = discardedRow.c;

    return {
      settings: { school: settings.school, title: settings.title, open: settings.open, publicUrl: settings.publicUrl },
      totals: { counted, pending, discarded, all: counted + pending + discarded, teachers: teachers.length },
      results,
      pending: groups,
    };
  }

  /** المدير يحسم مجموعة أسماء معلّقة */
  async resolvePending({ norms, teacherId, newTeacherName, discard }) {
    if (!Array.isArray(norms) || !norms.length) throw new Error('لا توجد أسماء');
    norms = norms.map(String);
    if (discard) {
      for (const n of norms) await this.run("UPDATE votes SET status = 'discarded' WHERE status = 'pending' AND norm = ?", [n]);
      return;
    }
    if (newTeacherName) {
      const { added } = await this.addTeachers([newTeacherName]);
      teacherId = added.length ? added[0].id
        : ((await this.one('SELECT id FROM teachers WHERE norm = ?', [N.normKey(newTeacherName)])) || {}).id;
    }
    this._dirty();
    const teachers = await this.teachers();
    const t = teachers.find((x) => x.id === teacherId);
    if (!t) throw new Error('اختر معلّماً');
    for (const n of norms) {
      await this.run("UPDATE votes SET teacher_id = ?, status = 'matched', method = 'admin' WHERE status = 'pending' AND norm = ?", [t.id, n]);
      // تذكّر هذا القرار للأصوات القادمة، إلا إذا كان الاسم يحتمل معلّماً آخر
      const others = N.rank(n.split(' '), teachers).filter((c) => c.id !== t.id);
      if (!others.length) await this.setAlias(n, t.id);
    }
  }

  /** فصل صيغة مكتوبة عن معلّم وإعادتها للمراجعة (تصحيح ربط خاطئ) */
  async detachVariant(teacherId, norm) {
    await this.run('DELETE FROM aliases WHERE norm = ? AND teacher_id = ?', [norm, teacherId]);
    await this.run("UPDATE votes SET teacher_id = NULL, status = 'pending', method = 'none' WHERE teacher_id = ? AND norm = ? AND status = 'matched'",
      [teacherId, norm]);
  }

  /** حذف تعليق غير لائق (الصوت نفسه يبقى محسوباً) */
  async clearReason(voteId) {
    await this.run("UPDATE votes SET reason = '' WHERE id = ?", [voteId]);
  }

  async resetVotes() {
    await this.db.exec('DELETE FROM votes; DELETE FROM aliases;');
  }

  async exportRows() {
    return (await this.all(`
      SELECT v.id, v.raw, t.name AS teacher, v.status, v.method, v.created, v.reason, v.subject, v.pearls
      FROM votes v LEFT JOIN teachers t ON t.id = v.teacher_id ORDER BY v.id`))
      .map((r) => ({ ...r, created: Number(r.created) }));
  }

  // ---------- الجلسات ----------
  async addSession(tokenHash, expires) {
    await this.run('DELETE FROM sessions WHERE expires < ?', [Date.now()]);
    await this.run('INSERT INTO sessions(token, expires) VALUES(?, ?)', [tokenHash, expires]);
  }
  async hasSession(tokenHash) {
    return !!(await this.one('SELECT 1 AS x FROM sessions WHERE token = ? AND expires > ?', [tokenHash, Date.now()]));
  }
  async dropSession(tokenHash) {
    await this.run('DELETE FROM sessions WHERE token = ?', [tokenHash]);
  }

  // ---------- الحماية من تخمين كلمة المرور (تعمل مع عدة نسخ من الخادم) ----------
  async loginAttempt(ip, windowMs, max) {
    const now = Date.now();
    await this.run('DELETE FROM login_attempts WHERE at < ?', [now - windowMs]);
    const { c } = await this.one('SELECT COUNT(*)::int AS c FROM login_attempts WHERE ip = ?', [ip]);
    if (c >= max) return false;
    await this.run('INSERT INTO login_attempts(ip, at) VALUES(?, ?)', [ip, now]);
    return true;
  }
}

module.exports = { open };
