/* «نجمك يا معلّم» بأسلوب البكسل: مشي على كورنيش الكويت وقت الغروب
   KW 1-1 الكورنيش وأكشاك المواد ← KW 1-2 الغوص على اللؤلؤ ← KW 1-3 نجوم الليل ← KW 1-4 الرسالة ← وصل ترشيحك */
import { createScene } from './scene.js';
import { canvas, playerFrames, booth, starSprite, LOOKS, rng } from './art.js';

const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid);
  return n;
};
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pearlWord = (n) => (n === 1 ? 'لؤلؤة واحدة' : n === 2 ? 'لؤلؤتين' : `${n} لآلئ`);
const teacherCount = (n) => `${n} ${n > 10 ? 'معلّماً' : n > 2 ? 'معلّمين' : n === 2 ? 'معلّمان' : 'معلّم'}`;

async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'حدث خطأ. حاول مجدداً.'), { status: res.status });
  return data;
}

/* ---------- الشاشة: دقّة منخفضة تُكبَّر بكسلاً صحيحاً ---------- */
const screen = $('screen'), g = screen.getContext('2d');
let S = 2, W = 195, H = 422, scene, K = 2;
function fit() {
  S = Math.max(1, Math.floor(innerHeight / 300));
  W = Math.ceil(innerWidth / S); H = Math.ceil(innerHeight / S);
  screen.width = W; screen.height = H; screen.style.width = W * S + 'px'; screen.style.height = H * S + 'px';
  g.imageSmoothingEnabled = false;
  K = Math.max(1, Math.floor(H / 200));
  scene = createScene(W, H);
  buildWorld();
}

/* ---------- الحالة ---------- */
const saved = (() => { try { return JSON.parse(localStorage.getItem('px-look') || '{}'); } catch { return {}; } })();
const state = {
  mode: 'load', game: null, t: 0, look: { outfit: 'hoodie', head: 'hair', skin: LOOKS.skin[1], color: LOOKS.color[0], ...saved },
  subject: null, teacher: null, answers: {}, pearls: 0, score: 0, scouted: new Set(), dusk: 0, start: 0,
};
let frames = playerFrames(state.look);
const player = { x: 40, dir: 1, walk: 0, moving: false, auto: null, cheer: false };
const input = { left: false, right: false, a: false };
let booths = [], worldEnd = 800, stars = [], fx = [];

function buildWorld() {
  if (!state.game) return;
  const list = [...state.game.subjects, { name: 'كل المعلّمين', teachers: state.game.teachers, all: true }];
  const colors = ['#c8453b', '#2f7fbf', '#3f9d6a', '#7a4fa3', '#e08a2e', '#1f8f8a', '#b0456e'];
  const gap = Math.max(150, Math.round(W * 0.75));
  booths = list.map((s, i) => ({ ...s, x: Math.round(W * 0.9 + 60 + i * gap), img: booth(s.all ? '#e9b44c' : colors[i % colors.length], H, !!s.all) }));
  worldEnd = booths.length ? booths[booths.length - 1].x + W * 0.6 : 800;
}

/* ---------- العناوين فوق الأكشاك والنجوم (HTML حادّ فوق اللوحة) ---------- */
const tags = new Map();
function tag(key, html, cls) {
  let n = tags.get(key);
  if (!n) { n = el('button', { class: 'px-tag ' + (cls || ''), type: 'button' }); n.innerHTML = html; $('labels').append(n); tags.set(key, n); }
  return n;
}
function clearTags() { for (const n of tags.values()) n.remove(); tags.clear(); }
const place = (n, sx, sy) => { n.style.transform = `translate(-50%, -100%) translate(${sx * S}px, ${sy * S}px)`; };

