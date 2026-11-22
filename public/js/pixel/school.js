/* فنّ البكسل للمدرسة: الواجهة على الكورنيش، الممرّ وأبواب الفصول، الفصل والسبّورة، البطاقات، وأبواب الأكشاك المعدنية.
   كل شيء مرسوم بالكود بدقّة منخفضة، بنفس ألوان الغروب. */
import { canvas, kuwaitTowers, rng } from './art.js';

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const SAND = ['#f2dcb2', '#e6c896', '#d6b37f', '#bf9a66', '#a5835a'];
const TEAL = ['#7cc7bf', '#3f9f98', '#2b807d', '#1f5f60'];
const WOOD = ['#b98a5a', '#9a6a44', '#83573a', '#5f3f2c'];
const INK = '#2a1f33';

/** مستطيل بوحدات u */
const box = (g, u) => (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x * u), Math.round(y * u), Math.round(w * u), Math.round(h * u)); };
/** تدرّج متقطّع رأسي بين لونين داخل مستطيل (بالبكسل) */
function dither(g, x, y, w, h, a, b, from = 0, to = 1) {
  for (let j = 0; j < h; j++) {
    const k = from + (to - from) * (j / Math.max(1, h - 1));
    for (let i = 0; i < w; i++) { g.fillStyle = k * 16 > BAYER[(y + j) & 3][(x + i) & 3] ? b : a; g.fillRect(x + i, y + j, 1, 1); }
  }
}
/** منظر الغروب من النافذة مع أبراج الكويت صغيرة */
let towersCache = null;
function sunsetView(g, x, y, w, h) {
  const bands = ['#f7cc8a', '#f0a263', '#e68a62', '#d47469', '#b86372'];
  for (let j = 0; j < h; j++) {
    const t = (j / h) * (bands.length - 1), i = Math.min(bands.length - 2, Math.floor(t));
    for (let k = 0; k < w; k++) { g.fillStyle = (t - i) * 16 > BAYER[j & 3][k & 3] ? bands[i + 1] : bands[i]; g.fillRect(x + k, y + j, 1, 1); }
  }
  g.fillStyle = '#f8dca6'; const r = Math.max(2, Math.round(w * 0.14)); g.fillRect(x + Math.round(w * 0.25) - r, y + Math.round(h * 0.62) - r, r * 2, r * 2);
  if (!towersCache) towersCache = kuwaitTowers(422);
  const th = Math.round(h * 0.78), tw = Math.round((towersCache.width * th) / towersCache.height);
  g.save(); g.globalAlpha = 0.55; g.drawImage(towersCache, x + w - tw + Math.round(tw * 0.08), y + h - th, tw, th); g.restore();
  g.fillStyle = '#8c6884'; g.fillRect(x, y + h - Math.max(2, Math.round(h * 0.1)), w, Math.max(2, Math.round(h * 0.1)));
}

