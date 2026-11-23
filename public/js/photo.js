/* الصورة الجماعية: كل طالب شارك يقف بشخصيته التي اختارها في اللعبة، رافعاً كتابه،
   وعلى الكتاب نجمة واسم معلّمه المفضّل وكلمته تحتها. واحد طويل وواحد قصير كي تظهر الكتب كلها.
   تُحمَّل صورةً واحدة كبيرة (PNG) أو ملف PDF بصفحات. */
import { playerFrames, LOOKS, rng } from './pixel/art.js';
import { createScene } from './pixel/scene.js';
import { makePdf } from './pdf.js';

const $ = (id) => document.getElementById(id);
const INK = '#2a1f33', CREAM = '#fff6e6', GOLD = '#f6c453';
const COLORS = ['#c8453b', '#2f7fbf', '#3f9d6a', '#7a4fa3', '#e08a2e', '#1f8f8a', '#b0456e'];
const F_BODY = '"Plex Arabic", "Segoe UI", Tahoma, sans-serif';
const F_DISP = '"Kufi", "Plex Arabic", "Segoe UI", sans-serif';

/* المقاسات بالبكسل في الصورة النهائية */
const PW = 2000, COLS = 8, SP = PW / COLS;          // ٨ طلاب في الصف
const BOOK_W = 206, BOOK_MIN = 150, BOOK_MAX = 300;
const TALL = 4, SHORT = 3;                           // مضاعف حجم الشخصية: طويل وقصير
const SCENE_H = 800, GROUND0 = 704, ROW_H = 560;     // الصف الأول على شارع الخليج أمام الأبراج
const MAX_ROWS = 45;                                 // حدّ الصورة الواحدة (٣٦٠ طالباً)؛ الأكثر يُقسَّم أجزاءً

const people = (n) => (n === 1 ? 'مشارك واحد' : n === 2 ? 'مشاركان' : n <= 10 ? `${n} مشاركين` : `${n} مشاركاً`);
const today = () => new Date().toLocaleDateString('ar-KW', { year: 'numeric', month: 'long', day: 'numeric' });

/* ---------- لون الكتاب من المادة، والشخصية لمن لم يلعب اللعبة ---------- */
function hash(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; }
const bookColor = (subject) => (subject ? COLORS[hash(subject) % COLORS.length] : '#5a4266');
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function lookFor(it) {
  if (it.look) return it.look;
  const r = rng((it.id * 7919 + 13) % 2147483646 + 1);
  r(); r();
  const outfit = r() < 0.55 ? 'dishdasha' : 'hoodie';
  const head = LOOKS.head[Math.floor(r() * LOOKS.head.length)][0];
  const skin = LOOKS.skin[Math.floor(r() * LOOKS.skin.length)];
  const pool = outfit === 'dishdasha' ? ['#f6f4ee', '#d9c7a3', '#2c4766'] : ['#232027', '#2c4766', '#7a2f3a'];
  return { outfit, head, skin, color: pool[Math.floor(r() * pool.length)] };
}
const frameCache = new Map();
function raiseFrame(look) {
  const key = JSON.stringify(look);
  if (!frameCache.has(key)) frameCache.set(key, playerFrames(look)[6]);
  return frameCache.get(key);
}

