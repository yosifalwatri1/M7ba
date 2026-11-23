/* «المعلّم النجم» بأسلوب البكسل: مشي على كورنيش الكويت وقت الغروب
   KW 1-1 الكورنيش: أكشاك المواد مقفلة، والمدرسة أول الشارع
   KW 1-2 المدرسة: ممرّ بأبواب الفصول؛ في الفصل أسئلة على السبّورة، وكل إجابة بطاقة (الصحيحة ذهبية)
   ← تُسلَّم البطاقات لكشك المادة فينفتح ← KW 1-3 نجوم الليل ← KW 1-4 الرسالة ← وصل ترشيحك */
import { createScene } from './scene.js';
import { playerFrames, booth, starSprite, LOOKS, rng } from './art.js';
import { schoolFacade, shutter, cardSprite, createCorridor, createClassroom } from './school.js';
import { createRace } from './race.js';
import { unlock, voice, sfx, ambience, engine, soundOn, setSound } from './audio.js';

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
const cardWord = (n) => (n === 1 ? 'بطاقة واحدة' : n === 2 ? 'بطاقتين' : `${n} بطاقات`);
const goldWord = (n, nom) => (n === 1 ? 'بطاقة ذهبية' : n === 2 ? (nom ? 'بطاقتان ذهبيتان' : 'بطاقتين ذهبيتين') : `${n} بطاقات ذهبية`);
const teacherCount = (n) => `${n} ${n > 10 ? 'معلّماً' : n > 2 ? 'معلّمين' : n === 2 ? 'معلّمان' : 'معلّم'}`;
const COLORS = ['#c8453b', '#2f7fbf', '#3f9d6a', '#7a4fa3', '#e08a2e', '#1f8f8a', '#b0456e'];
const ALL = 'كل المعلّمين';

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
  subject: null, teacher: null, score: 0, scouted: new Set(), dusk: 0, start: 0,
  cards: [], cardsFor: null, answers: {}, boothAnswers: {},
};
let frames = playerFrames(state.look);
const player = { x: 40, dir: 1, walk: 0, moving: false, auto: null, cheer: false };
const input = { left: false, right: false, a: false };
let booths = [], school = null, hall = null, doors = [], room = null, streetEnd = 800, hallEnd = 600, stars = [], fx = [], flying = [], fade = 0;

const STREET = ['walk', 'title', 'intro', 'dress', 'busy'];
const inHall = () => state.mode === 'school' || state.mode === 'hall-busy';
const endX = () => (inHall() ? hallEnd : streetEnd);

function buildWorld() {
  if (!state.game) return;
  // الكورنيش: المدرسة أول الشارع، ثم أكشاك المواد
  const art = schoolFacade(H);
  school = { x: Math.round(W * 0.42 + art.img.width / 2 + 26), art };
  const list = [...state.game.subjects, { name: ALL, teachers: state.game.teachers, all: true }];
  const gap = Math.max(150, Math.round(W * 0.75)), sh = shutter(H), first = school.x + art.img.width / 2 + Math.max(110, Math.round(W * 0.5));
  booths = list.map((s, i) => {
    const color = s.all ? '#e9b44c' : COLORS[i % COLORS.length];
    const old = booths.find((b) => b.name === s.name);
    return { ...s, color, x: Math.round(first + i * gap), img: booth(color, H, !!s.all), sh, u: Math.max(1, Math.round(H / 260)), open: old ? old.open : 0, shown: old ? old.shown : [] };
  });
  streetEnd = booths.length ? booths[booths.length - 1].x + W * 0.6 : 800;
  // الممرّ: باب الخروج، ثم فصل لكل مادة، ثم المكتبة
  const hg = Math.max(140, Math.min(240, Math.round(W * 0.5)));
  hall = createCorridor(W, H, hg);
  const total = state.game.questions || 0;
  const ds = [{ exit: true, name: 'الكورنيش', color: '#2f8f4e' },
    ...state.game.subjects.map((s) => ({ name: s.name, subject: s.name, questions: s.questions, color: booths.find((b) => b.name === s.name).color })),
    { library: true, name: 'المكتبة', subject: '', questions: total, color: '#e9b44c' }];
  doors = ds.map((d, i) => ({ ...d, x: 60 + i * hg, img: hall.door(d.color, d.exit) }));
  hallEnd = doors[doors.length - 1].x + W * 0.3;
  room = createClassroom(W, H);
}
const targetBooth = () => booths.find((b) => b.name === state.cardsFor);

/* ---------- العناوين فوق المباني والنجوم (HTML حادّ فوق اللوحة) ---------- */
const tags = new Map();
function tag(key, html, cls) {
  let n = tags.get(key);
  if (!n) { n = el('button', { class: 'px-tag ' + (cls || ''), type: 'button' }); $('labels').append(n); tags.set(key, n); }
  if (n._html !== html) { n.innerHTML = html; n._html = html; }
  return n;
}
function clearTags() { for (const n of tags.values()) n.remove(); tags.clear(); }
const place = (n, sx, sy) => { n.style.transform = `translate(-50%, -100%) translate(${sx * S}px, ${sy * S}px)`; };
const hideTag = (key) => { const n = tags.get(key); if (n) n.style.visibility = 'hidden'; };

