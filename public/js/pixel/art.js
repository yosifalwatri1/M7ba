/* فنّ البكسل: كل شيء مرسوم بالكود بدقّة منخفضة ثم يُكبَّر بكسلاً بكسلاً.
   غروب الكويت: أبراج الكويت، برج التحرير، برج مائل، مدينة، نخيل، وكورنيش مبلّط. */

export const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

export function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  return [c, g];
}
const px = (g, x, y, w = 1, h = 1) => g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));

/* دائرة بكسل مظلّلة: الضوء من أعلى اليسار (غروب الشمس خلفها) */
function ball(g, cx, cy, r, shade) {
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.4));
    for (let x = -w; x <= w; x++) { g.fillStyle = shade(x / r, y / r, x, y); px(g, cx + x, cy + y); }
  }
}

/* ---------- الألوان ---------- */
export const PAL = {
  sky: ['#5a4266', '#744b70', '#955671', '#b86372', '#d47469', '#e68a62', '#f0a263', '#f5ba76', '#f7cc8a'],
  sun: '#f8dca6', sunRing: '#f3c98e',
  cloud: ['#b25f6a', '#d9786b', '#ee9a73', '#f7b986'],
  far: '#c78886', far2: '#b77a80',
  mid: ['#8c6884', '#7c5c7c', '#a07a8e', '#94708a'], window: '#cfa4b2', windowLit: '#f6d79a',
  shaft: ['#fff1d8', '#f0dfc4', '#d4bb9c', '#b99f86'],
  teal: ['#a9dccf', '#7cbdb2', '#4f9a98', '#3a7f82', '#2a6266', '#1f4a50'],
  hamra: ['#3f3466', '#4e4180', '#7b6db0', '#b8aee0'],
  palm: '#3a2638', palm2: '#4a3045', hedge: ['#3f2b3e', '#4c3548', '#5d4257'],
  curb: ['#9c8590', '#7d6a76', '#5d4d59'], tile: ['#efcfac', '#e6c19f', '#c9a088'], ground: ['#4a3846', '#3a2d3a', '#2c222d'],
};

/* ---------- السماء: تدرّج غروب متقطّع بالبكسل ---------- */
export function drawSky(g, W, H) {
  const bands = PAL.sky, horizon = H * 0.72;
  for (let y = 0; y < horizon; y++) {
    const t = (y / horizon) * (bands.length - 1), i = Math.min(bands.length - 2, Math.floor(t)), f = t - i;
    for (let x = 0; x < W; x += 1) {
      const thr = (BAYER[y & 3][x & 3] + 0.5) / 16;
      g.fillStyle = f > thr ? bands[i + 1] : bands[i];
      px(g, x, y);
    }
  }
  g.fillStyle = bands[bands.length - 1]; px(g, 0, horizon, W, H - horizon);
}

export function drawSun(g, cx, cy, r) {
  ball(g, cx, cy, r + 3, () => PAL.sunRing);
  ball(g, cx, cy, r, (x, y) => (y < -0.55 ? '#fbe8bd' : PAL.sun));
}

export function cloud(seed, w) {
  const r = rng(seed), [c, g] = canvas(w + 8, w * 0.42 + 8);
  const blobs = Array.from({ length: 6 }, (_, i) => ({ x: 6 + (i / 5) * (w - 12) + r() * 6, y: w * 0.2 + r() * w * 0.06, rr: w * (0.08 + r() * 0.1) }));
  for (const layer of [0, 1, 2, 3]) {
    for (const b of blobs) {
      const rr = Math.round(b.rr - layer * 1.6);
      if (rr <= 0) continue;
      g.fillStyle = PAL.cloud[layer];
      for (let y = -rr; y <= rr; y++) { const ww = Math.floor(Math.sqrt(rr * rr - y * y)); px(g, b.x - ww, b.y + y - layer * 1.4, ww * 2 + 1, 1); }
    }
  }
  // قاع مسطّح للغيمة
  g.clearRect(0, Math.round(w * 0.2 + w * 0.12), c.width, c.height);
  return c;
}