/* ---------- واجهة المدرسة على الكورنيش (٨٤×٩٠ وحدة) ---------- */
export function schoolFacade(H) {
  const u = Math.max(1, Math.round(H / 260)), [c, g] = canvas(84 * u, 90 * u), B = box(g, u);
  // الجناحان
  B(2, 30, 80, 60, SAND[1]); B(2, 30, 80, 2, SAND[0]); B(2, 30, 2, 60, SAND[0]); B(78, 30, 4, 60, SAND[2]);
  for (let x = 2; x < 82; x += 6) { B(x, 27, 4, 3, SAND[1]); B(x, 27, 4, 1, SAND[0]); }          // شرفات السطح
  B(2, 56, 80, 2, SAND[3]); B(2, 82, 80, 8, SAND[3]); B(2, 82, 80, 1, SAND[2]);                  // حزام وقاعدة
  // المدخل الأوسط الأعلى
  B(27, 16, 30, 74, SAND[0]); B(55, 16, 2, 74, SAND[2]);
  for (let x = 27; x < 57; x += 5) { B(x, 13, 3, 3, SAND[0]); }
  // العلم على السارية
  B(41, 0, 1, 13, '#d8d2c4');
  B(42, 1, 12, 3, '#1f7a3c'); B(42, 4, 12, 3, '#f6f4ee'); B(42, 7, 12, 3, '#c8323a');
  for (let y = 0; y < 9; y++) { const wdt = y < 3 ? (y + 1) * 1.2 : y < 6 ? 4 : (9 - y) * 1.2; B(42, 1 + y, wdt, 1, '#1b1b1b'); }
  // الساعة
  B(38, 18, 8, 8, INK); B(39, 19, 6, 6, '#f6f4ee'); B(41.5, 20, 1, 3, INK); B(42, 22, 2, 1, INK);
  // لوحة الاسم (الاسم نفسه يُكتب فوقها بخط حادّ)
  B(22, 30, 40, 10, INK); B(23, 31, 38, 8, '#f6efe0'); B(23, 38, 38, 1, '#d6c7aa');
  // بوابة مقوّسة مكسوّة بالقاشاني
  B(33, 50, 18, 36, TEAL[2]); B(35, 47, 14, 3, TEAL[2]); B(38, 45, 8, 2, TEAL[2]); B(40, 43, 4, 2, TEAL[2]);
  for (let y = 51; y < 86; y += 3) { B(33, y, 2, 1, TEAL[0]); B(49, y + 1, 2, 1, TEAL[0]); }
  B(35, 52, 14, 34, '#23434f'); B(37, 49, 10, 3, '#23434f'); B(39, 47, 6, 2, '#23434f');
  B(36, 56, 5, 14, '#5f8fa6'); B(43, 56, 5, 14, '#5f8fa6'); B(36, 56, 5, 2, '#9cc3cf'); B(43, 56, 5, 2, '#9cc3cf');
  B(41.5, 52, 1, 34, '#152e37'); B(40, 72, 1, 3, '#e9b44c'); B(43, 72, 1, 3, '#e9b44c');
  B(29, 86, 26, 2, SAND[0]); B(27, 88, 30, 2, SAND[2]);                                           // الدرج
  // النوافذ مع مظلّات المشربية
  const win = (x, y) => {
    B(x - 1, y - 1, 9, 12, SAND[3]);
    const X = Math.round(x * u), Y = Math.round(y * u), Wd = Math.round(7 * u), Hd = Math.round(10 * u);
    dither(g, X, Y, Wd, Hd, '#f3a86b', '#8c6a98', 0, 1);
    B(x + 3, y, 1, 10, SAND[0]); B(x, y + 4, 7, 1, SAND[0]);
    for (let i = 0; i < 9; i += 2) B(x - 1 + i, y - 3, 1, 2, WOOD[2]);
    B(x - 1, y - 3, 9, 1, WOOD[1]);
  };
  for (const y of [42, 63]) for (const x of [6, 16, 61, 71]) win(x, y);
  // ملمس الجدار
  const r = rng(77); g.fillStyle = '#00000014';
  for (let i = 0; i < 160 * u; i++) g.fillRect(Math.round(r() * 84 * u), Math.round(30 * u + r() * 52 * u), 1, 1);
  return { img: c, u, sign: { x: 42 * u, y: 40 * u } };
}

/* ---------- الباب المعدني للكشك: يغطّي نافذة البيع حتى تُسلَّم البطاقات ---------- */
export function shutter(H) {
  const u = Math.max(1, Math.round(H / 260)), [c, g] = canvas(34 * u, 13 * u), B = box(g, u);
  for (let y = 0; y < 13; y++) B(0, y, 34, 1, y % 2 ? '#7d8391' : '#a7adb9');
  B(0, 11, 34, 2, '#5d6270');
  B(15, 6, 4, 4, '#e9b44c'); B(16, 4, 2, 2, '#5d6270'); B(16.5, 7.5, 1, 1.5, INK);                // القفل
  return { img: c, x: 6 * u, y: 17 * u };
}