/* ---------- الإدخال ---------- */
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.left = true;
  if (['ArrowRight', 'd', 'D'].includes(e.key)) input.right = true;
  if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); press(); }
});
addEventListener('keyup', (e) => {
  if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.left = false;
  if (['ArrowRight', 'd', 'D'].includes(e.key)) input.right = false;
});
function hold(id, key) {
  const b = $(id);
  const on = (e) => { e.preventDefault(); input[key] = true; b.classList.add('down'); }, off = () => { input[key] = false; b.classList.remove('down'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
}
hold('pad-left', 'left'); hold('pad-right', 'right');
$('pad-a').addEventListener('click', () => press());
let onPress = null;
function press() { if (onPress) onPress(); }

/* ---------- صندوق الحوار (أسلوب ألعاب البكسل) ---------- */
const dlg = $('dlg');
/** على شاشة الجوال الطولية يصعد الحوار للأعلى أثناء المشي والسماء كي لا يغطّي النوخذة */
const tall = () => innerHeight > innerWidth * 1.2;
function say(...kids) {
  dlg.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
  dlg.classList.toggle('top', tall() && (state.mode === 'walk' || state.mode === 'night'));
  dlg.hidden = false;
}
function hush() { dlg.hidden = true; dlg.replaceChildren(); }
async function typewrite(node, text, ms = 28) {
  if (calm) { node.textContent = text; return; }
  node.textContent = '';
  for (const ch of text) { node.textContent += ch; await sleep(ms); }
}
const pxBtn = (label, onclick, cls = '') => el('button', { class: 'px-btn ' + cls, type: 'button', onclick }, label);
const setStage = (code, name) => { $('hud-stage').textContent = code; $('hud-stage-name').textContent = name; };
const setScore = () => { $('hud-score').textContent = String(state.score).padStart(4, '0'); };
function showPad(on) { $('pad').hidden = !on; }

/* ---------- الحلقة ---------- */
let last = performance.now(), camX = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; state.t += dt;
  update(dt); draw();
  if (state.start && !['win', 'ended'].includes(state.mode)) {
    const s = Math.floor((Date.now() - state.start) / 1000);
    $('hud-time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  requestAnimationFrame(loop);
}
function update(dt) {
  const walkable = state.mode === 'walk' || state.mode === 'night';
  let dir = 0;
  if (player.auto != null) { dir = Math.sign(player.auto - player.x); if (Math.abs(player.auto - player.x) < 2) { player.auto = null; dir = 0; } }
  else if (walkable) dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const speed = 62 * (H / 422) + 30;
  if (dir) { player.x = clamp(player.x + dir * speed * dt, 20, worldEnd); player.dir = dir; player.walk += dt * 9; }
  player.moving = !!dir;
  const target = clamp(player.x - W * (state.mode === 'night' ? 0.5 : 0.38), 0, Math.max(0, worldEnd - W * 0.7));
  camX += (target - camX) * Math.min(1, dt * 5);
  if (state.mode === 'title') camX = (state.t * 10) % 600;
  if (state.mode === 'walk') scout();
  if (state.mode === 'night') skyScout();
  fx = fx.filter((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; return p.t < p.life; });
}

/* ---------- الرسم ---------- */
function draw() {
  if (!scene) return;
  if (state.mode === 'dive') return drawDive();
  scene.draw(g, camX, state.t, state.dusk);
  const gy = scene.L.groundY;
  // الأكشاك على الكورنيش
  if (['walk', 'title', 'intro', 'dress', 'sail'].includes(state.mode)) {
    for (const b of booths) {
      const sx = Math.round(b.x - camX - b.img.width / 2);
      if (sx < -b.img.width || sx > W) { const t2 = tags.get('b' + b.name); if (t2) t2.style.visibility = 'hidden'; continue; }
      g.drawImage(b.img, sx, gy - b.img.height + Math.round(H * 0.045));
      if (state.mode === 'walk') {
        const t2 = tag('b' + b.name, `<b>${b.name}</b><small>${b.all ? 'أي معلّم' : teacherCount(b.teachers.length)}</small>`, b.all ? 'gold' : '');
        t2.style.visibility = ''; t2.onclick = () => enterBooth(b);
        t2.classList.toggle('near', near === b);
        place(t2, b.x - camX, gy - b.img.height + Math.round(H * 0.03));
      }
    }
  }
  // نجوم المعلّمين في الليل
  if (state.mode === 'night' || state.mode === 'msg' || state.mode === 'win') {
    for (const s of stars) {
      const pulse = s === pick ? 1 + Math.round(Math.sin(state.t * 6)) : 0;
      const img = s === pick || s.lit ? s.big : s.img;
      const tw = (Math.sin(state.t * 3 + s.p) > 0.8 && s !== pick) ? 1 : 0;
      g.globalAlpha = s.dim ? 0.45 : 1;
      g.drawImage(img, Math.round(s.sx - img.width / 2) - pulse, Math.round(s.sy - img.height / 2) - pulse, img.width + pulse * 2 - tw, img.height + pulse * 2 - tw);
      g.globalAlpha = 1;
      if (state.cleared) continue;   // شاشة «STAGE CLEAR» بلا أسماء تزاحمها
      const t2 = tag('s' + s.t.id, s.t.name, 'star');
      t2.classList.toggle('near', s === skyNear); t2.classList.toggle('picked', s === pick);
      t2.onclick = () => choose(s);
      place(t2, s.sx, s.sy + img.height / 2 + 12);
    }
  }
  // الشعاع من النوخذة إلى النجم
  if (beam) {
    g.fillStyle = '#fff3c4';
    const n = 40;
    for (let i = 0; i < n * beam.k; i++) { const k = i / n; const x = beam.x0 + (beam.x1 - beam.x0) * k, y = beam.y0 + (beam.y1 - beam.y0) * k - Math.sin(k * Math.PI) * 20; if ((i + Math.floor(state.t * 20)) % 3) g.fillRect(Math.round(x), Math.round(y), 2, 2); }
  }
  // اللاعب
  if (state.mode !== 'title' && state.mode !== 'load') {
    const f = player.cheer ? 5 : player.moving ? Math.floor(player.walk) % 4 : 4;
    const img = frames[f], w = 24 * K, h = 48 * K;
    const sx = Math.round(player.x - camX - w / 2), sy = gy + Math.round(H * 0.11) - h;
    g.fillStyle = 'rgba(40,24,40,0.35)'; g.fillRect(sx + 4 * K, sy + h - 2 * K, w - 8 * K, 3 * K);     // الظل
    if (player.dir < 0) { g.save(); g.translate(sx + w, sy); g.scale(-1, 1); g.drawImage(img, 0, 0, w, h); g.restore(); }
    else g.drawImage(img, sx, sy, w, h);
  }
  for (const p of fx) { g.globalAlpha = clamp(1 - p.t / p.life, 0, 1); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
  g.globalAlpha = 1;
}

/* ---------- KW 1-2: مشهد الغوص ---------- */
const dive = { open: 0, y: 0 };
function drawDive() {
  const r = rng(4);
  for (let y = 0; y < H; y++) {                                            // ماء متدرّج متقطّع
    const k = y / H, a = ['#5cc0b5', '#3aa0a8', '#2a7f98', '#1f5f86', '#1b4570'], t = k * (a.length - 1), i = Math.min(a.length - 2, Math.floor(t));
    for (let x = 0; x < W; x += 2) { g.fillStyle = (t - i) > ((x / 2 + y) % 4) / 4 ? a[i + 1] : a[i]; g.fillRect(x, y, 2, 1); }
  }
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 4; i++) { const x0 = (i * W) / 3 + Math.sin(state.t + i) * 6; for (let y = 0; y < H * 0.8; y++) g.fillRect(Math.round(x0 + y * 0.3), y, 6 + y * 0.04, 1); }
  for (let i = 0; i < 26; i++) { const x = r() * W, sp = 18 + r() * 30; const y = H - ((r() * H + state.t * sp) % (H + 20)); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(Math.round(x + Math.sin(state.t * 2 + i) * 2), Math.round(y), 2, 2); }
  const sand = Math.round(H * 0.82);
  g.fillStyle = '#c9b27c'; g.fillRect(0, sand, W, H - sand); g.fillStyle = '#b39a66';
  for (let x = 0; x < W; x += 5) g.fillRect(x, sand + ((x * 7) % 9), 3, 1);
  // المحارة واللؤلؤة
  const ox = Math.round(W * 0.66), oy = sand - 2, ow = 18 * K;
  g.fillStyle = '#7d6a8a'; g.fillRect(ox - ow, oy - 4 * K, ow * 2, 4 * K);
  g.save(); g.translate(ox - ow, oy - 4 * K); g.rotate(-dive.open * 0.7);
  g.fillStyle = '#9a88a8'; g.fillRect(0, -6 * K, ow * 2, 6 * K); g.fillStyle = '#b6a5c4'; g.fillRect(0, -6 * K, ow * 2, 2 * K); g.restore();
  if (dive.open > 0.3) { g.fillStyle = '#fffaf0'; g.fillRect(ox - 3 * K, oy - 10 * K, 6 * K, 6 * K); g.fillStyle = '#d8d2c4'; g.fillRect(ox + 1 * K, oy - 6 * K, 2 * K, 2 * K); }
  // الغوّاص
  const img = frames[4], w = 24 * K, h = 48 * K, px = Math.round(W * 0.3), py = Math.round(H * 0.42 + Math.sin(state.t * 2) * 4 + dive.y);
  g.save(); g.translate(px, py); g.rotate(Math.sin(state.t) * 0.15 + 0.2); g.drawImage(img, -w / 2, -h / 2, w, h); g.restore();
}

/* ======================================================================
   شاشة البداية والمشهد الافتتاحي
   ====================================================================== */
function titleScreen() {
  state.mode = 'title';
  $('title').hidden = false; showPad(false);
  onPress = start;
  $('title').onclick = start;
}
async function start() {
  if (state.mode !== 'title') return;
  $('title').hidden = true;
  state.start = Date.now();
  state.mode = 'intro';
  camX = 0; player.x = -30; player.auto = W * 0.42; player.dir = 1;
  setStage('KW 1-1', 'الكورنيش');
  const line = el('p', { class: 'px-line' });
  const next = pxBtn('التالي ▸', null, 'small');
  say(el('p', { class: 'px-who' }, 'الراوي'), line, el('div', { class: 'px-acts' }, next));
  const lines = ['في زمن البحر، كان «المعلّم» هو من يهدي السفينة بالنجوم.', 'واليوم يا نوخذة، امشِ على الكورنيش، واستطلع أكشاك المواد، واختر نجم معلّمك.'];
  for (const l of lines) {
    let go; const p = new Promise((r) => { go = r; });
    next.onclick = go; onPress = go;
    await typewrite(line, l);
    await Promise.race([p, sleep(calm ? 1500 : 4200)]);
  }
  dress();
}

/* ======================================================================
   جهّز نوخذتك
   ====================================================================== */
function dress() {
  state.mode = 'dress';
  player.auto = null;
  const row = (label, items) => el('div', { class: 'px-row' }, el('span', { class: 'px-label' }, label), el('div', { class: 'px-opts' }, items));
  const opt = (cur, val, attrs, content, apply) => el('button', {
    type: 'button', 'aria-pressed': String(cur === val), ...attrs,
    onclick: (e) => { apply(); frames = playerFrames(state.look); try { localStorage.setItem('px-look', JSON.stringify(state.look)); } catch {}; e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
  }, content);
  say(el('p', { class: 'px-who' }, 'جهّز نوخذتك'),
    row('اللبس', LOOKS.outfit.map(([v, n]) => opt(state.look.outfit, v, { class: 'px-opt' }, n, () => {
      state.look.outfit = v;
      if (v === 'dishdasha' && ['#232027', '#7a2f3a'].includes(state.look.color)) state.look.color = '#f6f4ee';
      if (v === 'hoodie' && ['#f6f4ee', '#d9c7a3'].includes(state.look.color)) state.look.color = '#232027';
    }))),
    row('الرأس', LOOKS.head.map(([v, n]) => opt(state.look.head, v, { class: 'px-opt' }, n, () => { state.look.head = v; }))),
    row('البشرة', LOOKS.skin.map((c, i) => opt(state.look.skin, c, { class: 'px-sw', style: `--c:${c}`, 'aria-label': `لون البشرة ${i + 1}` }, null, () => { state.look.skin = c; }))),
    row('اللون', LOOKS.color.map((c, i) => opt(state.look.color, c, { class: 'px-sw', style: `--c:${c}`, 'aria-label': `لون اللبس ${i + 1}` }, null, () => { state.look.color = c; }))),
    el('div', { class: 'px-acts' }, pxBtn('انطلق ▸', walk, 'go')));
  onPress = walk;
}

/* ======================================================================
   KW 1-1: المشي على الكورنيش واستطلاع الأكشاك
   ====================================================================== */
let near = null;
function walk() {
  state.mode = 'walk';
  setStage('KW 1-1', 'الكورنيش');
  showPad(true);
  near = undefined;
  scout();
}
function scout() {
  let best = null;
  for (const b of booths) { const d = Math.abs(b.x - player.x); if (d < 42 * (H / 422) + 14 && (!best || d < best.d)) best = { b, d }; }
  const now = best ? best.b : null;
  if (now === near) return;
  near = now;
  if (now) {
    if (!state.scouted.has(now.name)) { state.scouted.add(now.name); state.score += 100; setScore(); }
    const names = shuffle(now.teachers).slice(0, 4).map((t) => t.name);
    say(el('p', { class: 'px-who' }, 'منظار النوخذة'),
      el('p', { class: 'px-big' }, now.all ? 'كشك كل المعلّمين' : `كشك ${now.name}`),
      el('p', { class: 'px-line' }, now.all ? 'من هنا ترى سماء المدرسة كلها، وفيها كل المعلّمين.' : `${teacherCount(now.teachers.length)}: ${names.join('، ')}${now.teachers.length > 4 ? '…' : ''}`),
      el('div', { class: 'px-acts' }, pxBtn('ادخل الكشك (A)', () => enterBooth(now), 'go')));
    onPress = () => enterBooth(now);
  } else {
    const list = el('div', { class: 'px-list', hidden: true }, booths.map((b) => pxBtn(b.name, () => enterBooth(b), 'small')));
    say(el('p', { class: 'px-who' }, 'KW 1-1 · الكورنيش'),
      el('p', { class: 'px-line' }, 'امشِ بالأسهم ◀ ▶. كل كشك مادة؛ اقترب منه لتستطلع معلّميه.'),
      el('button', { class: 'px-link', type: 'button', onclick: (e) => { list.hidden = !list.hidden; e.currentTarget.textContent = list.hidden ? 'أو اختر المادة من القائمة' : 'أخفِ القائمة'; } }, 'أو اختر المادة من القائمة'),
      list);
    onPress = null;
  }
}
async function enterBooth(b) {
  if (state.mode !== 'walk') return;
  state.mode = 'sail';
  state.subject = b;
  clearTags(); hush(); showPad(false);
  player.auto = b.x;
  while (player.auto != null) await sleep(50);
  if (!b.all && b.questions > 0) return offerDive();
  night();
}

/* ======================================================================
   KW 1-2: الغوص على اللؤلؤ
   ====================================================================== */
function offerDive() {
  say(el('p', { class: 'px-who' }, 'KW 1-2 · الغوص'),
    el('p', { class: 'px-big' }, 'تغوص على اللؤلؤ؟'),
    el('p', { class: 'px-line' }, `ثلاثة أسئلة من ${state.subject.name}. كل إجابة صحيحة لؤلؤة تُهديها لمعلّمك. الغوص لا يغيّر صوتك.`),
    el('div', { class: 'px-acts' }, pxBtn('اغطس (A)', doDive, 'go'), pxBtn('تخطَّ', night)));
  onPress = doDive;
}
async function doDive() {
  onPress = null;
  const { items } = await api('/api/game/questions?subject=' + encodeURIComponent(state.subject.name)).catch(() => ({ items: [] }));
  if (!items.length) return night();
  state.mode = 'dive'; setStage('KW 1-2', 'الغوص'); dive.open = 0; dive.y = -H * 0.5;
  for (let i = 0; i < 20; i++) { dive.y *= 0.82; await sleep(30); }
  state.pearls = 0; state.answers = {};
  for (let i = 0; i < items.length; i++) {
    const q = items[i];
    const pearls = el('p', { class: 'px-pearls' }, [0, 1, 2].slice(0, items.length).map((k) => el('span', { class: k < state.pearls ? 'got' : '' })));
    const choice = await new Promise((resolve) => say(el('p', { class: 'px-who' }, `السؤال ${i + 1} من ${items.length}`), pearls,
      el('p', { class: 'px-big' }, q.q),
      el('div', { class: 'px-choices' }, q.choices.map((c, k) => pxBtn(c, () => resolve(k), 'choice')))));
    state.answers[q.id] = choice;
    const r = await api('/api/game/check', { id: q.id, choice }).catch(() => null);
    const btns = dlg.querySelectorAll('.choice');
    btns.forEach((b) => { b.disabled = true; });
    if (r) {
      btns[r.answer]?.classList.add('right');
      if (!r.correct) btns[choice]?.classList.add('wrong');
      if (r.correct) { state.pearls++; state.score += 500; setScore(); for (let k = 0; k <= 10; k++) { dive.open = k / 10; await sleep(25); } }
    }
    await sleep(calm ? 600 : 1300);
    dive.open = 0;
  }
  say(el('p', { class: 'px-who' }, 'KW 1-2 · الغوص'),
    el('p', { class: 'px-big' }, state.pearls ? `جمعت ${pearlWord(state.pearls)}!` : 'لم تجد لؤلؤاً هذه المرة'),
    el('p', { class: 'px-line' }, state.pearls ? 'ستهديها لمعلّمك مع ترشيحك.' : 'لا بأس، الغوص لا يغيّر صوتك.'),
    el('div', { class: 'px-acts' }, pxBtn('اصعد (A)', night, 'go')));
  onPress = night;
}

/* ======================================================================
   KW 1-3: الليل ونجوم المعلّمين
   ====================================================================== */
let pick = null, skyNear = null, beam = null;
async function night() {
  onPress = null;
  state.mode = 'night'; setStage('KW 1-3', 'السماء');
  hush(); clearTags(); pick = null; skyNear = null; state.teacher = null;
  const list = shuffle(state.subject.teachers);
  const show = list.slice(0, Math.max(1, Math.min(list.length, W > 400 ? 12 : 8)));
  const r = rng(list.length * 13 + 7);
  const big = starSprite(Math.round(7 * K)), small = starSprite(Math.round(4 * K));
  const cols = show.length, top = Math.round(H * (tall() ? 0.38 : 0.1)), span = Math.round(H * (tall() ? 0.18 : 0.3));
  stars = show.map((t, i) => ({ t, img: small, big, p: r() * 6, sx: Math.round(W * (0.12 + (0.76 * (i + 0.5)) / cols)), sy: top + ((i % 3) * span) / 3 + Math.round(r() * 8), lit: false }));
  for (let k = 0; k <= 30; k++) { state.dusk = k / 30; await sleep(calm ? 5 : 40); }
  showPad(true);
  skyDialog(list);
}
function skyDialog(list) {
  const search = el('input', { class: 'px-input', type: 'search', placeholder: 'ابحث باسم المعلّم', 'aria-label': 'ابحث باسم المعلّم', autocomplete: 'off' });
  const found = el('div', { class: 'px-list' });
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = search.value.trim();
      if (q.length < 2) { found.replaceChildren(); return; }
      const { items } = await api('/api/suggest?q=' + encodeURIComponent(q)).catch(() => ({ items: [] }));
      found.replaceChildren(...items.map((t) => pxBtn(t.name, () => choose(stars.find((s) => s.t.id === t.id) || addStar(t)), 'small')));
    }, 160);
  });
  say(el('p', { class: 'px-who' }, 'KW 1-3 · السماء'),
    el('p', { class: 'px-line' }, 'كل نجم معلّم. امشِ تحت النجوم لتستطلعها، ثم اضغط A أو المس نجم معلّمك.'),
    search, found, list.length > stars.length ? el('p', { class: 'px-line small' }, `في السماء ${stars.length} من ${list.length}؛ ابحث عن الباقين بالاسم.`) : null,
    el('button', { class: 'px-link', type: 'button', onclick: backToWalk }, 'عُد إلى الكورنيش'));
  onPress = () => skyNear && choose(skyNear);
}
function addStar(t) {
  const s = { t, img: stars[0]?.img || starSprite(4 * K), big: stars[0]?.big || starSprite(7 * K), p: 0, sx: Math.round(W / 2), sy: Math.round(H * (tall() ? 0.36 : 0.06)), lit: false };
  stars.push(s); return s;
}
function skyScout() {
  const px2 = player.x - camX;
  let best = null;
  for (const s of stars) { const d = Math.abs(s.sx - px2); if (!best || d < best.d) best = { s, d }; }
  skyNear = best && best.d < 40 ? best.s : null;
}
async function backToWalk() {
  clearTags();
  for (let k = 30; k >= 0; k--) { state.dusk = k / 30; await sleep(calm ? 5 : 25); }
  stars = []; state.mode = 'walk'; near = undefined; showPad(true); walk();
}
function choose(s) {
  if (!s || !['night'].includes(state.mode)) return;
  pick = s; state.teacher = s.t;
  stars.forEach((o) => { o.dim = o !== s; });
  message();
}