/* ---------- أبراج الكويت ---------- */
export function kuwaitTowers(H) {
  const u = H / 422, w = Math.round(150 * u), h = Math.round(H * 0.6);
  const [c, g] = canvas(w, h);
  const base = h - 1;
  const shaft = (cx, top, wb, wt) => {
    for (let y = top; y <= base; y++) {
      const k = (y - top) / (base - top), hw = (wt + (wb - wt) * k) / 2;
      for (let x = Math.floor(-hw); x <= Math.ceil(hw); x++) {
        const s = (x + hw) / (2 * hw);
        g.fillStyle = s < 0.25 ? PAL.shaft[0] : s < 0.62 ? PAL.shaft[1] : s < 0.85 ? PAL.shaft[2] : PAL.shaft[3];
        px(g, cx + x, y);
      }
    }
  };
  const spire = (cx, top, bottom, wdt) => { for (let y = top; y < bottom; y++) { const hw = Math.max(0.5, ((y - top) / (bottom - top)) * wdt / 2); g.fillStyle = y % 7 < 1 ? PAL.shaft[2] : PAL.shaft[1]; px(g, cx - hw, y, Math.max(1, hw * 2), 1); } };
  const sphere = (cx, cy, r, ring) => {
    ball(g, cx, cy, r + 1, () => PAL.teal[5]);
    ball(g, cx, cy, r, (nx, ny, x, y) => {
      const light = -nx * 0.6 - ny * 0.7, check = ((x + y) & 1) === 0 && ((Math.floor(y / 2) + x) % 3 === 0);
      let i = light > 0.55 ? 1 : light > 0.15 ? 2 : light > -0.35 ? 3 : 4;
      if (check) i = Math.min(5, i + 1);
      if (light > 0.75 && nx * nx + ny * ny > 0.35) i = 0;
      return PAL.teal[i];
    });
    if (ring) {                                                      // حلقة المطعم الدوّار
      const ry = Math.round(cy - r * 0.18);
      g.fillStyle = PAL.shaft[3]; px(g, cx - r * 1.16, ry - 2, r * 2.32 + 1, 5);
      g.fillStyle = PAL.shaft[1]; px(g, cx - r * 1.16, ry - 3, r * 2.32 + 1, 2);
      g.fillStyle = '#4a3a4a'; for (let x = -r * 1.1; x < r * 1.1; x += 3) px(g, cx + x, ry, 2, 2);
    }
  };
  const X = Math.round(w * 0.62), u2 = (v) => Math.round(v * u);
  // البرج الثالث: إبرة
  spire(X - u2(78), Math.round(h * 0.25), Math.round(h * 0.48), u2(5)); shaft(X - u2(78), Math.round(h * 0.48), u2(6), u2(3));
  // البرج الثاني: كرة واحدة
  spire(X - u2(48), Math.round(h * 0.17), Math.round(h * 0.4), u2(6)); shaft(X - u2(48), Math.round(h * 0.4), u2(9), u2(5));
  sphere(X - u2(48), Math.round(h * 0.46), u2(19));
  // البرج الرئيسي: كرتان وحلقة
  spire(X, 0, Math.round(h * 0.2), u2(8)); shaft(X, Math.round(h * 0.2), u2(13), u2(6));
  sphere(X, Math.round(h * 0.25), u2(12));
  sphere(X, Math.round(h * 0.4), u2(27), true);
  return c;
}

/* ---------- برج التحرير ---------- */
export function liberationTower(H) {
  const u = H / 422, w = Math.round(46 * u), h = Math.round(H * 0.62), [c, g] = canvas(w, h), cx = w / 2;
  const prof = [[1, 0.5], [0.4, 0.5], [0.33, 2.2], [0.3, 6], [0.27, 9], [0.25, 7], [0.22, 4.5], [0.2, 3.4], [0, 3]];
  for (let y = 0; y < h; y++) {
    const k = y / h;
    let hw = 1;
    if (k < 0.12) hw = 0.6; else if (k < 0.2) hw = 2.4; else if (k < 0.24) hw = 4.5; else if (k < 0.29) hw = 9; else if (k < 0.32) hw = 7; else hw = 4 + (k - 0.32) * 12;
    hw *= u;
    for (let x = -hw; x <= hw; x++) { const s = (x + hw) / (2 * hw); g.fillStyle = s < 0.35 ? '#9a7fa3' : s < 0.7 ? '#806690' : '#69537a'; px(g, cx + x, y); }
    if (k > 0.25 && k < 0.29 && y % 2 === 0) { g.fillStyle = PAL.windowLit; for (let x = -hw + 2; x < hw - 1; x += 3) px(g, cx + x, y); }
  }
  void prof;
  g.fillStyle = '#ff5c5c'; px(g, cx - 1, 0, 2, 2);
  return c;
}