/* ---------- البطاقة: ذهبية للإجابة الصحيحة، وبيضاء بلون المادة لغيرها ---------- */
export function cardSprite(K, gold, color = '#2f7fbf') {
  const w = 6 * K + 2, h = 8 * K + 2, [c, g] = canvas(w + 1, h + 1);
  g.fillStyle = '#0006'; g.fillRect(1, 1, w, h);
  g.fillStyle = INK; g.fillRect(0, 0, w, h);
  g.fillStyle = gold ? '#e9b44c' : '#f3e7d3'; g.fillRect(1, 1, w - 2, h - 2);
  if (gold) {
    g.fillStyle = '#f6d79a'; g.fillRect(1, 1, w - 2, K);
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2), s = Math.max(1, K);
    g.fillStyle = '#fffaf0'; g.fillRect(cx - s, cy - s * 2, s * 2, s * 4); g.fillRect(cx - s * 2, cy - s, s * 4, s * 2);
  } else {
    g.fillStyle = color; g.fillRect(1, 1, w - 2, 2 * K);
    g.fillStyle = '#b8a890'; for (let i = 0; i < 3; i++) g.fillRect(1 + K, 3 * K + 2 + i * 2 * K, w - 2 - 2 * K, Math.max(1, Math.round(K / 2)));
  }
  return c;
}

/* ---------- ممرّ المدرسة: مقطع يتكرّر، وأبواب الفصول فوقه ---------- */
export function createCorridor(W, H, gap) {
  const fy = Math.round(H * 0.8), ceil = Math.round(H * 0.07), rail = fy - Math.round(H * 0.17);
  const dw = Math.round(H * 0.15), dh = Math.round(H * 0.32);
  // المقطع الثابت
  const [seg, g] = canvas(gap, H);
  dither(g, 0, ceil, gap, rail - ceil, '#f1e6cc', '#e2cfa8', 0, 1);
  g.fillStyle = '#b9a27c'; g.fillRect(0, 0, gap, ceil); g.fillStyle = '#a58d68'; g.fillRect(0, ceil - 2, gap, 2);
  g.fillStyle = '#fffbe8'; g.fillRect(Math.round(gap * 0.25) - 12, ceil - 4, 24, 3); g.fillRect(Math.round(gap * 0.75) - 12, ceil - 4, 24, 3);   // مصابيح
  g.fillStyle = TEAL[2]; g.fillRect(0, rail, gap, fy - rail); g.fillStyle = TEAL[1];
  for (let x = 0; x < gap; x += 8) g.fillRect(x, rail + 4, 4, fy - rail - 8);
  g.fillStyle = '#f3e7d3'; g.fillRect(0, rail - 2, gap, 3); g.fillStyle = TEAL[3]; g.fillRect(0, fy - 4, gap, 4);
  // الأرضية: بلاط متناوب
  for (let y = fy, row = 0; y < H; y += 7, row++) for (let x = -(row % 2) * 9; x < gap; x += 18) {
    g.fillStyle = '#d9c49a'; g.fillRect(x, y, 9, 7); g.fillStyle = '#c9b083'; g.fillRect(x + 9, y, 9, 7);
  }
  g.fillStyle = '#00000022'; g.fillRect(0, fy, gap, 3);
  // خزائن على يمين الباب ولوحة إعلانات في الوسط (يغطّيها الباب إن وُجد)
  const mid = Math.round(gap / 2), left = mid - Math.round(dw / 2) - 8;
  const lockW = 13, lockH = Math.round(H * 0.27), nLock = Math.min(6, Math.max(1, Math.floor((left - 10) / lockW)));
  for (let i = 0; i < nLock; i++) {
    const x = left - (i + 1) * lockW, y = fy - lockH, col = i % 3 === 2 ? '#c8453b' : '#2f6fa8';
    g.fillStyle = '#1d2b3e'; g.fillRect(x, y, lockW, lockH);
    g.fillStyle = col; g.fillRect(x + 1, y + 1, lockW - 2, lockH - 2);
    g.fillStyle = '#ffffff30'; g.fillRect(x + 1, y + 1, 2, lockH - 2);
    g.fillStyle = '#00000040'; for (let v = 0; v < 3; v++) g.fillRect(x + 4, y + 6 + v * 3, lockW - 8, 1);
    g.fillStyle = '#d8d2c4'; g.fillRect(x + lockW - 4, y + Math.round(lockH * 0.5), 1, 4);
  }
  const bw = Math.round(dw * 1.1), bh = Math.round(H * 0.12), by = rail - bh - Math.round(H * 0.12);
  g.fillStyle = WOOD[2]; g.fillRect(mid - bw / 2, by, bw, bh); g.fillStyle = '#c8955c'; g.fillRect(mid - bw / 2 + 2, by + 2, bw - 4, bh - 4);
  const r = rng(5); for (let i = 0; i < 5; i++) { g.fillStyle = ['#f6f4ee', '#f6d79a', '#a9dccf', '#ef8f6a'][i % 4]; g.fillRect(Math.round(mid - bw / 2 + 4 + r() * (bw - 14)), Math.round(by + 4 + r() * (bh - 12)), 7, 8); }
  // نافذة على الغروب
  const right0 = mid + Math.round(dw / 2) + 10, ww = Math.max(16, Math.min(gap - right0 - 10, Math.round(H * 0.2))), wx = right0 + Math.round((gap - 10 - right0 - ww) / 2);
  const wy = ceil + Math.round(H * 0.1), wh = Math.round(H * 0.3);
  g.fillStyle = '#f3e7d3'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
  sunsetView(g, wx, wy, ww, wh);
  g.fillStyle = '#f3e7d3'; g.fillRect(wx + Math.round(ww / 2) - 1, wy, 2, wh); g.fillRect(wx, wy + Math.round(wh * 0.45), ww, 2);
  g.fillStyle = '#d6c7aa'; g.fillRect(wx - 4, wy + wh + 3, ww + 8, 2);
  g.fillStyle = 'rgba(255,236,190,0.16)';                                                       // ضوء النافذة على البلاط
  for (let y = fy; y < H; y++) { const k = (y - fy) / (H - fy); g.fillRect(Math.round(wx - k * 30), y, ww, 1); }

  /** باب فصل: لون المادة شريط فوقه. exit: باب الخروج الأخضر */
  function door(color, exit) {
    const [c, d] = canvas(dw + 8, dh + 6);
    d.fillStyle = WOOD[3]; d.fillRect(0, 0, dw + 8, dh + 6);
    d.fillStyle = color; d.fillRect(0, 0, dw + 8, 4);
    d.fillStyle = exit ? '#2f8f4e' : WOOD[1]; d.fillRect(4, 6, dw, dh);
    d.fillStyle = exit ? '#3fa862' : WOOD[0]; d.fillRect(4, 6, 3, dh);
    d.fillStyle = '#00000025'; for (let y = 12; y < dh; y += 9) d.fillRect(8, 6 + y, dw - 8, 1);
    d.fillStyle = INK; d.fillRect(Math.round(dw * 0.3), 14, Math.round(dw * 0.45), Math.round(dh * 0.26));
    d.fillStyle = exit ? '#cfeedd' : '#bfe0e8'; d.fillRect(Math.round(dw * 0.3) + 2, 16, Math.round(dw * 0.45) - 4, Math.round(dh * 0.26) - 4);
    d.fillStyle = '#ffffff70'; d.fillRect(Math.round(dw * 0.3) + 3, 17, 2, Math.round(dh * 0.18));
    d.fillStyle = '#e9b44c'; d.fillRect(dw - 6, Math.round(dh * 0.55), 4, 3);
    return c;
  }
  return { seg, fy, dw, dh, door };
}

