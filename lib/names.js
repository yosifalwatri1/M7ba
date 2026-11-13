'use strict';
/**
 * محرّك مطابقة الأسماء العربية.
 *
 * الفكرة: الطالب يكتب الاسم كما يتذكّره ("أ. محمد العنيزي")، ونحن نربطه
 * بالمعلّم الصحيح في القائمة ("محمد صالح العنزي") دون أن نخلط بين معلّمين
 * مختلفين ("محمد" و"محمود").
 */

// ألقاب تُحذف من بداية الاسم
const TITLES = new Set([
  'استاذ', 'الاستاذ', 'استاذه', 'الاستاذه', 'استاذي', 'استاذنا', 'معلم', 'المعلم', 'معلمه', 'المعلمه',
  'معلمي', 'دكتور', 'الدكتور', 'دكتوره', 'الدكتوره', 'د', 'ا', 'م', 'مستر', 'مس', 'مسز', 'الشيخ', 'شيخ',
  'ابله', 'الابله', 'سيد', 'السيد', 'مدرس', 'المدرس', 'مدرسه', 'المدرسه',
  'mr', 'ms', 'mrs', 'miss', 'dr', 'teacher', 'ustaz', 'ustadh',
]);

// كلمات ربط تُحذف من وسط الاسم
const CONNECTORS = new Set(['بن', 'ابن', 'بنت']);

// بادئات تُدمج مع الكلمة التي بعدها: "عبد الله" = "عبدالله"
const JOIN_PREFIX = new Set(['عبد', 'ابو', 'بو', 'ام', 'ال']);

// أسماء شائعة متقاربة في الكتابة لكنها أسماء مختلفة تماماً.
// لا نسمح بالمطابقة التقريبية بين اسمين من هذه القائمة.
const COMMON_NAMES = new Set(`
محمد محمود احمد حمد حامد حميد حمود حمدان حمدي حماد مهند
سعد سعيد سعود مسعود اسعد ساعد سعدون
خالد خلود خليل خليفه خلف مخلد
فهد فهاد فهيد فؤاد فواد فايز فواز فوزي فيصل فلاح فالح فارس فراس
سالم سليم سلمان سليمان سلطان سلامه سلام مسلم اسلام سامي سمير سامر
علي عليان علاء علوان عادل عدنان عمر عمرو عامر عمار عماد عمران
عبدالله عبدالرحمن عبدالعزيز عبدالكريم عبدالرحيم عبدالمجيد عبدالحميد عبدالمحسن
عبدالملك عبدالوهاب عبدالهادي عبداللطيف عبدالرزاق عبدالسلام عبدالغني عبدالقادر
ناصر نصر نصار منصور ناجي نايف نواف نوف نوره نور نوال نبيل نادر ناديه
صالح صلاح صباح صبحي صابر صقر
راشد رشيد رشاد رائد رايد رعد رياض ريان رامي رمضان
ماجد مجدي مجيد مازن مالك مبارك مشاري مشعل مشعان مطلق مطر
يوسف يونس ياسر ياسين يحيى يعقوب يزيد
ابراهيم اسماعيل اسحاق ادريس ايوب انور انس امين ايمن اسامه
حسن حسين حسان حسام حازم حاتم حبيب حمزه
جابر جاسم جمال جميل جمعه جراح جواد
بدر بندر بشير بسام باسم بلال باسل
طلال طارق طاهر طه طالب
هاني هادي هشام هيثم هلال هزاع
وليد وائل وليم وسام
زياد زيد زايد زكي زكريا
غازي غانم غسان
شاكر شريف شهاب شعبان شافي
كريم كمال كامل
تركي تامر توفيق
ضاري ضيف
ثامر ثابت
ذياب
قاسم
عيسى موسى مصطفى مرتضى مهدي مهنا
فاطمه عائشه عايشه مريم ساره سميره سميه سلمى سلوى سعاد هند هدى هيا هيفاء
منى منال مها ريم رنا رهف دانه دلال امل امال اماني ايمان اسماء اسيل
لطيفه لولوه ليلى لمياء شيخه شهد شيماء غاده غدير عبير عفاف وفاء وضحه
حصه حنان حياه خديجه زينب زهره جميله بدريه بشاير نجلاء نجاه
`.split(/\s+/).filter(Boolean));

function normalizeChars(str) {
  return String(str || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '') // تشكيل + تطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/گ/g, 'ك')
    .replace(/ء/g, '')
    .replace(/[^a-zء-ي]+/g, ' ')
    .trim();
}