/* ---------- الكتاب: نجمة، اسم المعلّم، وكلمة الطالب ---------- */
function wrap(g, text, maxW) {
  const lines = []; let line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${w}` : w;
    if (!line || g.measureText(t).width <= maxW) line = t; else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}
function layoutBook(g, it) {
  const inner = BOOK_W - 44;
  let nameSize = 26, nameLines = [];
  for (; nameSize >= 16; nameSize -= 2) { g.font = `600 ${nameSize}px ${F_DISP}`; nameLines = wrap(g, it.teacher, inner); if (nameLines.length <= 2) break; }
  const nameLH = Math.round(nameSize * 1.5);
  let h = 18 + 36 + 4 + nameLines.length * nameLH;
  let msg = null;
  const text = (it.reason || '').trim();
  if (text) {
    const avail = BOOK_MAX - h - 16 - 24;
    const rtl = /[\u0600-\u06FF]/.test(text), quoted = rtl ? `«${text}»` : `“${text}”`;   // رسالة بالإنجليزية تُكتب من اليسار
    for (let size = 20; size >= 12; size--) {
      g.font = `500 ${size}px ${F_BODY}`; g.direction = rtl ? 'rtl' : 'ltr';
      const lh = Math.round(size * 1.6), lines = wrap(g, quoted, inner);
      const max = Math.max(1, Math.floor(avail / lh));
      if (lines.length <= max || size === 12) {
        if (lines.length > max) { lines.length = max; lines[max - 1] = `${lines[max - 1].replace(/\s*\S+$/, '')}…${rtl ? '»' : '”'}`; }
        msg = { lines, size, lh, dir: rtl ? 'rtl' : 'ltr' }; break;
      }
    }
    h += 16 + msg.lines.length * msg.lh;
  }
  h += 24;
  return { h: Math.max(BOOK_MIN, Math.round(h)), nameLines, nameSize, nameLH, msg };
}
function star(g, cx, cy, r, fill) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.lineJoin = 'miter'; g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  g.fillStyle = fill; g.fill();
}
function drawBook(g, cx, bottom, it, L) {
  const w = BOOK_W, h = L.h, x = Math.round(cx - w / 2), y = Math.round(bottom - h), col = bookColor(it.subject);
  const face = w - 14, mid = x + face / 2;
  g.fillStyle = 'rgba(20,10,24,.35)'; g.fillRect(x + 9, y + 9, w, h);            // الظل
  g.fillStyle = INK; g.fillRect(x - 4, y - 4, w + 8, h + 8);                      // الإطار
  g.fillStyle = col; g.fillRect(x, y, w, h);                                       // الغلاف
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, y, face, 5);
  g.fillStyle = shade(col, -0.3); g.fillRect(x + face, y, 14, h);                 // الكعب
  g.fillStyle = INK; g.fillRect(x + face, y, 2, h);
  g.fillStyle = '#f3e7d3'; g.fillRect(x, y + h - 12, face, 12);                    // حافة الصفحات
  g.fillStyle = '#d8c7aa'; for (let k = 0; k < 3; k++) g.fillRect(x, y + h - 10 + k * 3, face, 1);
  star(g, mid, y + 18 + 17, 18, GOLD);
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = CREAM; g.font = `600 ${L.nameSize}px ${F_DISP}`;
  let ty = y + 18 + 36 + 4;
  for (const line of L.nameLines) { ty += L.nameLH; g.fillText(line, mid, ty - L.nameLH * 0.28); }
  if (L.msg) {
    ty += 6; g.fillStyle = 'rgba(255,246,230,.55)';
    for (let k = -2; k <= 2; k++) g.fillRect(Math.round(mid + k * 10 - 2), ty, 4, 4);   // نقاط فاصلة
    ty += 10;
    g.fillStyle = '#ffeedd'; g.font = `500 ${L.msg.size}px ${F_BODY}`; g.direction = L.msg.dir;
    for (const line of L.msg.lines) { ty += L.msg.lh; g.fillText(line, mid, ty - L.msg.lh * 0.3); }
  }
}

/* ---------- تاج أصحاب أعلى النقاط في التحدّي ---------- */
let crowns = new Map();
const RANKS = ['الأول', 'الثاني', 'الثالث'];
function crown(g, cx, bottom, rank, score) {
  const u = 6, x0 = Math.round(cx - 5.5 * u), y0 = bottom - 8 * u;
  const shape = (dx, dy, col) => {
    g.fillStyle = col;
    for (const c of [0, 4, 8]) { g.fillRect(x0 + dx + (c + 1) * u, y0 + dy, u, u); g.fillRect(x0 + dx + c * u, y0 + dy + u, 3 * u, 2 * u); }
    g.fillRect(x0 + dx, y0 + dy + 3 * u, 11 * u, 4 * u);
  };
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) shape(dx, dy, INK);
  shape(0, 0, rank === 1 ? GOLD : rank === 2 ? '#d8d2c4' : '#d9935a');
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x0, y0 + 3 * u, 11 * u, u);
  g.fillStyle = '#c8453b'; g.fillRect(x0 + 5 * u, y0 + 4 * u + 2, u, u);
  g.fillStyle = '#2f7fbf'; g.fillRect(x0 + 2 * u, y0 + 4 * u + 2, u, u); g.fillRect(x0 + 8 * u, y0 + 4 * u + 2, u, u);
  const text = `${RANKS[rank - 1]} · ${score} نقطة`;
  g.font = `600 22px ${F_DISP}`; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.lineWidth = 6; g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText(text, cx, y0 - 10);
  g.fillStyle = GOLD; g.fillText(text, cx, y0 - 10);
}

/* ---------- الطالب: الكتاب أولاً ثم الشخصية فتظهر اليدان ممسكتين بحافته ---------- */
function drawStudent(g, cx, ground, it, tall) {
  const K = tall ? TALL : SHORT, fr = raiseFrame(lookFor(it));
  const w = fr.width * K, h = fr.height * K, sx = Math.round(cx - w / 2), sy = ground - h;
  g.fillStyle = 'rgba(40,24,40,.35)'; g.fillRect(sx + 5 * K, ground - 2 * K, w - 10 * K, 3 * K);
  const L = layoutBook(g, it);
  drawBook(g, cx, sy + 2 * K, it, L);
  if (crowns.has(it.id)) crown(g, cx - 7, sy + 2 * K - L.h - 6, crowns.get(it.id), it.score);
  g.imageSmoothingEnabled = false;
  g.drawImage(fr, sx, sy, w, h);
}

/* ---------- الخلفية ---------- */
let sceneImg = null;
function sceneBand() {
  if (sceneImg) return sceneImg;
  const W = PW / 4, H = SCENE_H / 4, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  createScene(W, H).draw(g, 120, 0, 0);
  sceneImg = c;
  return c;
}
function tileBand(g, y) {
  const tiles = ['#efcfac', '#e6c19f'];
  g.fillStyle = '#7d6a76'; g.fillRect(0, y - 6, PW, 6);
  for (let x = 0, i = 0; x < PW; x += 48, i++) { g.fillStyle = tiles[i % 2]; g.fillRect(x, y, 48, 30); }
  g.fillStyle = '#c9a088'; for (let x = 0; x < PW; x += 48) g.fillRect(x, y, 2, 30);
  g.fillStyle = '#5d4d59'; g.fillRect(0, y + 30, PW, 6);
}
function banner(g, h, info, page) {
  g.fillStyle = INK; g.fillRect(0, 0, PW, h);
  g.fillStyle = GOLD; g.fillRect(0, h - 8, PW, 4);
  g.fillStyle = '#c8453b'; g.fillRect(0, h - 4, PW, 4);
  g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
  let size = page ? 52 : 68;
  g.font = `600 ${size}px ${F_DISP}`;
  while (g.measureText(info.title).width > PW * 0.62 && size > 30) { size -= 2; g.font = `600 ${size}px ${F_DISP}`; }
  const ty = Math.round(h * (page ? 0.52 : 0.5));
  g.fillStyle = '#c8453b'; g.fillText(info.title, PW - 56 + 4, ty + 4);
  g.fillStyle = CREAM; g.fillText(info.title, PW - 56, ty);
  g.font = `500 ${page ? 22 : 26}px ${F_BODY}`; g.fillStyle = '#d8c2c9';
  g.fillText(`${info.school ? `${info.school} · ` : ''}مبادرة معلّمي المفضّل`, PW - 56, ty + (page ? 38 : 50));
  g.textAlign = 'left';
  g.font = `600 ${page ? 30 : 36}px ${F_DISP}`; g.fillStyle = GOLD;
  g.fillText(people(info.count), 56, ty);
  g.font = `500 ${page ? 20 : 24}px ${F_BODY}`; g.fillStyle = '#d8c2c9';
  g.fillText(page ? `${today()} · صفحة ${page.n} من ${page.of}` : today(), 56, ty + (page ? 38 : 50));
}

/** ورقة: بانر، ثم المشهد والصف الأول على شارع الخليج، ثم بقية الصفوف كمدرّجات */
function sheet(rows, info, page) {
  const B = page ? 130 : 210;
  const tail = page ? 20 : 120;
  const height = page ? 1414 : B + GROUND0 + (rows.length - 1) * ROW_H + 36 + tail;
  const c = document.createElement('canvas'); c.width = PW; c.height = height;
  const g = c.getContext('2d');
  // خلفية الصفوف: غروب يميل إلى الليل
  const grad = g.createLinearGradient(0, B + SCENE_H, 0, height);
  grad.addColorStop(0, '#b86372'); grad.addColorStop(0.5, '#955671'); grad.addColorStop(1, '#5a4266');
  g.fillStyle = grad; g.fillRect(0, 0, PW, height);
  g.imageSmoothingEnabled = false;
  g.drawImage(sceneBand(), 0, B, PW, SCENE_H);
  banner(g, B, info, page);
  rows.forEach((row, r) => {
    const ground = B + GROUND0 + r * ROW_H;
    if (r > 0) tileBand(g, ground - 6);
    row.forEach((it, i) => {
      const cx = Math.round(PW / 2 + (i - (row.length - 1) / 2) * SP);
      drawStudent(g, cx, ground, it, (i + r) % 2 === 0);
    });
  });
  if (!page) {
    g.fillStyle = INK; g.fillRect(0, height - tail + 30, PW, tail - 30);
    g.direction = 'rtl'; g.textAlign = 'center'; g.font = `500 26px ${F_BODY}`; g.fillStyle = '#d8c2c9';
    g.fillText('كل كتاب كلمة طالب لمعلّمه المفضّل · المعلّم النجم', PW / 2, height - 36);
  }
  return c;
}
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/* ---------- الصفحة ---------- */
let data = null, current = { parts: [], items: [], info: null };
async function fontsReady() {
  await Promise.all([
    document.fonts.load(`600 30px ${F_DISP}`, 'نجمك'), document.fonts.load(`500 20px ${F_BODY}`, 'كلمة'),
  ]).catch(() => {});
}
function selection() {
  const tid = Number($('teacher').value) || 0, only = $('only-msg').checked;
  let items = data.items.filter((it) => (!tid || it.tid === tid) && (!only || it.reason.trim()));
  items = tid ? items : items.slice().sort((a, b) => a.teacher.localeCompare(b.teacher, 'ar') || a.id - b.id);
  const t = tid && data.items.find((it) => it.tid === tid);
  return { items, info: { title: t ? `طلاب أضاؤوا نجم ${t.teacher}` : 'المعلّم النجم', school: data.school, count: items.length } };
}
function render() {
  const { items, info } = selection();
  current = { items, info, parts: [] };
  // تاج لأعلى ثلاثة في نقاط التحدّي
  crowns = new Map(items.filter((it) => it.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map((it, i) => [it.id, i + 1]));
  const view = $('view'), parts = $('parts');
  parts.replaceChildren(); parts.hidden = true;
  if (!items.length) {
    view.replaceChildren(Object.assign(document.createElement('p'), { className: 'ph-empty', textContent: data.items.length ? 'لا يوجد طلاب بهذا الاختيار.' : 'لا توجد مشاركات بعد. ستظهر هنا صورة كل طالب يرشّح معلّمه من اللعبة.' }));
    $('note').textContent = ''; $('dl-png').disabled = $('dl-pdf').disabled = true;
    return;
  }
  const rows = chunk(items, COLS);
  current.parts = chunk(rows, MAX_ROWS).map((rs) => sheet(rs, info));
  view.replaceChildren(current.parts[0]);
  current.parts[0].setAttribute('aria-label', `الصورة الجماعية: ${people(items.length)}، كل واحد رافع كتابه وفيه اسم معلّمه وكلمته`);
  const pages = Math.ceil(rows.length / 2);
  $('note').textContent = `${people(items.length)} في ${rows.length === 1 ? 'صف واحد' : `${rows.length} صفوف`}. ملف PDF: ${pages === 1 ? 'صفحة واحدة' : `${pages} صفحات`}.`
    + (current.parts.length > 1 ? ` الصورة كبيرة فقُسّمت إلى ${current.parts.length} أجزاء.` : '');
  if (current.parts.length > 1) {
    parts.hidden = false;
    current.parts.forEach((c, i) => {
      const b = Object.assign(document.createElement('button'), { className: 'btn btn-sm', type: 'button', textContent: `اعرض الجزء ${i + 1}` });
      b.onclick = () => view.replaceChildren(c);
      parts.append(b);
    });
  }
  $('dl-png').disabled = $('dl-pdf').disabled = false;
}
function save(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
const fileBase = () => (Number($('teacher').value) ? `صورة-${current.items[0].teacher.replace(/\s+/g, '-')}` : 'الصورة-الجماعية');
$('dl-png').addEventListener('click', async () => {
  const btn = $('dl-png'); btn.disabled = true;
  for (let i = 0; i < current.parts.length; i++) {
    const blob = await new Promise((r) => current.parts[i].toBlob(r, 'image/png'));
    save(blob, `${fileBase()}${current.parts.length > 1 ? `-${i + 1}` : ''}.png`);
  }
  btn.disabled = false;
});
$('dl-pdf').addEventListener('click', async () => {
  const btn = $('dl-pdf'); btn.disabled = true; btn.textContent = 'جارٍ تجهيز PDF…';
  try {
    const pages = chunk(chunk(current.items, COLS), 2);
    const canvases = pages.map((rs, i) => sheet(rs, current.info, { n: i + 1, of: pages.length }));
    save(await makePdf(canvases), `${fileBase()}.pdf`);
  } finally { btn.disabled = false; btn.textContent = 'تحميل PDF'; }
});
$('teacher').addEventListener('change', render);
$('only-msg').addEventListener('change', render);

(async () => {
  const res = await fetch('/api/admin/photo').catch(() => null);
  if (!res || res.status === 401) {
    $('note').innerHTML = 'هذه الصفحة للمدير. <a class="link" href="/admin">سجّل الدخول من لوحة التحكم</a> ثم ارجع إليها.';
    return;
  }
  if (!res.ok) { $('note').textContent = 'تعذّر تحميل المشاركات. حدّث الصفحة وحاول مجدداً.'; return; }
  data = await res.json();
  if (data.school) $('school').textContent = data.school;
  const counts = new Map();
  for (const it of data.items) counts.set(it.tid, { name: it.teacher, n: (counts.get(it.tid)?.n || 0) + 1 });
  $('teacher').options[0].textContent = `كل الطلاب (${data.items.length})`;
  for (const [id, t] of [...counts].sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name, 'ar'))) {
    $('teacher').append(new Option(`${t.name} (${t.n})`, id));
  }
  await fontsReady();
  render();
})();
