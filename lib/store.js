'use strict';
const { connect } = require('./db');
const N = require('./names');

async function open(opts) {
  const store = new Store(await connect(opts));
  await store.seedQuestions(true);
  return store;
}

const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
const toLatin = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
/** مفتاح المادة: «الرياضيات» و«رياضيات» و«اللغة العربية» و«لغة عربية» تتطابق */
const subjectKey = (s) => N.normalizeChars(clean(s, 40)).split(' ').map((w) => w.replace(/^ال(?=..)/, '')).join(' ');
const { bankQuestions } = require('./question-bank');

/* شكل شخصية الطالب في اللعبة: يُحفظ مع صوته ليظهر في الصورة الجماعية */
const LOOK = { outfit: ['hoodie', 'dishdasha'], head: ['hair', 'ghutra', 'shemagh', 'taqiya'] };
const HEX = /^#[0-9a-f]{6}$/i;
function cleanLook(look) {
  if (!look || typeof look !== 'object') return '';
  const { outfit, head, skin, color } = look;
  if (!LOOK.outfit.includes(outfit) || !LOOK.head.includes(head) || !HEX.test(skin) || !HEX.test(color)) return '';
  return JSON.stringify({ outfit, head, skin, color });
}
function parseLook(text) {
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

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
      school: map.get('school') || 'مدرسة عبداللطيف ثنيان الغانم',
      title: map.get('title') || 'من أفضل معلّم عندك؟',
      open: (map.get('open') ?? '1') === '1',
      showWords: (map.get('showWords') ?? '1') === '1',
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
  /** المواد ومعلّموها، وعدد أسئلة كل مادة. لا تُرسَل أي أصوات للطالب. */
  async game() {
    this._dirty();
    const teachers = await this.teachers();
    const qc = new Map();
    for (const r of await this.all('SELECT subject, COUNT(*)::int AS c FROM questions GROUP BY subject')) qc.set(subjectKey(r.subject), (qc.get(subjectKey(r.subject)) || 0) + r.c);
    const bySubject = new Map();
    for (const t of teachers) {
      if (!t.subject) continue;
      if (!bySubject.has(t.subject)) bySubject.set(t.subject, []);
      bySubject.get(t.subject).push({ id: t.id, name: t.name });
    }
    return {
      subjects: [...bySubject].map(([name, list]) => ({ name, teachers: list, questions: qc.get(subjectKey(name)) || 0 }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
      teachers: teachers.map((t) => ({ id: t.id, name: t.name, subject: t.subject })),
      questions: [...qc.values()].reduce((a, b) => a + b, 0),
    };
  }

  /** ثلاثة أسئلة عشوائية من المادة، بلا الإجابات */
  /** أسئلة الجبل: per سؤال من كل درس (ثلاثة دروس)، مرتّبة حسب الدرس وبلا الإجابات. بلا مادة: أسئلة منوّعة (المكتبة) */
  async diveQuestions(subject, per = 1) {
    per = Math.max(1, Math.min(3, Number(per) || 1));
    const key = subjectKey(subject);
    const all = (await this.all('SELECT id, subject, lesson, q, choices FROM questions'))
      .filter((r) => !key || subjectKey(r.subject) === key);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const byLesson = new Map();
    for (const r of shuffle(all)) { const k = key ? r.lesson || '' : `${r.subject}|${r.lesson}`; if (!byLesson.has(k)) byLesson.set(k, []); byLesson.get(k).push(r); }
    const lessons = shuffle([...byLesson.keys()]).slice(0, 3).sort((x, y) => x.localeCompare(y, 'ar'));
    const picked = lessons.flatMap((k) => byLesson.get(k).slice(0, per));
    for (const r of all) { if (picked.length >= 3 * per) break; if (!picked.includes(r)) picked.push(r); }
    return picked.slice(0, 3 * per).map((r) => ({ id: r.id, q: r.q, lesson: key ? r.lesson || '' : [r.subject, r.lesson].filter(Boolean).join(' · '), choices: JSON.parse(r.choices) }));
  }
  /** يحسب البطاقات الذهبية على الخادم: إجابة صحيحة = بطاقة ذهبية (ستّ كحدّ أقصى: سؤالان من كل درس) */
  async scorePearls(answers) {
    if (!answers || typeof answers !== 'object') return 0;
    const ids = Object.keys(answers).map(Number).filter(Number.isInteger).slice(0, 6);
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
    return (await this.all('SELECT id, subject, lesson, q, choices, answer FROM questions ORDER BY subject, lesson, id'))
      .map((r) => ({ ...r, choices: JSON.parse(r.choices) }));
  }
  async addQuestion({ subject, lesson, q, choices, answer }) {
    subject = clean(subject, 40); lesson = clean(lesson, 60); q = clean(q, 200);
    choices = (Array.isArray(choices) ? choices : []).map((c) => clean(c, 80)).filter(Boolean).slice(0, 4);
    answer = Number(answer);
    if (!subject) throw new Error('اختر المادة.');
    if (!q) throw new Error('اكتب السؤال.');
    if (choices.length < 2) throw new Error('اكتب خيارين على الأقل.');
    if (!(answer >= 0 && answer < choices.length)) throw new Error('حدّد الإجابة الصحيحة.');
    await this.run('INSERT INTO questions(subject, lesson, q, choices, answer, created) VALUES(?, ?, ?, ?, ?, ?)',
      [subject, lesson, q, JSON.stringify(choices), answer, Date.now()]);
  }
  /** بنك الأسئلة الجاهز للمرحلة الثانوية. onlyIfEmpty: عند أول تشغيل فقط. يتخطّى الأسئلة الموجودة */
  async seedQuestions(onlyIfEmpty = false) {
    const { c } = await this.one('SELECT COUNT(*)::int AS c FROM questions');
    if (onlyIfEmpty && c > 0) return 0;
    const have = new Set((await this.all('SELECT q FROM questions')).map((r) => r.q));
    let added = 0;
    for (const x of bankQuestions()) {
      if (have.has(x.q)) continue;
      await this.addQuestion(x); added++;
    }
    return added;
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

  async castVote({ raw, teacherId, device, force, reason, subject, pearls, look, score }) {
    raw = clean(raw, 80);
    look = cleanLook(look);
    score = Math.max(0, Math.min(99999, Math.round(Number(score) || 0)));
    reason = clean(reason, 300);
    subject = clean(subject, 40);
    pearls = Math.max(0, Math.min(6, Number(pearls) || 0));
    const insert = (name, norm, tid, status, method) => this.run(
      'INSERT INTO votes(raw, norm, teacher_id, status, method, device, created, reason, subject, pearls, look, score) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, norm, tid, status, method, device, Date.now(), reason, subject, pearls, look, score]);
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

  /** كلمات الطلاب لمعلّميهم، تُعرض في اللعبة بلا أي شيء يدلّ على كاتبها */
  async words() {
    if (!(await this.settings()).showWords) return [];
    const rows = await this.all(`SELECT v.reason, t.id AS tid, t.name AS teacher, t.subject FROM votes v JOIN teachers t ON t.id = v.teacher_id
      WHERE v.status = 'matched' AND v.reason != '' ORDER BY v.id DESC LIMIT 120`);
    return rows.map((r) => ({ tid: r.tid, teacher: r.teacher, subject: r.subject || '', text: r.reason }));
  }

  /** الصورة الجماعية: كل طالب شارك، بشخصيته، واسم معلّمه، وكلمته */
  async photo() {
    const [rows, settings] = await Promise.all([
      this.all(`SELECT v.id, v.reason, v.look, v.pearls, v.score, v.created, t.id AS tid, t.name AS teacher, t.subject
        FROM votes v JOIN teachers t ON t.id = v.teacher_id WHERE v.status = 'matched' ORDER BY v.id`),
      this.settings(),
    ]);
    return {
      school: settings.school,
      items: rows.map((r) => ({ id: r.id, tid: r.tid, teacher: r.teacher, subject: r.subject || '', reason: r.reason || '', pearls: Number(r.pearls) || 0, score: Number(r.score) || 0, created: Number(r.created), look: parseLook(r.look) })),
    };
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
      settings: { school: settings.school, title: settings.title, open: settings.open, showWords: settings.showWords, publicUrl: settings.publicUrl },
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
    await this.db.exec('DELETE FROM votes; DELETE FROM aliases; DELETE FROM seats;');
  }

  /* ---------- الفصول وأرقام الكشف ---------- */
  async classes() {
    return (await this.all('SELECT name, size FROM classes ORDER BY pos, name')).map((r) => ({ name: r.name, size: Number(r.size) }));
  }
  /** سطر لكل فصل: «10/1 | 30» (اسم الفصل | عدد طلابه). يستبدل القائمة كلها */
  async setClasses(lines) {
    const rows = [], seen = new Set();
    for (const raw of (Array.isArray(lines) ? lines : String(lines || '').split('\n')).slice(0, 200)) {
      const line = toLatin(clean(raw, 60));
      if (!line) continue;
      const m = line.match(/^(.*?)[\s|،,:-]+(\d{1,3})$/);
      if (!m) throw new Error(`اكتب عدد الطلاب بعد اسم الفصل: «${line}»`);
      const name = clean(m[1].replace(/[|،,:]+$/, ''), 20), size = Number(m[2]);
      if (!name) throw new Error(`اسم الفصل ناقص: «${line}»`);
      if (size < 1 || size > 80) throw new Error(`عدد طلاب ${name} يجب أن يكون من 1 إلى 80.`);
      if (seen.has(name)) throw new Error(`الفصل ${name} مكرّر.`);
      seen.add(name); rows.push([name, size]);
    }
    await this.run('DELETE FROM classes');
    for (let i = 0; i < rows.length; i++) await this.run('INSERT INTO classes(name, size, pos) VALUES(?, ?, ?)', [rows[i][0], rows[i][1], i]);
    return { count: rows.length };
  }
  /** يتحقّق من الفصل ورقم الكشف، ويخبر إن كان الرقم صوّت من قبل */
  async checkSeat(klass, roll) {
    const c = (await this.classes()).find((x) => x.name === clean(klass, 20));
    if (!c) throw new Error('اختر فصلك من القائمة.');
    const n = Number(toLatin(String(roll ?? '').trim()));
    if (!Number.isInteger(n) || n < 1 || n > c.size) throw new Error(`رقمك في كشف ${c.name} من 1 إلى ${c.size}.`);
    const used = await this.one('SELECT 1 AS x FROM seats WHERE klass = ? AND roll = ?', [c.name, n]);
    return { klass: c.name, roll: n, used: !!used };
  }
  /** يحجز المقعد؛ false إن سبقه أحد */
  async takeSeat(klass, roll) {
    const rows = await this.all('INSERT INTO seats(klass, roll, created) VALUES(?, ?, ?) ON CONFLICT DO NOTHING RETURNING roll', [klass, roll, Date.now()]);
    return rows.length > 0;
  }
  async freeSeat(klass, roll) { await this.run('DELETE FROM seats WHERE klass = ? AND roll = ?', [clean(klass, 20), Number(toLatin(String(roll).trim()))]); }
  /** المشاركة في كل فصل: الأرقام التي صوّتت (بلا أي ربط بأصواتها) */
  async participation() {
    const seats = await this.all('SELECT klass, roll FROM seats ORDER BY roll');
    return (await this.classes()).map((c) => ({ ...c, done: seats.filter((s) => s.klass === c.name).map((s) => Number(s.roll)) }));
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