/** يحوّل الاسم الخام إلى قائمة كلمات موحّدة */
function tokenize(raw) {
  let parts = normalizeChars(raw).split(' ').filter(Boolean);

  // احذف الألقاب من البداية (ما دام يبقى شيء بعدها)
  while (parts.length > 1 && TITLES.has(parts[0])) parts.shift();

  // احذف كلمات الربط (بن / ابن) إن لم تكن أول كلمة
  parts = parts.filter((p, i) => i === 0 || !CONNECTORS.has(p));

  // ادمج البادئات المنفصلة
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (JOIN_PREFIX.has(p) && i + 1 < parts.length) {
      let next = parts[i + 1];
      // "عبد الله" و "عبد اللة" → عبدالله
      out.push(p + next);
      i++;
    } else {
      out.push(p);
    }
  }
  return out;
}

/** مفتاح موحّد للاسم: نفس المفتاح = نفس الكتابة فعلياً */
function normKey(raw) {
  return tokenize(raw).map(core).join(' ');
}

/** يحذف "ال" التعريف للمقارنة: العنزي = عنزي */
function core(tok) {
  return tok.length >= 5 && tok.startsWith('ال') ? tok.slice(2) : tok;
}

/** مسافة التحرير (مع تبديل حرفين متجاورين) */
function editDistance(a, b) {
  const n = a.length, m = b.length;
  if (!n) return m;
  if (!m) return n;
  let prev2 = null;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur.push(v);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[m];
}

/** تشابه كلمتين: 1 تطابق، 0.85 خطأ إملائي بسيط، 0 مختلفتان */
function tokenSim(a, b) {
  a = core(a); b = core(b);
  if (a === b) return 1;
  if (COMMON_NAMES.has(a) && COMMON_NAMES.has(b)) return 0; // محمد ≠ محمود
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 4) return 0; // الكلمات القصيرة: تطابق تام فقط
  const d = editDistance(a, b);
  if (d === 1) return 0.85;
  if (d === 2 && maxLen >= 8) return 0.75;
  return 0;
}

/** كلمة يكتبها الطالب الآن (غير مكتملة) تطابق بداية كلمة في اسم المعلّم */
function prefixSim(partial, full) {
  const fulls = [full, core(full)];
  const parts = [partial];
  if (partial.startsWith('ال') && partial.length > 2) parts.push(partial.slice(2));
  for (const p of parts) {
    if (p.length < 2) continue;
    for (const f of fulls) if (f.length > p.length && f.startsWith(p)) return 0.9;
  }
  return 0;
}

/**
 * أفضل محاذاة مرتّبة: كل كلمات الاسم الأقصر يجب أن تجد مقابلاً لها
 * في الاسم الأطول وبنفس الترتيب. تُرجع مجموع التشابه أو -1.
 */
function alignSum(M, r0, r1, c0, c1) {
  // يطابق الصفوف r0..r1 (كلها) داخل الأعمدة c0..c1
  const n = r1 - r0 + 1, m = c1 - c0 + 1;
  if (n <= 0) return 0;
  if (m < n) return -1;
  const NEG = -1e9;
  let prev = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1).fill(NEG);
    for (let j = i; j <= m; j++) {
      const s = M[r0 + i - 1][c0 + j - 1];
      const take = s > 0 && prev[j - 1] > NEG / 2 ? prev[j - 1] + s : NEG;
      cur[j] = Math.max(cur[j - 1], take);
    }
    prev = cur;
  }
  return prev[m] > NEG / 2 ? prev[m] : -1;
}

/**
 * درجة تطابق اسم مكتوب مع اسم معلّم (0..1).
 * 1.0 = نفس الاسم تماماً. ‎≥0.6 مرشّح قوي. ‎<0.5 لا علاقة.
 */