/* ======================================================================
   KW 1-4: الرسالة، ثم الوصول
   ====================================================================== */
function message() {
  state.mode = 'msg'; setStage('KW 1-4', 'الرسالة'); showPad(false);
  player.auto = camX + pick.sx;
  const ta = el('textarea', { class: 'px-input', id: 'reason', maxlength: 300, rows: 3, placeholder: 'ماذا يميّزه؟ ماذا تعلّمت منه؟' });
  const count = el('span', { class: 'px-count' }, '0/300');
  ta.addEventListener('input', () => { count.textContent = `${ta.value.length}/300`; });
  const send = pxBtn(`أشعل نجم ${pick.t.name} ★`, () => finale(ta.value.trim(), send), 'go');
  say(el('p', { class: 'px-who' }, `KW 1-4 · رسالتك إلى ${pick.t.name}`),
    el('label', { class: 'px-line', for: 'reason' }, 'لماذا اخترته؟ (اختياري)'), ta, count,
    el('div', { class: 'px-acts' }, send, pxBtn('غيّر', () => { state.mode = 'night'; setStage('KW 1-3', 'السماء'); stars.forEach((o) => { o.dim = false; }); pick = null; showPad(true); skyDialog(state.subject.teachers); })));
  onPress = null;
}
async function finale(reason, btn) {
  btn.disabled = true;
  let r;
  try {
    r = await api('/api/vote', { teacherId: state.teacher.id, name: state.teacher.name, reason, subject: state.subject.all ? '' : state.subject.name, answers: state.answers });
  } catch (e) {
    if (e.status === 409) return ended('سبق أن رشّحت', 'سُجّل ترشيحك من هذا الجهاز من قبل. لكل طالب صوت واحد.');
    if (e.status === 403) return ended('التصويت مغلق', 'انتهت فترة الترشيح. شكراً لك.');
    btn.disabled = false;
    say(el('p', { class: 'px-who' }, 'تعذّر الإرسال'), el('p', { class: 'px-line' }, e.message === 'Failed to fetch' ? 'تحقّق من اتصالك بالإنترنت ثم حاول مجدداً.' : e.message),
      el('div', { class: 'px-acts' }, pxBtn('حاول مجدداً', () => finale(reason, btn), 'go')));
    return;
  }
  try { localStorage.setItem('voted', '1'); } catch {}
  state.mode = 'win'; hush();
  while (player.auto != null) await sleep(40);
  // شعاع من النوخذة إلى النجم
  const gy = scene.L.groundY, x0 = player.x - camX, y0 = gy + Math.round(H * 0.11) - 48 * K;
  beam = { x0, y0, x1: pick.sx, y1: pick.sy, k: 0 };
  for (let k = 0; k <= 30; k++) { beam.k = k / 30; await sleep(calm ? 5 : 35); }
  pick.lit = true; beam = null; player.cheer = true;
  state.score += 1000 + (r.pearls || 0) * 500; setScore();
  // ألعاب نارية بكسل
  const colors = ['#f6d79a', '#e9b44c', '#5cc0b5', '#ffffff', '#ef8f6a'];
  for (let b = 0; b < (calm ? 1 : 6); b++) {
    const cx = b === 0 ? pick.sx : W * (0.15 + Math.random() * 0.7), cy = b === 0 ? pick.sy : H * (0.08 + Math.random() * 0.25);
    for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2, v = 30 + Math.random() * 40; fx.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 1.4, c: colors[i % colors.length] }); }
    await sleep(380);
  }
  const p = r.pearls || 0;
  state.cleared = true; clearTags();
  $('clear').hidden = false;
  $('clear-name').textContent = state.teacher.name;
  $('clear-sub').textContent = p ? `وأهديته ${pearlWord(p)}. كلمتك تصل، وأثرها يبقى.` : 'كلمتك تصل، وأثرها يبقى.';
  $('clear-score').textContent = String(state.score).padStart(4, '0');
}
function ended(title, text) {
  state.mode = 'ended'; showPad(false); $('title').hidden = true;
  say(el('p', { class: 'px-who' }, 'نجمك يا معلّم'), el('p', { class: 'px-big' }, title), el('p', { class: 'px-line' }, text),
    el('div', { class: 'px-acts' }, el('a', { class: 'px-btn', href: '/about' }, 'عن المبادرة')));
}

/* ---------- البداية ---------- */
(async () => {
  fit();
  addEventListener('resize', () => { fit(); });
  requestAnimationFrame(loop);
  try { state.game = await api('/api/game'); } catch { $('loading').hidden = true; return ended('تعذّر الاتصال', 'لم نستطع تحميل اللعبة. تحقّق من الإنترنت ثم حاول مجدداً.'); }
  if (state.game.school) $('hud-school').textContent = state.game.school;
  buildWorld(); setScore();
  $('loading').hidden = true;
  if (state.game.voted) return ended('سبق أن رشّحت', 'سُجّل ترشيحك من هذا الجهاز من قبل. لكل طالب صوت واحد.');
  if (!state.game.open) return ended('التصويت مغلق', 'انتهت فترة الترشيح. شكراً لكل من شارك.');
  if (!state.game.teachers.length) return ended('لم تبدأ اللعبة بعد', 'لم تُضف أسماء المعلّمين بعد. عُد لاحقاً.');
  titleScreen();
})();
window.__px = { state, player, input, get booths() { return booths; }, get stars() { return stars; } };