/* ---------- برج مائل حديث (كما في الصورة) ---------- */
export function curvedTower(H) {
  const u = H / 422, w = Math.round(64 * u), h = Math.round(H * 0.52), [c, g] = canvas(w, h);
  for (let y = 0; y < h; y++) {
    const k = y / h, left = Math.round(w * 0.1 + (1 - Math.pow(1 - k, 2)) * 0) , right = Math.round(w * 0.92 - Math.max(0, 0.35 - k) * w * 1.6);
    for (let x = left; x < right; x++) {
      const s = (x - left) / Math.max(1, right - left);
      g.fillStyle = s < 0.08 ? PAL.hamra[3] : s < 0.55 ? PAL.hamra[1] : PAL.hamra[0];
      px(g, x, y);
    }
    if (y % 4 === 1 && k > 0.06) { for (let x = left + 3; x < right - 2; x += 4) { g.fillStyle = Math.sin(x * 7 + y * 3) > 0.6 ? PAL.windowLit : PAL.hamra[2]; px(g, x, y, 2, 1); } }
  }
  g.fillStyle = PAL.hamra[3]; px(g, w * 0.1, h * 0.02, 1, h);             // حافة مضيئة
  g.fillStyle = PAL.hamra[0]; px(g, w * 0.16, -1, 1, h * 0.06);
  return c;
}

/* ---------- شريط مدينة يتكرّر (بعيد أو متوسط) ---------- */
export function cityStrip(seed, W, H, kind) {
  const r = rng(seed), [c, g] = canvas(W, H);
  let x = 0;
  while (x < W) {
    const bw = Math.round((kind === 'far' ? 10 : 16) + r() * (kind === 'far' ? 22 : 34));
    const bh = Math.round(H * (kind === 'far' ? 0.25 + r() * 0.55 : 0.3 + r() * 0.7));
    const col = kind === 'far' ? (r() > 0.5 ? PAL.far : PAL.far2) : PAL.mid[Math.floor(r() * PAL.mid.length)];
    g.fillStyle = col; px(g, x, H - bh, bw, bh);
    if (kind === 'mid') {
      g.fillStyle = 'rgba(255,255,255,0.08)'; px(g, x, H - bh, 2, bh);
      g.fillStyle = 'rgba(0,0,0,0.12)'; px(g, x + bw - 3, H - bh, 3, bh);
      for (let wy = H - bh + 4; wy < H - 4; wy += 5) for (let wx = x + 4; wx < x + bw - 4; wx += 5) {
        g.fillStyle = r() > 0.9 ? PAL.windowLit : PAL.window; px(g, wx, wy, 2, 2);
      }
      if (r() > 0.8) { g.fillStyle = col; px(g, x + bw / 2, H - bh - 8, 1, 8); }        // هوائي
      if (r() > 0.86 && bw > 24) {                                         // مسجد: قبّة ومئذنة
        const cx = x + bw / 2, dr = Math.round(bw * 0.32);
        ball(g, cx, H - bh, dr, (nx, ny) => (ny > 0 ? 'rgba(0,0,0,0)' : nx < -0.2 ? '#c49aa6' : '#a57f8f'));
        g.fillStyle = '#a57f8f'; px(g, x + bw - 5, H - bh - 26, 4, 26); px(g, x + bw - 6, H - bh - 28, 6, 3); px(g, x + bw - 4, H - bh - 33, 2, 5);
      }
    } else {
      for (let wy = H - bh + 3; wy < H - 2; wy += 4) for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (r() > 0.75) { g.fillStyle = '#d9a19a'; px(g, wx, wy, 1, 1); }
    }
    x += bw + Math.round(r() * (kind === 'far' ? 2 : 6));
  }
  return c;
}