function scoreTokens(q, t, opts = {}) {
  if (!q.length || !t.length) return 0;
  // مصفوفة التشابه: الصفوف = الأقصر
  const qShort = q.length <= t.length;
  const S = qShort ? q : t, L = qShort ? t : q;
  const n = S.length, m = L.length;
  const M = S.map((s, i) => L.map((l, j) => {
    let sim = tokenSim(s, l);
    if (!sim && opts.prefix) {
      // الكلمة الأخيرة في ما يكتبه الطالب قد تكون غير مكتملة
      if (qShort && i === n - 1) sim = prefixSim(s, l);
      else if (!qShort && j === m - 1) sim = prefixSim(l, s);
    }
    return sim;
  }));

  let best = -1; // أفضل (مجموع التشابه + المكافأة)
  let bestSum = 0, bestBonus = 0;
  const consider = (sum, bonus) => {
    if (sum < 0) return;
    const total = sum / n + bonus;
    if (total > best) { best = total; bestSum = sum; bestBonus = bonus; }
  };

  if (n === 1) {
    for (let j = 0; j < m; j++) {
      if (M[0][j] > 0) {
        const edge = (j === 0 ? 0.1 : 0) + (j === m - 1 ? 0.1 : 0);
        consider(M[0][j], edge);
      }
    }
  } else {
    const first = M[0][0], last = M[n - 1][m - 1];
    if (first > 0 && last > 0) {
      const mid = alignSum(M, 1, n - 2, 1, m - 2);
      if (mid >= 0) consider(first + mid + last, 0.2);
    }
    if (first > 0) {
      const rest = alignSum(M, 1, n - 1, 1, m - 1);
      if (rest >= 0) consider(first + rest, 0.1);
    }
    if (last > 0) {
      const rest = alignSum(M, 0, n - 2, 0, m - 2);
      if (rest >= 0) consider(rest + last, 0.1);
    }
    consider(alignSum(M, 0, n - 1, 0, m - 1), 0);
  }
  if (best < 0) return 0;

  const avg = bestSum / n;
  const coverage = n / m;
  return Math.min(1, avg * (0.4 + 0.4 * coverage) + bestBonus);
}

const CANDIDATE_MIN = 0.5; // أدنى درجة ليُعرض كاقتراح
const AUTO_MIN = 0.6;      // أدنى درجة للربط التلقائي
const AUTO_MARGIN = 0.12;  // الفارق المطلوب عن المرشّح الثاني

/**
 * يرتّب المعلّمين حسب قربهم من الاسم المكتوب.
 * teachers: [{id, name, tokens}]
 */
function rank(queryTokens, teachers, opts = {}) {
  const out = [];
  for (const t of teachers) {
    const score = scoreTokens(queryTokens, t.tokens, opts);
    if (score >= (opts.min ?? CANDIDATE_MIN)) out.push({ id: t.id, name: t.name, score });
  }
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ar'));
  return out;
}

/**
 * القرار: هل نربط الاسم تلقائياً بمعلّم واحد؟
 * يرجع {teacher, candidates, ambiguous}
 */
function decide(queryTokens, teachers) {
  const candidates = rank(queryTokens, teachers);
  if (!candidates.length) return { teacher: null, candidates, ambiguous: false };
  const [top, second] = candidates;
  const exactTies = candidates.filter((c) => c.score >= 0.999);
  if (exactTies.length === 1) return { teacher: top, candidates, ambiguous: false };
  if (exactTies.length > 1) return { teacher: null, candidates, ambiguous: true };
  if (top.score >= AUTO_MIN && (!second || top.score - second.score >= AUTO_MARGIN)) {
    return { teacher: top, candidates, ambiguous: false };
  }
  return { teacher: null, candidates, ambiguous: candidates.length > 1 };
}

/**
 * يجمّع الأسماء غير المعروفة (حين لا توجد قائمة معلّمين أو الاسم ليس فيها)
 * إلى مجموعات يُرجَّح أنها لنفس الشخص.
 * items: [{norm, raw, count}]  →  [{names:[...], count, ambiguous}]
 */
function cluster(items) {
  const withTokens = items.map((it) => ({ ...it, tokens: it.norm.split(' ').filter(Boolean) }));
  // الأسماء الأطول أولاً: هي "البذور" الأوضح
  withTokens.sort((a, b) => b.tokens.length - a.tokens.length || b.count - a.count);
  const groups = [];
  const loose = [];
  for (const it of withTokens) {
    const hits = groups.filter((g) => scoreTokens(it.tokens, g.seed.tokens) >= AUTO_MIN);
    if (hits.length === 1) {
      hits[0].names.push(it);
    } else if (hits.length === 0) {
      groups.push({ seed: it, names: [it], ambiguous: false });
    } else {
      loose.push({ seed: it, names: [it], ambiguous: true });
    }
  }
  return [...groups, ...loose]
    .map((g) => ({
      label: g.seed.raw,
      ambiguous: g.ambiguous,
      count: g.names.reduce((s, x) => s + x.count, 0),
      names: g.names
        .map((x) => ({ norm: x.norm, raw: x.raw, count: x.count }))
        .sort((a, b) => b.count - a.count),
      tokens: g.seed.tokens,
    }))
    .sort((a, b) => b.count - a.count);
}

module.exports = {
  normalizeChars, tokenize, normKey, core, editDistance, tokenSim,
  scoreTokens, rank, decide, cluster,
  CANDIDATE_MIN, AUTO_MIN, AUTO_MARGIN,
};