/* ---------- الإدخال ---------- */
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.left = true;
  if (['ArrowRight', 'd', 'D'].includes(e.key)) input.right = true;
  if (['ArrowUp', 'w', 'W'].includes(e.key)) { input.up = true; if (state.mode === 'race') e.preventDefault(); }
  if (['ArrowDown', 's', 'S'].includes(e.key)) { input.down = true; if (state.mode === 'race') e.preventDefault(); }
  if ([' ', 'Enter'].includes(e.key)) { if (e.target.closest && e.target.closest('button, a')) return; e.preventDefault(); press(); }
});
addEventListener('keyup', (e) => {
  if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.left = false;
  if (['ArrowRight', 'd', 'D'].includes(e.key)) input.right = false;
});
function hold(id, key) {
  const b = $(id);
  // في السباق يصبح الزرّان ▲ و▼ لتغيير المسار
  const on = (e) => { e.preventDefault(); if (state.mode === 'race') input[key === 'left' ? 'up' : 'down'] = true; else input[key] = true; b.classList.add('down'); };
  const off = () => { input[key] = false; b.classList.remove('down'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
}
hold('pad-left', 'left'); hold('pad-right', 'right');
$('pad-a').addEventListener('click', () => press());
function setPad(race) {
  $('pad-left').textContent = race ? '▲' : '◀'; $('pad-left').setAttribute('aria-label', race ? 'المسار الأعلى' : 'امشِ يساراً');
  $('pad-right').textContent = race ? '▼' : '▶'; $('pad-right').setAttribute('aria-label', race ? 'المسار الأسفل' : 'امشِ يميناً');
  $('pad-a').setAttribute('aria-label', race ? 'اقفز' : 'زر الاختيار');
}
// السحب لأعلى أو لأسفل على الشاشة يغيّر المسار في السباق
let swipeY = null;
screen.addEventListener('pointerdown', (e) => { swipeY = e.clientY; });
screen.addEventListener('pointerup', (e) => {
  if (state.mode === 'race' && swipeY != null) { const dy = e.clientY - swipeY; if (dy < -24) input.up = true; else if (dy > 24) input.down = true; else race?.jump(); }
  swipeY = null;
});
// زر الصوت
function soundLabel() { $('snd').textContent = soundOn() ? 'الصوت: يعمل' : 'الصوت: مطفأ'; $('snd').setAttribute('aria-pressed', String(soundOn())); }
$('snd').addEventListener('click', () => { unlock(); setSound(!soundOn()); soundLabel(); });
soundLabel();
let onPress = null;
function press() { if (onPress) onPress(); }

/* ---------- صندوق الحوار (أسلوب ألعاب البكسل) ---------- */
const dlg = $('dlg');
/** على شاشة الجوال الطولية يصعد الحوار للأعلى أثناء المشي كي لا يغطّي الشخصية، وفي الفصل ينزل لأسفل تحت السبّورة */
const tall = () => innerHeight > innerWidth * 1.2;
function say(...kids) {
  dlg.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
  dlg.classList.toggle('top', tall() && ['walk', 'night', 'school'].includes(state.mode));
  dlg.classList.toggle('low', state.mode === 'class');
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
function setCards() {
  const color = targetBooth()?.color || '#2f7fbf';
  $('hud-cards').replaceChildren(...state.cards.map((c) => el('i', { class: c.gold ? 'gold' : '', style: `--c:${color}` })));
  $('hud-cards').setAttribute('aria-label', state.cards.length ? `معك ${cardWord(state.cards.length)}` : '');
}
/** انتقال: تعتيم ثم تبديل المشهد ثم إظهار */
async function wipe(swap) {
  for (let k = 1; k <= 8; k++) { fade = k / 8; await sleep(calm ? 5 : 28); }
  swap();
  for (let k = 7; k >= 0; k--) { fade = k / 8; await sleep(calm ? 5 : 28); }
}
/** بطاقة تطير من نقطة إلى أخرى (بإحداثيات اللوحة) */
function fly(img, x0, y0, x1, y1, dur = 0.7) {
  return new Promise((done) => flying.push({ img, x0, y0, x1, y1, t: 0, dur: calm ? 0.05 : dur, done }));
}
function hudCardsPoint() {
  const r = $('hud-cards').getBoundingClientRect();
  return [(r.left + r.width / 2) / S, (r.top + r.height / 2) / S];
}
const walkTo = async (x) => { player.auto = x; while (player.auto != null) await sleep(40); };

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
let ambLevel = -1;
function update(dt) {
  const amb = { walk: 1, busy: 1, intro: 1, dress: 1, night: 0.6, msg: 0.6, win: 0.6, school: 0.2, 'hall-busy': 0.2, class: 0.15, race: 0.5 }[state.mode] ?? 0;
  if (amb !== ambLevel) { ambLevel = amb; ambience(amb); }
  if (state.mode === 'race' && race) {
    race.update(dt, input);
    fx = fx.filter((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; return p.t < p.life; });
    return;
  }
  const walkable = ['walk', 'night', 'school'].includes(state.mode);
  let dir = 0;
  if (player.auto != null) { dir = Math.sign(player.auto - player.x); if (Math.abs(player.auto - player.x) < 2) { player.x = player.auto; player.auto = null; dir = 0; } }
  else if (walkable) dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const speed = 62 * (H / 422) + 30;
  if (dir) { player.x = clamp(player.x + dir * speed * dt, 20, endX()); player.dir = dir; player.walk += dt * 9; }
  player.moving = !!dir;
  if (state.mode === 'class') camX = 0;
  else {
    const target = clamp(player.x - W * (state.mode === 'night' ? 0.5 : 0.38), 0, Math.max(0, endX() - W * 0.7));
    camX += (target - camX) * Math.min(1, dt * 5);
  }
  if (state.mode === 'title') camX = (state.t * 10) % 600;
  if (state.mode === 'walk') scout();
  if (state.mode === 'school') hallScout();
  if (state.mode === 'night') skyScout();
  fx = fx.filter((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; return p.t < p.life; });
  flying = flying.filter((f) => { f.t += dt; if (f.t >= f.dur) { f.done(); return false; } return true; });
}

/* ---------- الرسم ---------- */
function draw() {
  if (!scene) return;
  let gy = scene.L.groundY;
  if (state.mode === 'race' && race) {
    race.draw(g, state.t);
    for (const p of fx) { g.globalAlpha = clamp(1 - p.t / p.life, 0, 1); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    g.globalAlpha = 1;
    if (fade > 0) { g.fillStyle = `rgba(20,10,24,${fade})`; g.fillRect(0, 0, W, H); }
    return;
  }
  if (inHall()) drawHall();
  else if (state.mode === 'class') { g.drawImage(room.img, 0, 0); gy = room.fy + 6 - Math.round(H * 0.11); }
  else {
    scene.draw(g, camX, state.t, state.dusk);
    if (STREET.includes(state.mode)) drawStreet(gy);
    if (state.mode === 'night' || state.mode === 'msg' || state.mode === 'win') drawStars();
  }
  // الشعاع من الشخصية إلى النجم
  if (beam) {
    g.fillStyle = '#fff3c4';
    const n = 40;
    for (let i = 0; i < n * beam.k; i++) { const k = i / n; const x = beam.x0 + (beam.x1 - beam.x0) * k, y = beam.y0 + (beam.y1 - beam.y0) * k - Math.sin(k * Math.PI) * 20; if ((i + Math.floor(state.t * 20)) % 3) g.fillRect(Math.round(x), Math.round(y), 2, 2); }
  }
  // اللاعب
  if (state.mode !== 'title' && state.mode !== 'load') {
    const f = player.raise ? 6 : player.cheer ? 5 : player.moving ? Math.floor(player.walk) % 4 : 4;
    const img = frames[f], w = 24 * K, h = img.height * K;
    const sx = Math.round(player.x - camX - w / 2), sy = gy + Math.round(H * 0.11) - h;
    g.fillStyle = 'rgba(40,24,40,0.35)'; g.fillRect(sx + 4 * K, sy + h - 2 * K, w - 8 * K, 3 * K);     // الظل
    if (player.dir < 0) { g.save(); g.translate(sx + w, sy); g.scale(-1, 1); g.drawImage(img, 0, 0, w, h); g.restore(); }
    else g.drawImage(img, sx, sy, w, h);
    // الكتاب المرفوع فوق الرأس: تمسكه اليدان من أسفله
    const bk = $('pbook');
    if (player.raise && !bk.hidden) bk.style.transform = `translate(-50%, -100%) translate(${(player.x - camX) * S}px, ${(sy + 2 * K) * S}px)`;
  }
  for (const p of fx) { g.globalAlpha = clamp(1 - p.t / p.life, 0, 1); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
  g.globalAlpha = 1;
  for (const f of flying) {
    const k = clamp(f.t / f.dur, 0, 1), e = 1 - (1 - k) * (1 - k);
    const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * H * 0.08;
    g.drawImage(f.img, Math.round(x - f.img.width / 2), Math.round(y - f.img.height / 2));
  }
  if (fade > 0) { g.fillStyle = `rgba(20,10,24,${fade})`; g.fillRect(0, 0, W, H); }
}

function drawStreet(gy) {
  const base = gy + Math.round(H * 0.045), labels = state.mode === 'walk' || state.mode === 'intro' || state.mode === 'dress';
  // المدرسة
  if (school) {
    const img = school.art.img, sx = Math.round(school.x - camX - img.width / 2), sy = base - img.height;
    if (sx > -img.width && sx < W) {
      g.drawImage(img, sx, sy);
      if (labels) {
        const t = tag('school', `<b>${state.game.school || 'المدرسة'}</b>`, 'plate');
        t.style.visibility = ''; t.classList.toggle('near', near === school && state.mode === 'walk');
        t.onclick = () => state.mode === 'walk' && enterSchool();
        place(t, school.x - camX, sy + school.art.sign.y + 2);
      } else hideTag('school');
    } else hideTag('school');
  }
  // أكشاك المواد
  for (const b of booths) {
    const sx = Math.round(b.x - camX - b.img.width / 2), sy = base - b.img.height;
    if (sx < -b.img.width || sx > W) { hideTag('b' + b.name); continue; }
    g.drawImage(b.img, sx, sy);
    // البطاقات المعروضة في نافذة الكشك بعد فتحه
    b.shown.forEach((c, i) => { const img = c.gold ? cardGold1 : cardPlain1(b.color); g.drawImage(img, sx + (11 + i * 8) * b.u, sy + 20 * b.u); });
    if (b.open < 1) {
      const s = b.sh, hgt = Math.round(s.img.height * (1 - b.open));
      if (hgt > 0) g.drawImage(s.img, 0, s.img.height - hgt, s.img.width, hgt, sx + s.x, sy + s.y, s.img.width, hgt);
    }
    if (state.mode === 'walk') {
      const open = b.open >= 1, n = b.teachers.length;
      const t2 = tag('b' + b.name, `<b>${b.name}</b><small>${open ? 'مفتوح' : 'مقفل'} · ${b.all ? 'أي معلّم' : teacherCount(n)}</small>`, b.all ? 'gold' : '');
      t2.style.visibility = ''; t2.onclick = () => boothTap(b);
      t2.classList.toggle('near', near === b);
      t2.classList.toggle('target', fits(b) && near !== b);
      t2.classList.toggle('open', open);
      place(t2, b.x - camX, sy - Math.round(H * 0.015));
    } else hideTag('b' + b.name);
  }
}
const cardCache = new Map();
const cardPlain1 = (color) => { if (!cardCache.has(color)) cardCache.set(color, cardSprite(1, false, color)); return cardCache.get(color); };
const cardGold1 = cardSprite(1, true);

function drawHall() {
  const gap = hall.seg.width, origin = doors[0].x - gap / 2;
  let x = -((((camX - origin) % gap) + gap) % gap);
  for (; x < W; x += gap) g.drawImage(hall.seg, Math.round(x), 0);
  for (const d of doors) {
    const sx = Math.round(d.x - camX - d.img.width / 2), sy = hall.fy - d.img.height + 2;
    if (sx < -d.img.width || sx > W) { hideTag('d' + d.name); continue; }
    g.drawImage(d.img, sx, sy);
    if (state.mode === 'school') {
      const t = tag('d' + d.name, d.exit ? '<b>خروج</b><small>إلى الكورنيش</small>' : d.library ? '<b>المكتبة</b><small>كل المواد</small>' : `<b>فصل ${d.name}</b>`, d.exit ? 'exit' : d.library ? 'gold' : '');
      t.style.visibility = ''; t.classList.toggle('near', hallNear === d); t.onclick = () => doorTap(d);
      place(t, d.x - camX, sy - 4);
    } else hideTag('d' + d.name);
  }
}

function drawStars() {
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
  unlock();
  state.mode = 'intro';
  camX = 0; player.x = -30; player.auto = W * 0.42; player.dir = 1;
  setStage('KW 1-1', 'الكورنيش');
  const line = el('p', { class: 'px-line' });
  const next = pxBtn('التالي ▸', null, 'small');
  say(el('p', { class: 'px-who' }, 'الراوي'), line, el('div', { class: 'px-acts' }, next));
  const lines = ['لكل طالب كتاب، ولكل معلّم نجمة تنتظر من يضيئها.',
    'أكشاك المواد على الكورنيش مقفلة، ومفاتيحها بطاقات من المدرسة. ادخل فصل مادتك، وجاوب، وخذ بطاقاتك.',
    'سلّم البطاقات لكشك المادة لينفتح، ثم اختر نجم معلّمك، واكتب كلمتك في كتابك.'];
  for (const l of lines) {
    let go; const p = new Promise((r) => { go = r; });
    next.onclick = go; onPress = go;
    await typewrite(line, l);
    await Promise.race([p, sleep(calm ? 1500 : 4200)]);
  }
  dress();
}

/* ======================================================================
   جهّز شخصيتك
   ====================================================================== */
function dress() {
  state.mode = 'dress';
  player.auto = null;
  const row = (label, items) => el('div', { class: 'px-row' }, el('span', { class: 'px-label' }, label), el('div', { class: 'px-opts' }, items));
  const opt = (cur, val, attrs, content, apply) => el('button', {
    type: 'button', 'aria-pressed': String(cur === val), ...attrs,
    onclick: (e) => { apply(); frames = playerFrames(state.look); try { localStorage.setItem('px-look', JSON.stringify(state.look)); } catch {}; e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
  }, content);
  say(el('p', { class: 'px-who' }, 'جهّز شخصيتك'),
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
   KW 1-1: الكورنيش، المدرسة، وأكشاك المواد
   ====================================================================== */
let near = null;
const fits = (b) => state.cards.length > 0 && b.open < 1 && (b.all || b.name === state.cardsFor);
function walk() {
  state.mode = 'walk';
  setStage('KW 1-1', 'الكورنيش');
  showPad(true);
  near = undefined;
  scout();
}
function scout() {
  let now = null, bestD = Infinity;
  if (school) { const d = Math.abs(school.x - player.x); if (d < school.art.img.width * 0.42) { now = school; bestD = d; } }
  for (const b of booths) { const d = Math.abs(b.x - player.x); if (d < 42 * (H / 422) + 14 && d < bestD) { now = b; bestD = d; } }
  if (now === near) return;
  near = now;
  if (now === school) schoolDialog();
  else if (now) boothDialog(now);
  else streetDialog();
}
/** امشِ إلى مكان ثم افتح حواره */
async function goTo(x) {
  if (state.mode !== 'walk') return;
  hush(); onPress = null; near = null;
  state.mode = 'busy';
  await walkTo(x);
  state.mode = 'walk'; near = undefined;
}
function streetDialog() {
  const tb = targetBooth();
  if (state.cards.length && tb && tb.open < 1) {
    say(el('p', { class: 'px-who' }, 'KW 1-1 · الكورنيش'),
      el('p', { class: 'px-line' }, `معك ${cardWord(state.cards.length)}. سلّمها لكشك ${tb.name} لينفتح.`),
      el('div', { class: 'px-acts' }, pxBtn(`امشِ إلى كشك ${tb.name} (A)`, () => goTo(tb.x), 'go')));
    onPress = () => goTo(tb.x);
    return;
  }
  const opened = booths.filter((b) => b.open >= 1);
  const list = el('div', { class: 'px-list', hidden: true }, booths.map((b) => pxBtn(b.name, () => goTo(b.x), 'small')));
  say(el('p', { class: 'px-who' }, 'KW 1-1 · الكورنيش'),
    el('p', { class: 'px-line' }, opened.length ? `كشك ${opened.map((b) => b.name).join(' و')} مفتوح. ادخله واختر معلّمك.` : 'امشِ بالأسهم ◀ ▶. الأكشاك مقفلة، ومفاتيحها بطاقات من المدرسة.'),
    el('div', { class: 'px-acts' }, opened.length ? pxBtn(`امشِ إلى كشك ${opened[0].name} (A)`, () => goTo(opened[0].x), 'go') : pxBtn('امشِ إلى المدرسة (A)', () => goTo(school.x), 'go')),
    el('button', { class: 'px-link', type: 'button', onclick: (e) => { list.hidden = !list.hidden; e.currentTarget.textContent = list.hidden ? 'أو امشِ إلى كشك من القائمة' : 'أخفِ القائمة'; } }, 'أو امشِ إلى كشك من القائمة'),
    list);
  onPress = opened.length ? () => goTo(opened[0].x) : () => goTo(school.x);
}
function schoolDialog() {
  const tb = targetBooth(), name = state.game.school || 'المدرسة';
  if (state.cards.length && tb && tb.open < 1) {
    say(el('p', { class: 'px-who' }, name),
      el('p', { class: 'px-big' }, `معك ${cardWord(state.cards.length)}`),
      el('p', { class: 'px-line' }, `سلّمها لكشك ${tb.name} على الكورنيش لينفتح.`),
      el('div', { class: 'px-acts' }, pxBtn(`امشِ إلى كشك ${tb.name} (A)`, () => goTo(tb.x), 'go'), pxBtn('ادخل المدرسة', enterSchool)));
    onPress = () => goTo(tb.x);
    return;
  }
  say(el('p', { class: 'px-who' }, 'المدرسة'),
    el('p', { class: 'px-big' }, name),
    el('p', { class: 'px-line' }, 'ادخل، واختر فصل مادتك، وجاوب أسئلة السبّورة. كل إجابة بطاقة، والصحيحة ذهبية.'),
    el('div', { class: 'px-acts' }, pxBtn('ادخل المدرسة (A)', enterSchool, 'go')));
  onPress = enterSchool;
}
function boothDialog(b) {
  if (!state.scouted.has(b.name)) { state.scouted.add(b.name); state.score += 100; setScore(); }
  const names = shuffle(b.teachers).slice(0, 4).map((t) => t.name);
  const who = b.all ? 'من هنا ترى سماء المدرسة كلها، وفيها كل المعلّمين.' : `${teacherCount(b.teachers.length)}: ${names.join('، ')}${b.teachers.length > 4 ? '…' : ''}`;
  const title = b.all ? 'كشك كل المعلّمين' : `كشك ${b.name}`;
  if (b.open >= 1) {
    say(el('p', { class: 'px-who' }, 'الكشك مفتوح'), el('p', { class: 'px-big' }, title), el('p', { class: 'px-line' }, who),
      el('div', { class: 'px-acts' }, pxBtn('اختر معلّمك تحت النجوم (A)', () => toNight(b), 'go')));
    onPress = () => toNight(b);
  } else if (fits(b)) {
    say(el('p', { class: 'px-who' }, 'الكشك مقفل'), el('p', { class: 'px-big' }, title), el('p', { class: 'px-line' }, who),
      el('div', { class: 'px-acts' }, pxBtn(`سلّم ${cardWord(state.cards.length)} (A)`, () => deliver(b), 'go')));
    onPress = () => deliver(b);
  } else {
    const tb = targetBooth(), has = state.cards.length && tb && tb.open < 1;
    say(el('p', { class: 'px-who' }, 'الكشك مقفل'), el('p', { class: 'px-big' }, title), el('p', { class: 'px-line' }, who),
      el('p', { class: 'px-line small' }, has ? `بطاقاتك لكشك ${tb.name}.` : b.all ? 'يفتحه أي نوع من البطاقات؛ خذها من المدرسة.' : `مفتاحه بطاقات من فصل ${b.name} في المدرسة.`),
      el('div', { class: 'px-acts' }, has ? pxBtn(`امشِ إلى كشك ${tb.name} (A)`, () => goTo(tb.x), 'go') : pxBtn('امشِ إلى المدرسة (A)', () => goTo(school.x), 'go')));
    onPress = has ? () => goTo(tb.x) : () => goTo(school.x);
  }
}
function boothTap(b) {
  if (state.mode !== 'walk') return;
  if (near === b) return (b.open >= 1 ? toNight(b) : fits(b) ? deliver(b) : null);
  goTo(b.x);
}

/* ---------- تسليم البطاقات: تطير إلى الكشك ويرتفع بابه ---------- */
async function deliver(b) {
  if (state.mode !== 'walk' || !fits(b)) return;
  state.mode = 'busy'; hush(); showPad(false); onPress = null;
  await walkTo(b.x - 44 * (H / 422));   // يقف جانب الكشك كي يُرى الباب وهو يرتفع
  player.dir = 1;
  const gy = scene.L.groundY, base = gy + Math.round(H * 0.045), sy = base - b.img.height;
  const cards = state.cards.slice();
  for (let i = 0; i < cards.length; i++) {
    const img = cardSprite(K, cards[i].gold, b.color);
    sfx.card();
    const p = fly(img, player.x - camX, gy + Math.round(H * 0.11) - 30 * K, b.x - camX - 13 * b.u + i * 8 * b.u, sy + 24 * b.u, 0.55);
    await sleep(calm ? 10 : 170);
    if (i === cards.length - 1) await p;
  }
  state.boothAnswers[b.name] = state.answers;
  state.cards = []; setCards();
  b.shown = cards.slice(0, 3);
  sfx.shutter();
  for (let k = 1; k <= 20; k++) { b.open = k / 20; await sleep(calm ? 5 : 32); }
  voice('open');
  const colors = ['#f6d79a', '#e9b44c', '#fffaf0', b.color];
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, v = 25 + Math.random() * 30; fx.push({ x: b.x - camX, y: sy + 10 * b.u, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: 0, life: 1, c: colors[i % colors.length] }); }
  state.score += 300; setScore();
  state.mode = 'walk'; showPad(true); near = undefined;
}

/* ======================================================================
   KW 1-2: المدرسة، الممرّ، والفصل
   ====================================================================== */
let streetX = 0, hallNear = null;
async function enterSchool() {
  if (state.mode !== 'walk') return;
  state.mode = 'busy'; hush(); clearTags(); showPad(false); onPress = null;
  await walkTo(school.x);
  sfx.door();
  streetX = player.x;
  await wipe(() => { state.mode = 'hall-busy'; player.x = doors[0].x + 34; player.dir = 1; camX = 0; setStage('KW 1-2', 'المدرسة'); });
  toHall();
}
function toHall() {
  state.mode = 'school'; showPad(true); hallNear = undefined;
}
function hallScout() {
  let best = null;
  for (const d of doors) { const dd = Math.abs(d.x - player.x); if (dd < hall.dw * 0.6 && (!best || dd < best.dd)) best = { d, dd }; }
  const now = best ? best.d : null;
  if (now === hallNear) return;
  hallNear = now;
  if (!now) {
    const list = el('div', { class: 'px-list', hidden: true }, doors.filter((d) => !d.exit).map((d) => pxBtn(d.library ? 'المكتبة' : `فصل ${d.name}`, () => doorTap(d, true), 'small')));
    say(el('p', { class: 'px-who' }, 'KW 1-2 · المدرسة'),
      el('p', { class: 'px-line' }, 'امشِ في الممرّ. كل باب فصل مادة؛ ادخل فصل مادتك.'),
      el('button', { class: 'px-link', type: 'button', onclick: (e) => { list.hidden = !list.hidden; e.currentTarget.textContent = list.hidden ? 'أو اختر الفصل من القائمة' : 'أخفِ القائمة'; } }, 'أو اختر الفصل من القائمة'),
      list);
    onPress = null;
    return;
  }
  if (now.exit) {
    say(el('p', { class: 'px-who' }, 'الممرّ'), el('p', { class: 'px-big' }, 'باب الخروج'), el('p', { class: 'px-line' }, 'يرجعك إلى الكورنيش.'),
      el('div', { class: 'px-acts' }, pxBtn('اخرج (A)', leaveSchool, 'go')));
    onPress = leaveSchool;
    return;
  }
  const q = Math.min(3, now.questions || 0);
  const swap = state.cards.length ? el('p', { class: 'px-line small' }, `معك ${cardWord(state.cards.length)}؛ بطاقات هذا الفصل تحلّ محلّها.`) : null;
  say(el('p', { class: 'px-who' }, 'KW 1-2 · المدرسة'),
    el('p', { class: 'px-big' }, now.library ? 'المكتبة' : `فصل ${now.name}`),
    el('p', { class: 'px-line' }, (q ? `${q === 1 ? 'سؤال واحد' : q === 2 ? 'سؤالان' : '3 أسئلة'} على السبّورة. كل إجابة بطاقة، والصحيحة ذهبية.` : 'لا أسئلة هنا بعد؛ تأخذ بطاقة حضور.')
      + (now.library ? ' بطاقاتها تفتح كشك «كل المعلّمين».' : '')),
    swap,
    el('div', { class: 'px-acts' }, pxBtn(now.library ? 'ادخل المكتبة (A)' : 'ادخل الفصل (A)', () => enterClass(now), 'go')));
  onPress = () => enterClass(now);
}
function doorTap(d, fromList) {
  if (state.mode !== 'school') return;
  if (d.exit) return leaveSchool();
  if (hallNear === d || fromList) return enterClass(d);
  enterClass(d);
}
let race = null, retries = 0, classDoor = null, classQs = [], raceStartScore = 0;
async function enterClass(d) {
  if (state.mode !== 'school') return;
  state.mode = 'hall-busy'; hush(); clearTags(); showPad(false); onPress = null;
  await walkTo(d.x);
  sfx.door();
  const req = api('/api/game/questions?subject=' + encodeURIComponent(d.subject || '')).catch(() => ({ items: [] }));
  await wipe(() => { state.mode = 'class'; player.x = Math.round(W * (tall() ? 0.2 : 0.5)); player.dir = 1; camX = 0; setStage('KW 1-2', d.library ? 'المكتبة' : `فصل ${d.name}`); });
  classQs = (await req).items || []; classDoor = d; retries = 0;
  briefing();
}
function boardSay(...kids) {
  const board = $('board'), bd = room.board;
  Object.assign(board.style, { left: bd.x * S + 'px', top: bd.y * S + 'px', width: bd.w * S + 'px', height: bd.h * S + 'px' });
  board.replaceChildren(...kids); board.hidden = false;
}
const className = () => (classDoor.library ? 'المكتبة' : classDoor.name);
/** تعريف بالتحدّي على السبّورة */
function briefing() {
  boardSay(el('small', {}, `تحدّي ${className()}`), el('span', {}, 'اسبق «الغش» و«الكسل» إلى خط النهاية'));
  const n = Math.min(3, classQs.length);
  say(el('p', { class: 'px-who' }, 'KW 1-2 · تحدّي المادة'),
    el('p', { class: 'px-big' }, `سباق ${className()}`),
    el('p', { class: 'px-line' }, '▲▼ لتغيير المسار، وA للقفز. تجنّب أصحاب السوء والجوال وورقة الغش والسهر، واجمع الكتب والنجوم.'),
    n ? el('p', { class: 'px-line small' }, `في الطريق ${n === 1 ? 'بوابة سؤال' : n === 2 ? 'بوابتا أسئلة' : '3 بوابات أسئلة'}: ادخل مسار الإجابة الصحيحة لتنطلق أسرع وتأخذ بطاقة ذهبية.`) : null,
    el('div', { class: 'px-acts' }, pxBtn('انطلق (A)', startRace, 'go'), pxBtn('فصل آخر', backToHall)));
  onPress = startRace;
}
async function startRace() {
  if (state.mode !== 'class') return;
  hush(); onPress = null;
  state.cards = []; state.answers = {}; state.cardsFor = classDoor.library ? ALL : classDoor.subject; setCards();
  raceStartScore = state.score;
  await wipe(() => {
    $('board').hidden = true;
    state.mode = 'race'; setStage('KW 1-2', `سباق ${className()}`);
    race = createRace({
      W, H, scene, look: state.look, questions: classQs, retries, sound: { sfx, voice, engine },
      ui: {
        banner: $('raceq'),
        score: (n) => { state.score += n; setScore(); },
        gate: async (q, lane) => {
          state.answers[q.id] = lane;
          const r = await api('/api/game/check', { id: q.id, choice: lane }).catch(() => null);
          state.cards.push({ gold: !!(r && r.correct) }); setCards(); sfx.card();
          return r;
        },
        tag: (key, html, cls, x, y, vis) => { if (!vis || !html) return hideTag(key); const t = tag(key, html, cls); t.style.visibility = ''; place(t, x, y); },
        finish: (rank, ahead) => raceOver(rank, ahead),
      },
    });
  });
  setPad(true); showPad(true);
  onPress = () => race && race.jump();
}
async function raceOver(rank, ahead = []) {
  onPress = null; showPad(false);
  race.stop();
  const won = rank === 1;
  if (won) {
    voice('win');
    if (!state.cards.length) { state.cards.push({ gold: false }); setCards(); }
    state.score += 1000; setScore();
    const colors = ['#f6d79a', '#e9b44c', '#5fcf86', '#ffffff'];
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2, v = 30 + Math.random() * 40; fx.push({ x: W * 0.3, y: H * 0.45, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: 0, life: 1.3, c: colors[i % 4] }); }
    await sleep(calm ? 100 : 1000);
  } else voice('again');
  await wipe(() => { clearTags(); race = null; setPad(false); state.mode = 'class'; camX = 0; setStage('KW 1-2', classDoor.library ? 'المكتبة' : `فصل ${classDoor.name}`); });
  const tb = targetBooth();
  if (won) {
    const golds = state.cards.filter((c) => c.gold).length;
    boardSay(el('small', {}, 'المركز الأول'), el('span', {}, `فزت! سبقت الغش والكسل${golds ? ` · ${goldWord(golds, true)}` : ''}`));
    say(el('p', { class: 'px-who' }, `KW 1-2 · سباق ${className()}`),
      el('p', { class: 'px-big' }, `أخذت ${cardWord(state.cards.length)}`),
      el('p', { class: 'px-line' }, `${golds ? `منها ${goldWord(golds, true)}. ` : ''}سلّمها لكشك ${tb ? tb.name : ALL} على الكورنيش لينفتح.`),
      el('div', { class: 'px-acts' }, pxBtn('اخرج إلى الكورنيش (A)', leaveSchool, 'go'), pxBtn('فصل آخر', backToHall)));
    onPress = leaveSchool;
  } else {
    retries++;
    state.score = raceStartScore; setScore();
    state.cards = []; setCards();
    const who = ahead.length > 1 ? 'الغش والكسل' : ahead[0] || 'الغش';
    boardSay(el('small', {}, `المركز ${rank === 2 ? 'الثاني' : 'الثالث'}`), el('span', {}, `${who} ${ahead.length > 1 ? 'وصلا' : 'وصل'} قبلك هذه المرة`));
    say(el('p', { class: 'px-who' }, `KW 1-2 · سباق ${className()}`),
      el('p', { class: 'px-big' }, 'لا تستسلم!'),
      el('p', { class: 'px-line' }, 'تجنّب العقبات وادخل مسار الإجابة الصحيحة لتنطلق أسرع. المحاولة الجاية أسهل شوي.'),
      el('div', { class: 'px-acts' }, pxBtn('حاول مرة ثانية (A)', startRace, 'go'), pxBtn('فصل آخر', backToHall)));
    onPress = startRace;
  }
}
async function backToHall() {
  if (state.mode !== 'class') return;
  hush(); onPress = null;
  const d = classDoor || doors.find((x) => x.library);
  await wipe(() => { $('board').hidden = true; state.mode = 'hall-busy'; player.x = d.x; camX = clamp(player.x - W * 0.38, 0, Math.max(0, hallEnd - W * 0.7)); setStage('KW 1-2', 'المدرسة'); });
  toHall();
}
async function leaveSchool() {
  if (state.mode !== 'school' && state.mode !== 'class') return;
  const from = state.mode;
  hush(); clearTags(); showPad(false); onPress = null;
  if (from === 'school') { state.mode = 'hall-busy'; await walkTo(doors[0].x); }
  await wipe(() => {
    $('board').hidden = true;
    state.mode = 'busy'; player.x = streetX || school.x; player.dir = 1;
    camX = clamp(player.x - W * 0.38, 0, Math.max(0, streetEnd - W * 0.7));
    setStage('KW 1-1', 'الكورنيش');
  });
  walk();
}

/* ======================================================================
   KW 1-3: الليل ونجوم المعلّمين
   ====================================================================== */
let pick = null, skyNear = null, beam = null;
async function toNight(b) {
  if (state.mode !== 'walk' || b.open < 1) return;
  state.subject = b;
  state.mode = 'busy'; hush(); showPad(false); onPress = null;
  await walkTo(b.x);
  night();
}
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
  // يختار الطالب من معلّمي المدرسة كما أضافتهم الإدارة، بلا بحث
  const names = list.slice().sort((x, y) => x.name.localeCompare(y.name, 'ar'));
  say(el('p', { class: 'px-who' }, 'KW 1-3 · السماء'),
    el('p', { class: 'px-line' }, 'كل نجم معلّم. امشِ تحت النجوم واضغط A، أو اختر أفضل معلّم عندك من القائمة.'),
    el('div', { class: 'px-list' }, names.map((t) => pxBtn(t.name, () => choose(stars.find((s) => s.t.id === t.id) || addStar(t)), 'small'))),
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
  clearTags(); hush();
  state.mode = 'busy';
  for (let k = 30; k >= 0; k--) { state.dusk = k / 30; await sleep(calm ? 5 : 25); }
  stars = []; walk();
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
  const send = pxBtn('ارفع كتابك ★', () => finale(ta.value.trim(), send), 'go');
  say(el('p', { class: 'px-who' }, 'KW 1-4 · كتابك'),
    el('div', { class: 'px-bookpage' }, el('p', { class: 'px-bookstar', 'aria-hidden': 'true' }, '★'), el('p', { class: 'px-big' }, pick.t.name),
      el('label', { class: 'px-line small', for: 'reason' }, 'اكتب كلمتك تحت النجمة: لماذا اخترته؟ (اختياري)'), ta, count),
    el('div', { class: 'px-acts' }, send, pxBtn('غيّر', () => { state.mode = 'night'; setStage('KW 1-3', 'السماء'); stars.forEach((o) => { o.dim = false; }); pick = null; showPad(true); skyDialog(state.subject.teachers); })));
  onPress = null;
}
async function finale(reason, btn) {
  btn.disabled = true;
  let r;
  try {
    r = await api('/api/vote', { teacherId: state.teacher.id, name: state.teacher.name, reason, subject: state.subject.all ? '' : state.subject.name, answers: state.boothAnswers[state.subject.name] || {}, look: state.look, score: state.score });
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
  // شعاع من الشخصية إلى النجم
  const gy = scene.L.groundY, x0 = player.x - camX, y0 = gy + Math.round(H * 0.11) - 48 * K;
  beam = { x0, y0, x1: pick.sx, y1: pick.sy, k: 0 };
  for (let k = 0; k <= 30; k++) { beam.k = k / 30; await sleep(calm ? 5 : 35); }
  pick.lit = true; beam = null; voice('bless');
  player.dir = 1; player.raise = true;
  const bk = $('pbook');
  bk.replaceChildren(el('span', { class: 'star', 'aria-hidden': 'true' }, '★'), el('b', {}, state.teacher.name), reason ? el('span', { class: 'msg' }, reason) : null);
  bk.hidden = false;
  state.score += 1000; setScore();
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
  $('clear-sub').textContent = `${p ? `وأهديته ${goldWord(p)}. ` : ''}رفعت كتابك، وصرت في الصورة الجماعية.`;
  $('clear-score').textContent = String(state.score).padStart(4, '0');
}
function ended(title, text) {
  state.mode = 'ended'; showPad(false); $('title').hidden = true;
  say(el('p', { class: 'px-who' }, 'المعلّم النجم'), el('p', { class: 'px-big' }, title), el('p', { class: 'px-line' }, text),
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
window.__px = { state, player, input, get booths() { return booths; }, get stars() { return stars; }, get school() { return school; }, get doors() { return doors; }, get race() { return race; } };