/* ---------- نخيل وشجيرات ---------- */
export function palm(seed, H) {
  const r = rng(seed), u = H / 422, h = Math.round((175 + r() * 85) * u), w = Math.round(150 * u), [c, g] = canvas(w, h);
  const top = Math.round(34 * u), cx = w / 2, lean = (r() - 0.5) * 26 * u;
  const trunkX = (y) => cx + lean * Math.pow((y - top) / (h - top), 2) - lean;      // جذع منحنٍ قليلاً
  for (let y = top; y < h; y++) {
    const tw = Math.max(3, Math.round((3 + ((y - top) / (h - top)) * 2.5) * u));
    g.fillStyle = (y + Math.round(seed)) % 5 === 0 ? PAL.palm2 : PAL.palm; px(g, trunkX(y) - tw / 2, y, tw, 1);
  }
  const tx = trunkX(top);
  const fronds = 11;
  for (let f = 0; f < fronds; f++) {
    const a = -Math.PI * 0.98 + (f / (fronds - 1)) * Math.PI * 0.96 + (r() - 0.5) * 0.12;
    const len = (44 + r() * 22) * u;
    for (let s2 = 0; s2 < len; s2++) {
      const k = s2 / len;
      const x = tx + Math.cos(a) * s2 * 1.05, y = top + Math.sin(a) * s2 * 0.62 + k * k * len * 0.85;
      const th = Math.max(1, Math.round((2.6 - k * 1.8) * u));
      g.fillStyle = Math.sin(a) < -0.6 ? PAL.palm2 : PAL.palm; px(g, x, y, th, th);
      if (s2 % 2 === 0 && k > 0.12) {                                   // وريقات متدلّية
        g.fillStyle = PAL.palm; px(g, x, y + th, 1, Math.round((2 + k * 6) * u));
      }
    }
  }
  g.fillStyle = PAL.palm2; px(g, tx - 3 * u, top - 2 * u, 6 * u, 5 * u);                 // تاج النخلة
  return c;
}
export function hedgeStrip(seed, W, h) {
  const r = rng(seed), [c, g] = canvas(W, h);
  g.fillStyle = PAL.hedge[0]; px(g, 0, h * 0.4, W, h);
  for (let x = 0; x < W; x += 6 + r() * 10) {
    const rr = Math.round(6 + r() * 9);
    ball(g, x, h * 0.45, rr, (nx, ny) => (ny < -0.5 && nx < 0.2 ? PAL.hedge[2] : ny < 0 ? PAL.hedge[1] : PAL.hedge[0]));
  }
  return c;
}

/* ---------- الكورنيش: رصيف وبلاط ---------- */
export function sidewalk(W, H) {
  const [c, g] = canvas(W, H), curb = Math.round(H * 0.12), tiles = Math.round(H * 0.62);
  g.fillStyle = PAL.curb[0]; px(g, 0, 0, W, curb);
  g.fillStyle = PAL.curb[1]; px(g, 0, curb - 3, W, 3);
  for (let x = 0; x < W; x += 24) { g.fillStyle = PAL.curb[2]; px(g, x, 0, 1, curb); }
  const th = Math.round(tiles / 4);
  for (let row = 0; row < 4; row++) {
    const y = curb + row * th;
    g.fillStyle = row % 2 ? PAL.tile[1] : PAL.tile[0]; px(g, 0, y, W, th);
    g.fillStyle = PAL.tile[2]; px(g, 0, y, W, 1);
    for (let x = (row % 2) * 12; x < W; x += 24) { px(g, x + row * 2, y, 1, th); }
  }
  const y2 = curb + tiles;
  g.fillStyle = PAL.curb[1]; px(g, 0, y2, W, 5);
  g.fillStyle = PAL.ground[0]; px(g, 0, y2 + 5, W, H - y2 - 5);
  const r = rng(77);
  for (let x = 0; x < W; x += 3) { g.fillStyle = r() > 0.6 ? PAL.ground[2] : PAL.ground[1]; px(g, x, y2 + 6 + r() * (H - y2 - 8), 2, 2); }
  for (let x = 0; x < W; x += 18 + r() * 30) { g.fillStyle = PAL.hedge[0]; for (let k = 0; k < 5; k++) px(g, x + k * 2, y2 + 5 - k % 3 * 2, 1, 3 + (k % 3) * 2); }
  return c;
}

