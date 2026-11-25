'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../lib/names');

const roster = (names) => names.map((name, i) => ({ id: i + 1, name, tokens: N.tokenize(name) }));
const pick = (q, teachers) => N.decide(N.tokenize(q), teachers);

test('الاسم الناقص والخطأ الإملائي يذهبان لنفس المعلّم', () => {
  const T = roster(['محمد صالح العنزي', 'خالد فهد المطيري', 'أحمد علي الشمري']);
  for (const q of [
    'محمد العنيزي', 'محمد صالح العنيزي', 'أ. محمد العنزي', 'الأستاذ مُحَمَّد العنزى',
    'محمد صالح', 'العنزي', 'استاذ العنزي', 'محمد بن صالح العنزي',
  ]) {
    const r = pick(q, T);
    assert.equal(r.teacher && r.teacher.id, 1, `"${q}" يجب أن يُربط بمحمد صالح العنزي`);
  }
});

test('لا يخلط بين أسماء مختلفة متقاربة الكتابة', () => {
  const T = roster(['محمد صالح العنزي', 'محمود صالح العنزي', 'أحمد سعد الحربي', 'حمد سعيد الحربي']);
  assert.equal(pick('محمود العنزي', T).teacher.id, 2);
  assert.equal(pick('محمد صالح العنزي', T).teacher.id, 1);
  assert.equal(pick('احمد الحربي', T).teacher.id, 3);
  assert.equal(pick('حمد الحربي', T).teacher.id, 4);
});

test('الاسم المحتمل لأكثر من معلّم لا يُحسب تلقائياً', () => {
  const T = roster(['محمد صالح العنزي', 'محمد فهد العنزي']);
  const r = pick('محمد العنزي', T);
  assert.equal(r.teacher, null);
  assert.equal(r.ambiguous, true);
  assert.equal(r.candidates.length, 2);
  assert.equal(pick('محمد فهد', T).teacher.id, 2);
});

test('اسم غير موجود في القائمة لا يُربط بأحد', () => {
  const T = roster(['محمد صالح العنزي', 'خالد فهد المطيري']);
  assert.equal(pick('يوسف الرشيدي', T).teacher, null);
  assert.equal(pick('خالد العنزي', T).teacher, null);
});

test('توحيد الكتابة: عبد الله = عبدالله، والهمزات والتاء المربوطة', () => {
  assert.equal(N.normKey('عبد الله الأحمد'), N.normKey('عبدالله الاحمد'));
  assert.equal(N.normKey('أ/ فاطمة الزهراني'), N.normKey('فاطمه الزهرانى'));
  assert.equal(N.normKey('المعلم   إبراهيم'), N.normKey('ابراهيم'));
  const T = roster(['عبدالرحمن ناصر الدوسري']);
  assert.equal(pick('عبد الرحمن الدوسري', T).teacher.id, 1);
});

test('الاقتراح أثناء الكتابة يعمل مع كلمة غير مكتملة', () => {
  const T = roster(['محمد صالح العنزي', 'خالد فهد المطيري']);
  const r = N.rank(N.tokenize('محمد العن'), T, { prefix: true });
  assert.equal(r[0].id, 1);
  assert.equal(N.rank(N.tokenize('خا'), T, { prefix: true })[0].id, 2);
});

test('تجميع الأسماء بلا قائمة معلّمين', () => {
  const items = [
    ['محمد صالح العنزي', 4], ['محمد العنيزي', 3], ['محمد العنزي', 2],
    ['خالد المطيري', 5], ['خالد فهد المطيري', 1],
  ].map(([raw, count]) => ({ raw, count, norm: N.normKey(raw) }));
  const g = N.cluster(items);
  assert.equal(g.length, 2);
  assert.equal(g[0].count, 9);
  assert.equal(g[1].count, 6);
});

// بنك الأسئلة: الأسئلة الجاهزة سليمة، والتحقق من الإجابة يعمل
const { bankQuestions } = require('../lib/question-bank');
test('بنك الأسئلة: ٣ دروس لكل مادة، والإجابة الصحيحة ضمن الخيارات', () => {
  const qs = bankQuestions();
  const bySubject = new Map();
  for (const q of qs) {
    assert.ok(q.choices.length === 3 && q.answer >= 0 && q.answer < 3, q.q);
    assert.equal(new Set(q.choices).size, 3, `خيارات مكرّرة: ${q.q}`);
    if (!bySubject.has(q.subject)) bySubject.set(q.subject, new Set());
    bySubject.get(q.subject).add(q.lesson);
  }
  for (const [s, lessons] of bySubject) assert.equal(lessons.size, 3, s);
  // الخلط لا يجعل الإجابة الصحيحة في المكان نفسه دائماً
  assert.ok(new Set(qs.map((q) => q.answer)).size > 1);
});