/* ---------- الفصل: سبّورة في الوسط، مكتب المعلّم، والمقاعد في الأمام ---------- */
export function createClassroom(W, H) {
  const [c, g] = canvas(W, H);
  const fy = Math.round(H * 0.66), rail = fy - Math.round(H * 0.1);
  dither(g, 0, 0, W, rail, '#f1e6cc', '#e2cfa8', 0, 1);
  g.fillStyle = TEAL[2]; g.fillRect(0, rail, W, fy - rail); g.fillStyle = '#f3e7d3'; g.fillRect(0, rail - 2, W, 3); g.fillStyle = TEAL[3]; g.fillRect(0, fy - 3, W, 3);
  for (let y = fy, row = 0; y < H; y += 8, row++) for (let x = -(row % 2) * 10; x < W; x += 20) {
    g.fillStyle = '#d9c49a'; g.fillRect(x, y, 10, 8); g.fillStyle = '#c9b083'; g.fillRect(x + 10, y, 10, 8);
  }
  g.fillStyle = '#00000022'; g.fillRect(0, fy, W, 3);
  // السبّورة
  const bw = Math.min(Math.round(W * 0.86), 320), bh = Math.round(Math.min(H * 0.3, bw * 0.6)), bx = Math.round((W - bw) / 2), by = Math.round(H * 0.12);
  g.fillStyle = WOOD[2]; g.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
  g.fillStyle = WOOD[1]; g.fillRect(bx - 4, by - 4, bw + 8, 2);
  dither(g, bx, by, bw, bh, '#2f5d4a', '#3a6b55', 0.15, 0.45);
  g.fillStyle = WOOD[1]; g.fillRect(bx - 6, by + bh + 4, bw + 12, 3);
  g.fillStyle = '#f6f4ee'; g.fillRect(bx + 10, by + bh + 2, 6, 2); g.fillStyle = '#f6d79a'; g.fillRect(bx + 20, by + bh + 2, 5, 2);
  // ساعة ونافذة إن اتّسع الجدار
  if (bx > 60) {
    const ww = Math.min(bx - 30, 90), wx = Math.round((bx - ww) / 2), wh = Math.round(H * 0.3), wy = by;
    g.fillStyle = '#f3e7d3'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
    sunsetView(g, wx, wy, ww, wh);
    g.fillStyle = '#f3e7d3'; g.fillRect(wx + Math.round(ww / 2) - 1, wy, 2, wh);
    const cx = bx + bw + Math.round((W - bx - bw) / 2);
    g.fillStyle = INK; g.fillRect(cx - 8, by, 16, 16); g.fillStyle = '#f6f4ee'; g.fillRect(cx - 7, by + 1, 14, 14);
    g.fillStyle = INK; g.fillRect(cx, by + 3, 1, 6); g.fillRect(cx, by + 8, 4, 1);
  }
  // مكتب المعلّم وعليه كرة أرضية وكتب
  const tw = Math.max(44, Math.round(W * 0.2)), tx = Math.round(W * 0.92) - tw, th = Math.round(H * 0.09), ty = fy - th + 4;
  g.fillStyle = WOOD[3]; g.fillRect(tx, ty, tw, th);
  g.fillStyle = WOOD[1]; g.fillRect(tx - 2, ty - 3, tw + 4, 4);
  g.fillStyle = WOOD[2]; g.fillRect(tx + 4, ty + 4, Math.round(tw * 0.35), th - 8);
  g.fillStyle = '#e9b44c'; g.fillRect(tx + 4 + Math.round(tw * 0.17), ty + 8, 3, 2);
  const gx = tx + tw - 12, gy = ty - 13;
  g.fillStyle = '#7d6a76'; g.fillRect(gx + 3, gy + 9, 2, 4); g.fillRect(gx, gy + 12, 8, 1);
  g.fillStyle = '#2f7fbf'; g.fillRect(gx, gy, 8, 9); g.fillStyle = '#3f9d6a'; g.fillRect(gx + 1, gy + 2, 3, 3); g.fillRect(gx + 5, gy + 5, 2, 2);
  for (let i = 0; i < 3; i++) { g.fillStyle = ['#c8453b', '#2f6fa8', '#e9b44c'][i]; g.fillRect(tx + 6, ty - 5 - i * 3, 14 - i * 2, 3); }
  // مقاعد الطلاب في المقدّمة
  const deskY = Math.round(H * 0.86), step = Math.max(64, Math.round(W * 0.28));
  for (let x = Math.round(step * 0.3); x < W; x += step) {
    g.fillStyle = '#00000025'; g.fillRect(x + 2, deskY + 16, 40, 3);
    g.fillStyle = WOOD[3]; g.fillRect(x + 3, deskY + 4, 2, 14); g.fillRect(x + 37, deskY + 4, 2, 14);
    g.fillStyle = WOOD[0]; g.fillRect(x, deskY, 42, 5); g.fillStyle = '#cfa070'; g.fillRect(x, deskY, 42, 1);
    g.fillStyle = '#2f6fa8'; g.fillRect(x + 12, deskY + 8, 18, 3); g.fillRect(x + 12, deskY - 8, 3, 16);
  }
  return { img: c, fy, board: { x: bx, y: by, w: bw, h: bh } };
}