/* ---------- كشك المادة: مظلّة مخطّطة ---------- */
export function booth(color, H, special = false) {
  const u = Math.max(1, Math.round(H / 260)), w = 46 * u, h = 52 * u, [c, g] = canvas(w, h);
  const B = (x, y, ww, hh, col) => { g.fillStyle = col; px(g, x * u, y * u, ww * u, hh * u); };
  B(4, 14, 38, 38, '#6b4a5c'); B(4, 14, 38, 2, '#86617a'); B(6, 30, 34, 3, '#c9a088');
  for (let i = 0; i < 6; i++) B(2 + i * 7, 8, 7, 8, i % 2 ? '#f3e7d3' : color);
  for (let i = 0; i < 6; i++) B(3 + i * 7, 16, 5, 2, i % 2 ? '#f3e7d3' : color);
  B(2, 6, 42, 2, '#4a3044'); B(4, 0, 2, 8, '#4a3044'); B(40, 0, 2, 8, '#4a3044');
  B(10, 20, 26, 9, '#3b2b3a'); B(11, 21, 24, 7, special ? '#f6d79a' : '#f0dfc4');
  if (special) { for (let i = 0; i < 5; i++) B(8 + i * 7, -0, 3, 3, '#f6d79a'); }
  return c;
}

/* ---------- الشخصية (٢٤×٤٨) وإطارات المشي ---------- */
export const LOOKS = {
  outfit: [['hoodie', 'هودي'], ['dishdasha', 'دشداشة']],
  head: [['hair', 'شعر'], ['ghutra', 'غترة'], ['shemagh', 'شماغ'], ['taqiya', 'طاقية']],
  skin: ['#f0c8a0', '#d9a578', '#b07850', '#7a5236'],
  color: ['#232027', '#2c4766', '#7a2f3a', '#f6f4ee', '#d9c7a3'],
};
export function playerFrames(look) {
  const frames = [];
  const robe = look.outfit === 'dishdasha';
  const top = look.color, jeans = '#3e4f63', jeansD = '#2c3a4a', skin = look.skin, skinD = '#00000033';
  for (let f = 0; f < 7; f++) {                       // ٠-٣ مشي، ٤ وقوف، ٥ فرح، ٦ يرفع كتابه فوق رأسه (٢٤×٥٦)
    const raise = f === 6;
    const [c, g] = canvas(24, raise ? 56 : 48);
    if (raise) g.translate(0, 8);
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const step = f < 4 ? [2, 0, -2, 0][f] : 0, bob = f < 4 && (f % 2 === 1) ? 1 : 0;
    const cheer = f === 5 || raise;
    // الساقان
    if (!robe) {
      P(9 + step, 32 + bob, 5, 12, jeansD); P(13 - step, 32 + bob, 5, 12, jeans);
      P(8 + step, 44, 7, 3, '#f4f4f4'); P(8 + step, 46, 7, 1, '#9a9aa6'); P(13 - step, 44, 7, 3, '#ffffff'); P(13 - step, 46, 7, 1, '#9a9aa6');
    } else {
      P(7, 32 + bob, 12, 12, top); P(7 + (step > 0 ? 1 : 0), 42, 11, 2, top);
      P(9 + step, 44, 6, 3, '#4a3a2e'); P(13 - step, 44, 6, 3, '#5a4636');
    }
    // الجسم
    P(7, 18 + bob, 12, 15, top); P(7, 18 + bob, 2, 15, '#ffffff18'); P(16, 18 + bob, 3, 15, '#00000030');
    if (robe) { P(12, 19 + bob, 1, 7, '#00000025'); P(11, 18 + bob, 4, 1, '#00000025'); }
    else { P(9, 29 + bob, 8, 3, '#00000030'); P(14, 19 + bob, 1, 6, '#bfbfbf'); }
    // الذراع
    const arm = cheer ? -12 : [-2, 0, 2, 0, 0][Math.min(4, f)];
    if (raise) { P(3, -6, 4, 25, top); P(3, -8, 4, 3, skin); P(20, -6, 4, 25, top); P(20, -8, 4, 3, skin); P(20, -6, 1, 25, '#00000030'); }
    else if (cheer) { P(15, 6 + bob, 4, 13, top); P(15, 4 + bob, 4, 3, skin); P(5, 6 + bob, 4, 13, top); P(5, 4 + bob, 4, 3, skin); }
    else {
      // الكتاب تحت الذراع
      P(11 + arm, 23 + bob, 7, 11, '#2a1f33'); P(12 + arm, 24 + bob, 5, 9, '#c8453b'); P(16 + arm, 24 + bob, 1, 9, '#8f2f28'); P(12 + arm, 24 + bob, 5, 1, '#f3e7d3');
      P(12 + arm, 20 + bob, 4, 11, top); P(12 + arm, 20 + bob, 1, 11, '#00000030'); P(12 + arm, 31 + bob, 4, 3, skin);
    }
    // الرأس
    const hy = 4 + bob;
    P(8, hy, 12, 14, skin); P(8, hy + 11, 12, 3, skinD);
    P(16, hy + 6, 2, 3, '#1b1410'); P(16, hy + 6, 1, 1, '#ffffff');                 // العين
    P(14, hy + 4, 4, 1, '#3a2a22');                                                 // الحاجب
    P(16, hy + 11, cheer ? 3 : 2, cheer ? 2 : 1, '#7a3a2c');                        // الفم
    P(10, hy + 7, 2, 3, '#00000020');                                              // الأذن
    if (look.head === 'hair') {
      P(7, hy - 2, 13, 5, '#3b2a1f'); P(7, hy - 2, 4, 10, '#3b2a1f'); P(17, hy - 3, 3, 3, '#3b2a1f'); P(11, hy - 3, 6, 2, '#4a3526');
      if (!robe) { P(6, hy + 9, 4, 9, top); }                                        // القبّعة الخلفية للهودي
    } else if (look.head === 'taqiya') {
      P(7, hy - 2, 14, 5, '#fbfaf6'); P(7, hy + 1, 14, 1, '#e0d8c8'); P(7, hy + 3, 2, 4, '#2a1d16');
    } else {
      const sh = look.head === 'shemagh';
      for (let y = hy - 2; y < hy + 20; y++) for (let x = 5; x < 21; x++) {
        const inFace = x >= 9 && y >= hy + 2 && y < hy + 14;
        const back = x < 9 && y < hy + 20, top2 = y < hy + 3;
        if (!(back || top2) || inFace) continue;
        if (x > 19 && y > hy + 2) continue;
        g.fillStyle = sh && ((x + y) % 3 === 0 || (x % 3 === 0 && y % 3 === 0)) ? '#c0322a' : '#fbfaf6';
        g.fillRect(x, y, 1, 1);
      }
      P(7, hy - 3, 14, 2, '#141414');                                                // العقال
    }
    frames.push(c);
  }
  return frames;
}

/* ---------- نجمة بكسل ---------- */
export function starSprite(size, color = '#fff6d8') {
  const s = size * 2 + 1, [c, g] = canvas(s, s), m = size;
  g.fillStyle = color;
  for (let i = -m; i <= m; i++) { const w = Math.max(1, Math.round((1 - Math.abs(i) / m) * 2)); g.fillRect(m + i, m - Math.floor(w / 2), 1, w); g.fillRect(m - Math.floor(w / 2), m + i, w, 1); }
  g.fillRect(m - 1, m - 1, 3, 3);
  g.fillStyle = '#ffffff'; g.fillRect(m, m, 1, 1);
  return c;
}
