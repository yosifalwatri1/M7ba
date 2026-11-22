/* رحلة «نجمك يا معلّم»
   مشهد سينمائي ← النوخذة يجهّز شخصيته وسفينته ← يبحر بحرية ويستطلع الجزر ← يرسو على جزيرة مادته
   ← الغوص (اختياري) ← يستطلع السماء بالمنظار ويختار نجم معلّمه ← الرسالة ← الوصول */
import * as THREE from 'three';
import { createWorld, makeDhow, paintSail, makeIsland, makeTeacherStar, tween, waveHeight, glowTexture, webglSupported } from './world.js';
import { crewTheDhow, LOOKS } from './crew.js';

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
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pearlWord = (n) => (n === 1 ? 'لؤلؤة واحدة' : n === 2 ? 'لؤلؤتين' : `${n} لآلئ`);
const teacherCount = (n) => `${n} ${n > 10 ? 'معلّماً' : n > 2 ? 'معلّمين' : n === 2 ? 'معلّمان' : 'معلّم'}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

if (!webglSupported()) location.replace('/?quick=1');

async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'حدث خطأ. حاول مجدداً.'), { status: res.status });
  return data;
}

/* ---------- الحالة ---------- */
const saved = (() => { try { return JSON.parse(localStorage.getItem('nakhuda') || '{}'); } catch { return {}; } })();
const state = {
  color: saved.color || '#f3efe4',
  look: { gear: saved.gear || 'ghutra', skin: saved.skin || LOOKS.skin[1], outfit: saved.outfit || LOOKS.outfit[0][0] },
  subject: null, teacher: null, answers: {}, pearls: 0, game: null, mode: 'intro',
};
const remember = () => { try { localStorage.setItem('nakhuda', JSON.stringify({ color: state.color, ...state.look })); } catch {} };
const SAILS = [['#f3efe4', 'أبيض'], ['#e9b44c', 'ذهبي'], ['#c8453b', 'أحمر'], ['#2f7fbf', 'أزرق'], ['#3f9d6a', 'أخضر'], ['#7a4fa3', 'بنفسجي']];

/* ---------- العالم، السفينة، الطاقم ---------- */
const world = createWorld($('world'));
const dhow = makeDhow();
world.scene.add(dhow);
const crew = crewTheDhow(dhow, state.look);
const captain = crew.captain.userData.avatar;
const boat = { x: 0, z: 0, heading: 0, steer: 0 };
world.onFrame.add((dt, t) => {
  const y = waveHeight(boat.x, boat.z, t) * 0.7 + 0.15;
  dhow.position.set(boat.x, y, boat.z);
  dhow.rotation.set(Math.sin(t * 0.9) * 0.03, -boat.heading, Math.sin(t * 1.3) * 0.05 - boat.steer * 0.06, 'YXZ');
  captain.update(t, boat.steer);
  for (const s of crew.sailors) s.userData.avatar.update(t);
  const w = crew.wheel.userData.wheel;
  w.rotation.z += ((-boat.steer * 2.2) - w.rotation.z) * Math.min(1, dt * 6);
});
const fwd = (a) => new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
const side = (a) => new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
const boatPos = () => new THREE.Vector3(boat.x, 0, boat.z);
const captainHead = () => dhow.localToWorld(new THREE.Vector3(0, 3.1, 2.75));

// أثر السفينة على الماء
(() => {
  const n = 110, pos = new Float32Array(n * 3).fill(-50), life = new Float32Array(n);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  world.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'), size: 1.6, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
  let i = 0, acc = 0, last = boatPos();
  world.onFrame.add((dt) => {
    const now = boatPos(), moving = now.distanceTo(last) > 0.01;
    last = now; acc += dt;
    if (moving && acc > 0.03) {
      acc = 0;
      const back = fwd(boat.heading).multiplyScalar(-4.4).add(now);
      for (const s of [-1, 1]) {
        const o = side(boat.heading).multiplyScalar(s * (0.6 + Math.random() * 0.6));
        pos.set([back.x + o.x, 0.35, back.z + o.z], i * 3); life[i] = 1; i = (i + 1) % n;
      }
    }
    for (let k = 0; k < n; k++) if (life[k] > 0) { life[k] -= dt * 0.5; if (life[k] <= 0) pos[k * 3 + 1] = -50; }
    geo.attributes.position.needsUpdate = true;
  });
})();

/* ---------- الكاميرا ---------- */
const cam = { pos: new THREE.Vector3(-30, 60, -50), look: new THREE.Vector3(26, 24, 78), fov: null };
world.onFrame.add(() => { world.camera.position.copy(cam.pos); world.camera.lookAt(cam.look); });
function moveCam(pos, look, ms = 1800) {
  const p0 = cam.pos.clone(), l0 = cam.look.clone();
  return tween(world, ms, (e) => { cam.pos.lerpVectors(p0, pos, e); cam.look.lerpVectors(l0, look, e); });
}
const chase = (back = 15, up = 6.5) => ({
  pos: boatPos().add(fwd(boat.heading).multiplyScalar(-back)).add(new THREE.Vector3(0, up, 0)),
  look: boatPos().add(fwd(boat.heading).multiplyScalar(25)).add(new THREE.Vector3(0, 2, 0)),
});
const setFov = (f, ms = 500) => { const f0 = world.camera.fov; return tween(world, ms, (e) => { world.camera.fov = f0 + (f - f0) * e; world.camera.updateProjectionMatrix(); }); };

/** تبحر السفينة على منحنى ناعم إلى نقطة، والكاميرا تتبعها */
function sailTo(target, ms = 3800) {
  const start = boatPos(), dist = target.clone().sub(start).length();
  const curve = new THREE.QuadraticBezierCurve3(start, start.clone().add(fwd(boat.heading).multiplyScalar(dist * 0.45)), target);
  const camFn = () => { const c = chase(); cam.pos.lerp(c.pos, 0.06); cam.look.lerp(c.look, 0.08); };
  world.onFrame.add(camFn);
  let prevH = boat.heading;
  return tween(world, ms, (e) => {
    const p = curve.getPoint(e), tan = curve.getTangent(Math.min(e, 0.999));
    boat.x = p.x; boat.z = p.z; boat.heading = Math.atan2(tan.x, -tan.z);
    boat.steer = clamp((boat.heading - prevH) * 30, -1, 1); prevH = boat.heading;
  }).then(() => { world.onFrame.delete(camFn); boat.steer = 0; });
}

/* ---------- تسميات ثلاثية الأبعاد ---------- */
const labels = new Set();
function label3d(anchor, content, onClick, cls = '') {
  const b = el(onClick ? 'button' : 'span', { class: 'tag ' + cls, type: onClick ? 'button' : null, onclick: onClick }, content);
  $('labels').append(b);
  const item = { b, anchor };
  labels.add(item);
  return item;
}
function clearLabels() { for (const l of labels) l.b.remove(); labels.clear(); }
const v3 = new THREE.Vector3();
world.onFrame.add(() => {
  const w = innerWidth, h = innerHeight;
  for (const l of labels) {
    v3.copy(typeof l.anchor === 'function' ? l.anchor() : l.anchor).project(world.camera);
    const off = v3.z > 1 || Math.abs(v3.x) > 1.2 || Math.abs(v3.y) > 1.2;
    l.b.style.visibility = off ? 'hidden' : '';
    if (off) continue;
    l.b.style.transform = `translate(-50%, -100%) translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h}px)`;
    if (state.mode === 'sky') l.b.classList.toggle('near', Math.hypot(v3.x * world.camera.aspect, v3.y - 0.25) < (state.spy ? 0.35 : 0.22));
  }
});

/* ---------- واجهة الرصيف السفلي ---------- */
const dock = $('dock');
function setDock(...kids) {
  dock.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
  if (!calm && window.Motion) Motion.animate([...dock.children], { opacity: [0, 1], y: [14, 0] }, { delay: Motion.stagger(0.05), duration: 0.4 });
}
function setStep(i) {
  [...document.querySelectorAll('#steps li')].forEach((li, k) => {
    li.classList.toggle('done', k < i); li.classList.toggle('now', k === i);
    if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
}
const head = (eyebrow, title, text) => [el('p', { class: 'eyebrow' }, eyebrow), el('h2', { class: 'display' }, title), text && el('p', { class: 'lede' }, text)];

/* ---------- الجزر: كل مادة جزيرة منتشرة في البحر ---------- */
let islands = [];
function buildIslands() {
  const g = state.game;
  const list = [...g.subjects.map((s) => ({ ...s })), { name: 'كل المعلّمين', teachers: g.teachers, all: true }];
  const n = list.length, span = Math.min(2.3, 0.55 + n * 0.28);
  list.forEach((s, i) => {
    const a = n === 1 ? 0 : -span / 2 + (span * i) / (n - 1);
    const d = [80, 122, 98, 140][i % 4];
    const isl = makeIsland(!!s.all);
    isl.position.set(Math.sin(a) * d, 0, -Math.cos(a) * d - 8);
    isl.rotation.y = Math.random() * Math.PI;
    world.scene.add(isl);
    islands.push({ ...s, mesh: isl });
  });
  world.onFrame.add((dt, t) => islands.forEach((s, i) => { s.mesh.userData.light.material.opacity = 0.7 + Math.sin(t * 2 + i) * 0.3; }));
}

/* ======================================================================
   ١. المشهد السينمائي
   ====================================================================== */
async function cinematic() {
  state.mode = 'cine';
  const cine = $('cine'), cap = $('cine-cap');
  cine.hidden = false;
  requestAnimationFrame(() => cine.classList.add('on'));
  let skipped = false, resolveSkip;
  const skipP = new Promise((r) => { resolveSkip = r; });
  $('cine-skip').onclick = () => { skipped = true; resolveSkip(); };
  const say = (html, big = false) => { cap.classList.remove('show'); setTimeout(() => { cap.innerHTML = html; cap.classList.toggle('big', big); cap.classList.add('show'); }, 250); };
  const cut = async () => { $('cine-fade').classList.add('on'); await sleep(260); $('cine-fade').classList.remove('on'); };

  const path = new THREE.CatmullRomCurve3([[72, 0, 48], [52, 0, 38], [32, 0, 26], [15, 0, 12], [0, 0, 0], [0, 0, -6]].map((p) => new THREE.Vector3(...p)));
  const place = (u) => {
    const p = path.getPoint(u), t = path.getTangent(Math.min(u, 0.995));
    const h = Math.atan2(t.x, -t.z);
    boat.steer = clamp((h - boat.heading) * 25, -1, 1);
    boat.x = p.x; boat.z = p.z; boat.heading = h;
  };
  place(0);
  const shot = (ms, fn) => Promise.race([tween(world, ms, fn), skipP]);

  // اللقطة ١: الكويت من السماء
  say('في زمن البحر…');
  await shot(4300, (e) => {
    const a = -2.35 + e * 0.55;                                        // دوران بطيء حول أبراج الكويت
    cam.pos.set(26 + Math.cos(a) * 78, 30 - 12 * e, 78 + Math.sin(a) * 78); cam.look.set(26, 26 - 4 * e, 78);
  });
  if (!skipped) { await cut(); say('كان «المعلّم» هو من يهدي السفينة بالنجوم'); }
  // اللقطة ٢: البوم يعبر أمام أبراج الكويت
  if (!skipped) await shot(4600, (e) => {
    place(0.42 * e);
    cam.pos.set(49, 2.6 + e * 0.8, 6); cam.look.copy(boatPos()).add(new THREE.Vector3(0, 3 + e * 4, 0));
  });
  if (!skipped) { await cut(); captain.pose = 'wave'; captain.setMood('cheer'); say('واليوم… <b>أنت النوخذة</b>'); }
  // اللقطة ٣: النوخذة يلوّح
  if (!skipped) await shot(4000, (e) => {
    place(0.42 + 0.3 * e);
    const h = captainHead();
    cam.pos.copy(h).add(side(boat.heading).multiplyScalar(2.6 - e * 0.6)).add(fwd(boat.heading).multiplyScalar(4.4 - e * 0.8)).add(new THREE.Vector3(0, 0.3, 0));
    cam.look.copy(h).add(new THREE.Vector3(0, -0.6, 0));
  });
  if (!skipped) { await cut(); captain.pose = 'wheel'; captain.setMood('smile'); say('<span class="cine-title">نجمك يا معلّم</span><span class="cine-sub">أبحر، استكشف الجزر، واختر نجم معلّمك</span>', true); }
  // اللقطة ٤: الكاميرا ترتفع خلف السفينة وتكشف الجزر
  if (!skipped) await shot(4800, (e) => {
    place(0.72 + 0.28 * e);
    cam.pos.copy(boatPos()).add(fwd(boat.heading).multiplyScalar(-10 - 16 * e)).add(new THREE.Vector3(0, 4 + 15 * e, 0));
    cam.look.copy(boatPos()).add(fwd(boat.heading).multiplyScalar(70)).add(new THREE.Vector3(0, 2 - 6 * e, 0));
  });
  // النهاية: السفينة في الميناء متجهة شمالاً
  boat.x = 0; boat.z = 0; boat.heading = 0; boat.steer = 0;
  captain.pose = 'wheel'; captain.setMood('smile');
  cap.classList.remove('show');
  cine.classList.remove('on');
  await sleep(500);
  cine.hidden = true;
}

/* ======================================================================
   ٢. جهّز نوخذتك: الشخصية والشراع
   ====================================================================== */
function outfitter() {
  state.mode = 'port';
  setStep(0);
  clearLabels();
  // الكاميرا أمام النوخذة، ترى وجهه من خلف الدفّة
  const h = captainHead();
  moveCam(h.clone().add(fwd(0).multiplyScalar(4.6)).add(side(0).multiplyScalar(3.4)).add(new THREE.Vector3(0, 0.2, 0)),
    h.clone().add(new THREE.Vector3(0, -1.9, 0)), 1600);
  const row = (label, items) => el('div', { class: 'opt-row' }, el('span', { class: 'opt-label' }, label), el('div', { class: 'opt-items', role: 'group', 'aria-label': label }, items));
  const choice = (group, value, attrs, content, apply) => el('button', {
    type: 'button', 'aria-pressed': String(group === value), ...attrs,
    onclick: (e) => {
      apply(); remember();
      e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      if (!calm && window.Motion) Motion.animate(crew.captain.scale, { x: [0.56, 0.62], y: [0.68, 0.62], z: [0.56, 0.62] }, { type: 'spring', stiffness: 400, damping: 12 });
    },
  }, content);
  setDock(...head('مبادرة معلّمي المفضّل', 'جهّز نوخذتك', 'هذا أنت، قائد السفينة. اختر شكلك ولون شراعك.'),
    row('الرأس', LOOKS.gear.map(([v, n]) => choice(state.look.gear, v, { class: 'opt-text' }, n, () => { state.look.gear = v; captain.setLook({ gear: v }); }))),
    row('البشرة', LOOKS.skin.map((c, i) => choice(state.look.skin, c, { class: 'swatch sm', style: `--c:${c}`, 'aria-label': `لون البشرة ${i + 1}` }, null, () => { state.look.skin = c; captain.setLook({ skin: c }); }))),
    row('الدشداشة', LOOKS.outfit.map(([c, n]) => choice(state.look.outfit, c, { class: 'swatch sm', style: `--c:${c}`, 'aria-label': `دشداشة ${n}` }, null, () => { state.look.outfit = c; captain.setLook({ outfit: c }); }))),
    row('الشراع', SAILS.map(([c, n]) => choice(state.color, c, { class: 'swatch sm', style: `--c:${c}`, 'aria-label': `شراع ${n}` }, null, () => { state.color = c; paintSail(dhow, c); }))),
    el('div', { class: 'acts' }, el('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: explore }, 'أبحر واستكشف')));
}

/* ======================================================================
   ٣. الاستكشاف: النوخذة يوجّه سفينته بحرية ويستطلع الجزر
   ====================================================================== */
const input = { left: false, right: false, drag: 0 };
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowLeft' || e.key === 'a') input.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') input.right = true;
});
addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') input.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') input.right = false;
});
// السحب على المشهد: يوجّه السفينة في الاستكشاف، ويحرّك المنظار في السماء
(() => {
  const c = $('world'); let x0 = null, y0 = null, look0 = null;
  c.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; look0 = { ...state.skyLook }; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', (e) => {
    if (x0 == null) return;
    if (state.mode === 'explore') input.drag = clamp((e.clientX - x0) / 90, -1, 1);
    if (state.mode === 'sky' && state.skyLook) {
      state.skyLook.yaw = clamp(look0.yaw - (e.clientX - x0) / 400, -0.7, 0.7);
      state.skyLook.pitch = clamp(look0.pitch + (e.clientY - y0) / 500, -0.3, 0.45);
    }
  });
  const up = () => { x0 = null; input.drag = 0; };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
})();

let near = null, exploreFn = null;
async function explore() {
  state.mode = 'explore';
  setStep(1);
  if (!state.game.subjects.length) return chooseStar({ name: 'كل المعلّمين', teachers: state.game.teachers, all: true });
  clearLabels();
  for (const s of islands) {
    label3d(() => s.mesh.localToWorld(s.mesh.userData.top.clone()), [el('span', { class: 'tag-name' }, s.name),
      el('span', { class: 'tag-sub' }, s.all ? 'أي معلّم' : teacherCount(s.teachers.length))], () => goIsland(s), s.all ? 'tag-all' : '');
  }
  const c = chase(); await moveCam(c.pos, c.look, 1400);
  near = null; showExploreDock();
  let speed = 0;
  exploreFn = (dt) => {
    let steer = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.drag;
    // حدود البحر: إن ابتعد النوخذة كثيراً تعود السفينة نحو الجزر
    const center = new THREE.Vector3(0, 0, -95), toC = center.clone().sub(boatPos());
    if (toC.length() > 175) {
      const want = Math.atan2(toC.x, -toC.z);
      steer += clamp(Math.atan2(Math.sin(want - boat.heading), Math.cos(want - boat.heading)) * 2, -1, 1);
    }
    steer = clamp(steer, -1, 1);
    boat.steer += (steer - boat.steer) * Math.min(1, dt * 5);
    speed += (11 - speed) * Math.min(1, dt * 0.8);
    boat.heading += boat.steer * 0.95 * dt;
    const step = fwd(boat.heading).multiplyScalar(speed * dt);
    boat.x += step.x; boat.z += step.z;
    // لا تصطدم بالجزر
    let best = null;
    for (const s of islands) {
      const d = boatPos().distanceTo(s.mesh.position);
      const r = s.all ? 15 : 13;
      if (d < r) { const push = boatPos().sub(s.mesh.position).setY(0).normalize().multiplyScalar(r - d); boat.x += push.x; boat.z += push.z; }
      if (d < 34 && (!best || d < best.d)) best = { s, d };
    }
    const ch = chase(); cam.pos.lerp(ch.pos, Math.min(1, dt * 3)); cam.look.lerp(ch.look, Math.min(1, dt * 4));
    const nowNear = best ? best.s : null;
    if (nowNear !== near) { near = nowNear; near ? showScout(near) : showExploreDock(); }
  };
  world.onFrame.add(exploreFn);
}
function stopExplore() { if (exploreFn) world.onFrame.delete(exploreFn); exploreFn = null; input.drag = 0; boat.steer = 0; }

function steerButtons() {
  const hold = (key, label, glyph) => {
    const b = el('button', { class: 'steer', type: 'button', 'aria-label': label, dir: 'ltr' }, glyph);
    const on = (e) => { e.preventDefault(); input[key] = true; }, off = () => { input[key] = false; };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    return b;
  };
  return el('div', { class: 'steer-row' }, hold('right', 'وجّه السفينة يميناً', '›'), el('span', { class: 'steer-hint' }, 'الدفّة'), hold('left', 'وجّه السفينة يساراً', '‹'));
}
function showExploreDock() {
  const list = el('ul', { class: 'choices', hidden: true }, islands.map((s) => el('li', {}, el('button', { type: 'button', onclick: () => goIsland(s) },
    el('span', { class: 'nm' }, s.name), el('span', { class: 'pick' }, s.all ? 'كل المواد' : teacherCount(s.teachers.length))))));
  setDock(...head('بحر المواد', 'استكشف الجزر', 'كل جزيرة مادة. وجّه سفينتك بالدفّة أو اسحب على الشاشة، واقترب من أي جزيرة لتستطلع معلّميها.'),
    steerButtons(),
    el('button', { class: 'link link-ink', type: 'button', onclick: (e) => { list.hidden = !list.hidden; e.currentTarget.textContent = list.hidden ? 'أو اختر المادة من القائمة' : 'أخفِ القائمة'; } }, 'أو اختر المادة من القائمة'),
    list);
}
function showScout(s) {
  const names = shuffle(s.teachers).slice(0, 4).map((t) => t.name);
  setDock(el('p', { class: 'eyebrow' }, 'منظار النوخذة'), el('h2', { class: 'display' }, s.all ? 'جزيرة كل المعلّمين' : `جزيرة ${s.name}`),
    el('p', { class: 'lede' }, s.all ? 'من هنا ترى سماء المدرسة كلها، وفيها كل المعلّمين.'
      : `${teacherCount(s.teachers.length)}: ${names.join('، ')}${s.teachers.length > 4 ? '…' : ''}`),
    steerButtons(),
    el('div', { class: 'acts' }, el('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => goIsland(s) }, 'ارسُ هنا واختر معلّمك')));
}

async function goIsland(s) {
  stopExplore();
  state.mode = 'sail';
  state.subject = s;
  clearLabels();
  setDock(...head('ترسو السفينة', `جزيرة ${s.all ? 'كل المعلّمين' : s.name}`, null));
  const p = s.mesh.position.clone();
  const stop = p.clone().add(boatPos().sub(p).setY(0).normalize().multiplyScalar(18));
  await sailTo(stop, Math.min(5200, 1600 + boatPos().distanceTo(stop) * 25));
  if (!s.all && s.questions > 0) return offerDive();
  chooseStar(s);
}

/* ======================================================================
   ٤. الغوص على اللؤلؤ (اختياري)
   ====================================================================== */
function offerDive() {
  setDock(...head('الغوص على اللؤلؤ', 'تغوص قبل أن تكمل؟',
    `ثلاثة أسئلة سريعة من ${state.subject.name}. كل إجابة صحيحة لؤلؤة تُهديها لمعلّمك. الغوص لا يغيّر صوتك.`),
  el('div', { class: 'acts' },
    el('button', { class: 'btn btn-primary', type: 'button', onclick: dive }, 'اغطس'),
    el('button', { class: 'btn', type: 'button', onclick: () => chooseStar(state.subject) }, 'تخطَّ الغوص')));
}
async function dive() {
  const { items } = await api('/api/game/questions?subject=' + encodeURIComponent(state.subject.name)).catch(() => ({ items: [] }));
  if (!items.length) return chooseStar(state.subject);
  const ov = $('dive');
  ov.hidden = false;
  dock.replaceChildren();
  const counter = el('p', { class: 'pearls', 'aria-live': 'polite' });
  const draw = () => counter.replaceChildren(...[0, 1, 2].slice(0, items.length).map((k) => el('span', { class: 'pearl' + (k < state.pearls ? ' got' : '') })),
    el('span', { class: 'sr' }, pearlWord(state.pearls)));
  state.pearls = 0; state.answers = {};
  for (let i = 0; i < items.length; i++) {
    const q = items[i];
    draw();
    const choice = await new Promise((resolve) => {
      ov.querySelector('.dive-in').replaceChildren(counter,
        el('p', { class: 'eyebrow' }, `السؤال ${i + 1} من ${items.length}`),
        el('h2', { class: 'display' }, q.q),
        el('ul', { class: 'choices' }, q.choices.map((c, k) => el('li', {}, el('button', { type: 'button', 'data-k': k, onclick: () => resolve(k) }, el('span', { class: 'nm' }, c))))));
    });
    state.answers[q.id] = choice;
    const r = await api('/api/game/check', { id: q.id, choice }).catch(() => null);
    const btns = ov.querySelectorAll('.choices button');
    btns.forEach((b) => { b.disabled = true; });
    if (r) {
      btns[r.answer]?.classList.add('right');
      if (!r.correct) btns[choice]?.classList.add('wrong');
      if (r.correct) { state.pearls++; draw(); }
    }
    await sleep(calm ? 600 : 1300);
  }
  ov.querySelector('.dive-in').replaceChildren(counter,
    el('h2', { class: 'display' }, state.pearls ? `جمعت ${pearlWord(state.pearls)}` : 'لم تجد لؤلؤاً هذه المرة'),
    el('p', { class: 'lede' }, state.pearls ? 'ستهديها لمعلّمك مع ترشيحك.' : 'لا بأس، الغوص لا يغيّر صوتك.'),
    el('div', { class: 'acts' }, el('button', { class: 'btn btn-primary', type: 'button', onclick: () => { ov.hidden = true; chooseStar(state.subject); } }, 'اصعد إلى السطح')));
  draw();
}

/* ======================================================================
   ٥. سماء المعلّمين: استطلاع بالمنظار واختيار النجم
   ====================================================================== */
let starGroup = null, skyFn = null;
async function chooseStar(s) {
  stopExplore();
  setStep(2);
  state.mode = 'sail';
  state.subject = s; state.teacher = null;
  clearLabels();
  if (starGroup) world.scene.remove(starGroup);
  if (skyFn) world.onFrame.delete(skyFn);
  starGroup = new THREE.Group(); world.scene.add(starGroup);
  const list = shuffle(s.teachers);
  const center = s.mesh ? Math.atan2(s.mesh.position.x - boat.x, -(s.mesh.position.z - boat.z)) : boat.heading;
  const n = list.length, portrait = world.camera.aspect < 0.8, hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(world.camera.fov) / 2) * world.camera.aspect);
  const cols = Math.max(1, Math.min(n, portrait ? 2 : Math.min(5, Math.ceil(Math.sqrt(n * 2))))), rows = Math.ceil(n / cols);
  const R = 300, azSpan = Math.min(1.3, hf * (portrait ? 0.62 : 0.6) * (n > 8 ? 1.6 : 1)), elLo = 0.32, elHi = elLo + 0.15 * (rows - 1);
  const stars = list.map((t, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const stagger = cols > 2 ? (r % 2) * 0.5 : 0, inRow = Math.min(cols, n - r * cols);
    const az = center + (inRow === 1 ? 0 : -azSpan / 2 + (azSpan * (c + stagger)) / (cols - 1 + stagger)) + (Math.random() - 0.5) * 0.03;
    const elv = rows === 1 ? (elLo + elHi) / 2 : elLo + ((elHi - elLo) * r) / (rows - 1) + (Math.random() - 0.5) * 0.05;
    const pos = boatPos().add(new THREE.Vector3(Math.sin(az) * Math.cos(elv), Math.sin(elv), -Math.cos(az) * Math.cos(elv)).multiplyScalar(R));
    const sp = makeTeacherStar(); sp.position.copy(pos); sp.scale.setScalar(0);
    starGroup.add(sp);
    return { t, sp, pos };
  });
  const seg = [], inTree = [0];
  while (inTree.length < stars.length) {
    let best = null;
    for (const a of inTree) for (let b = 0; b < stars.length; b++) {
      if (inTree.includes(b)) continue;
      const d = stars[a].pos.distanceTo(stars[b].pos);
      if (!best || d < best.d) best = { a, b, d };
    }
    inTree.push(best.b); seg.push(...stars[best.a].pos.toArray(), ...stars[best.b].pos.toArray());
  }
  if (seg.length) {
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    starGroup.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xf3c76c, transparent: true, opacity: 0.28, fog: false })));
  }
  const mid = stars.reduce((a, s2) => a.add(s2.pos), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, stars.length));
  // النوخذة يرفع رأسه: الكاميرا خلفه وفوقه تنظر إلى الكوكبة
  const eye = boatPos().add(fwd(center).multiplyScalar(-12)).add(new THREE.Vector3(0, 10, 0));
  const dir = mid.clone().sub(eye).normalize();
  const basePitch = Math.asin(dir.y) - THREE.MathUtils.degToRad(world.camera.fov) * 0.22, baseYaw = Math.atan2(dir.x, -dir.z);
  const lookAt = (yaw, pitch) => eye.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(60));
  await moveCam(eye, lookAt(baseYaw, basePitch), 2200);
  stars.forEach((s2, i) => tween(world, 600 + i * 60, (e) => s2.sp.scale.setScalar(12 * e)));
  state.skyLook = { yaw: 0, pitch: 0 }; state.spy = false;
  state.mode = 'sky';
  skyFn = (dt) => {
    const target = lookAt(baseYaw + state.skyLook.yaw, basePitch + state.skyLook.pitch);
    cam.pos.lerp(eye, Math.min(1, dt * 4)); cam.look.lerp(target, Math.min(1, dt * 6));
  };
  world.onFrame.add(skyFn);
  const pick = (s2) => {
    state.teacher = s2.t;
    stars.forEach((o) => { o.sp.material.opacity = o === s2 ? 1 : 0.45; o.sp.scale.setScalar(o === s2 ? 22 : 11); });
    document.querySelectorAll('#labels .tag, #dock .choices button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === String(s2.t.id))));
    next.disabled = false; next.textContent = `أبحر إلى نجم ${s2.t.name}`;
    // المنظار يتّجه نحو النجم المختار
    const d = s2.pos.clone().sub(eye).normalize();
    tween(world, 700, (e) => {
      state.skyLook.yaw += ((Math.atan2(d.x, -d.z) - baseYaw) - state.skyLook.yaw) * e * 0.5;
      state.skyLook.pitch += ((Math.asin(d.y) - THREE.MathUtils.degToRad(world.camera.fov) * 0.18 - basePitch) - state.skyLook.pitch) * e * 0.5;
    });
  };
  for (const s2 of stars) {
    const lb = label3d(s2.pos.clone().add(new THREE.Vector3(0, -9, 0)), el('span', { class: 'tag-name' }, s2.t.name), () => pick(s2), 'tag-star' + (n > 12 ? ' tag-faint' : ''));
    lb.b.dataset.id = s2.t.id;
  }
  const next = el('button', { class: 'btn btn-primary btn-block', type: 'button', disabled: true, onclick: () => state.teacher && message() }, 'اختر نجماً');
  const spyBtn = el('button', { class: 'btn btn-sm', type: 'button', 'aria-pressed': 'false', onclick: async () => {
    state.spy = !state.spy;
    spyBtn.setAttribute('aria-pressed', String(state.spy)); spyBtn.textContent = state.spy ? 'أبعد المنظار' : 'المنظار';
    $('spy').classList.toggle('on', state.spy);
    await setFov(state.spy ? world.camera.fov * 0.5 : (world.camera.aspect < 0.8 ? 68 : 55), 600);
  } }, 'المنظار');
  const search = el('input', { class: 'input', type: 'search', placeholder: 'ابحث باسم المعلّم', 'aria-label': 'ابحث باسم المعلّم', autocomplete: 'off' });
  const found = el('ul', { class: 'choices' });
  let timer;
  const rowsFor = (arr) => arr.map((s2) => el('li', {}, el('button', { type: 'button', 'data-id': s2.t.id, onclick: () => pick(s2) }, el('span', { class: 'nm' }, s2.t.name), el('span', { class: 'pick' }, 'اختر'))));
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = search.value.trim();
      if (q.length < 2) { found.replaceChildren(...(n <= 12 ? [] : rowsFor(stars))); return; }
      const { items } = await api('/api/suggest?q=' + encodeURIComponent(q)).catch(() => ({ items: [] }));
      found.replaceChildren(...items.map((t) => {
        const hit = stars.find((x) => x.t.id === t.id);
        return el('li', {}, el('button', { type: 'button', 'data-id': t.id, onclick: () => (hit ? pick(hit) : pickOther(t)) }, el('span', { class: 'nm' }, t.name), el('span', { class: 'pick' }, 'اختر')));
      }));
    }, 160);
  });
  if (n > 12) found.replaceChildren(...rowsFor(stars));
  function pickOther(t) {                                              // معلّم من مادة أخرى: نجم جديد يظهر
    const sp = makeTeacherStar(); const pos = mid.clone().add(new THREE.Vector3(0, 30, 0)); sp.position.copy(pos); starGroup.add(sp);
    const s2 = { t, sp, pos }; stars.push(s2); pick(s2);
  }
  setDock(...head(s.all ? 'سماء المدرسة' : `كوكبة ${s.name}`, 'أيّ نجم دلّك على طريقك؟', 'كل نجم معلّم. اسحب لتستطلع السماء، وقرّب بالمنظار، ثم المس نجم معلّمك.'),
    el('div', { class: 'search-row' }, search, spyBtn), found, el('div', { class: 'acts' }, next),
    state.game.subjects.length ? el('button', { class: 'link link-ink', type: 'button', onclick: backToSea }, 'عُد إلى البحر') : null);
  state.stars = stars;
}
async function leaveSky() {
  if (skyFn) world.onFrame.delete(skyFn); skyFn = null;
  if (state.spy) { state.spy = false; $('spy').classList.remove('on'); await setFov(world.camera.aspect < 0.8 ? 68 : 55, 400); }
}
async function backToSea() {
  await leaveSky();
  if (starGroup) world.scene.remove(starGroup);
  explore();
}

/* ======================================================================
   ٦. الرسالة على الشراع
   ====================================================================== */
async function message() {
  await leaveSky();
  state.mode = 'msg';
  setStep(3);
  clearLabels();
  moveCam(boatPos().add(side(boat.heading).multiplyScalar(17)).add(new THREE.Vector3(0, 4, 0)), boatPos().add(new THREE.Vector3(0, 0.8, 0)), 1600);
  const ta = el('textarea', { class: 'textarea', id: 'reason', maxlength: 300, rows: 3, 'aria-describedby': 'reason-hint' });
  const count = el('span', { class: 'num' }, '0/300');
  let timer;
  ta.addEventListener('input', () => {
    count.textContent = `${ta.value.length}/300`;
    clearTimeout(timer); timer = setTimeout(() => paintSail(dhow, state.color, ta.value.trim()), 120);
  });
  const send = el('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => finale(ta.value.trim(), send) }, `أشعل نجم ${state.teacher.name}`);
  setDock(...head('رسالتك', 'لماذا اخترته؟', 'اكتب كلمتك لمعلّمك، وستُكتب على شراعك. الرسالة اختيارية.'),
    el('div', { class: 'field' }, el('label', { for: 'reason', class: 'sr' }, 'لماذا اخترته؟'), ta,
      el('p', { class: 'hint', id: 'reason-hint' }, el('span', {}, 'ماذا يميّزه؟ ماذا تعلّمت منه؟'), count)),
    el('div', { class: 'acts' }, send),
    el('button', { class: 'link link-ink', type: 'button', onclick: () => chooseStar(state.subject) }, 'غيّر المعلّم'));
  setTimeout(() => ta.focus({ preventScroll: true }), 300);
}

/* ======================================================================
   ٧. الوصول: نور يصعد من السفينة إلى النجم، والطاقم يحتفل
   ====================================================================== */
async function finale(reason, btn) {
  btn.disabled = true;
  let r;
  try {
    r = await api('/api/vote', { teacherId: state.teacher.id, name: state.teacher.name, reason, subject: state.subject.all ? '' : state.subject.name, answers: state.answers });
  } catch (e) {
    if (e.status === 409) return ended('سبق أن رشّحت', 'سُجّل ترشيحك من هذا الجهاز من قبل. لكل طالب صوت واحد.');
    if (e.status === 403) return ended('التصويت مغلق', 'انتهت فترة الترشيح. شكراً لك.');
    setDock(...head('تعذّر الإرسال', 'لم يصل ترشيحك بعد', e.message === 'Failed to fetch' ? 'تحقّق من اتصالك بالإنترنت ثم حاول مجدداً.' : e.message),
      el('div', { class: 'acts' }, el('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: (ev) => finale(reason, ev.currentTarget) }, 'حاول مجدداً')));
    return;
  }
  state.mode = 'end';
  setStep(4);
  try { localStorage.setItem('voted', '1'); } catch {}
  dock.replaceChildren();
  const target = state.stars.find((s) => s.t.id === state.teacher.id);
  // السفينة تستدير لتواجه نجم المعلّم
  const want = Math.atan2(target.pos.x - boat.x, -(target.pos.z - boat.z)), h0 = boat.heading;
  const turn = Math.atan2(Math.sin(want - h0), Math.cos(want - h0));
  await tween(world, 1300, (e) => { boat.heading = h0 + turn * e; boat.steer = Math.sin(e * Math.PI) * Math.sign(turn) * 0.8; });
  boat.steer = 0;
  const from = dhow.localToWorld(dhow.userData.mastTop.clone());
  const to = target.pos.clone();
  await moveCam(boatPos().add(fwd(boat.heading).multiplyScalar(-26)).add(new THREE.Vector3(0, 5, 0)), from.clone().lerp(to, 0.5), 1200);
  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  orb.scale.setScalar(5); world.scene.add(orb);
  const curve = new THREE.QuadraticBezierCurve3(from, from.clone().lerp(to, 0.35).add(new THREE.Vector3(0, 60, 0)), to);
  const trail = [];
  await tween(world, 2800, (e) => {
    const p = curve.getPoint(e); orb.position.copy(p);
    cam.look.lerp(p, 0.05);
    if (Math.random() < 0.6) { const s = new THREE.Sprite(orb.material.clone()); s.position.copy(p); s.scale.setScalar(3); world.scene.add(s); trail.push(s); }
    for (const s of trail) { s.material.opacity *= 0.95; s.scale.multiplyScalar(0.985); }
  });
  world.scene.remove(orb); trail.forEach((s) => world.scene.remove(s));
  const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,0.9)', 'rgba(243,199,108,0)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  ring.position.copy(to); world.scene.add(ring);
  tween(world, 1400, (e) => { ring.scale.setScalar(20 + e * 160); ring.material.opacity = 1 - e; }).then(() => world.scene.remove(ring));
  tween(world, 900, (e) => target.sp.scale.setScalar(22 + Math.sin(e * Math.PI) * 30 + e * 12));
  fireworks();
  // الطاقم يحتفل، والكاميرا أمام النوخذة والنجم فوقه
  captain.pose = 'cheer'; captain.setMood('cheer');
  for (const s of crew.sailors) s.userData.avatar.pose = 'wave';
  const h = captainHead();
  await sleep(900);
  // لقطة أخيرة: النوخذة من خلفه يحتفل، ونجم معلّمه يضيء فوقه
  await moveCam(h.clone().add(fwd(boat.heading).multiplyScalar(-8.5)).add(side(boat.heading).multiplyScalar(0.9)).add(new THREE.Vector3(0, 2.1, 0)),
    h.clone().add(fwd(boat.heading).multiplyScalar(14)).add(new THREE.Vector3(0, 2.6, 0)), 2200);
  await sleep(2200);
  label3d(to.clone().add(new THREE.Vector3(0, -14, 0)), el('span', { class: 'tag-name' }, state.teacher.name), null, 'tag-star tag-final');
  const p = r.pearls || 0;
  setDock(...head('وصل ترشيحك', `أضأت نجم ${state.teacher.name}`, p ? `وأهديته ${pearlWord(p)} من غوصك. كلمتك تصل، وأثرها يبقى.` : 'كلمتك تصل، وأثرها يبقى. شكراً لك يا نوخذة.'),
    el('div', { class: 'acts' }, el('a', { class: 'btn', href: '/about' }, 'عن المبادرة')));
}

function ended(title, text) {
  setDock(...head('مبادرة معلّمي المفضّل', title, text), el('div', { class: 'acts' }, el('a', { class: 'btn', href: '/about' }, 'عن المبادرة')));
}
function fireworks() {
  if (calm || !window.confetti) return;
  const fire = window.confetti.create($('fx'), { resize: true });
  const colors = ['#f3c76c', '#e9b44c', '#5cc0b5', '#ffffff'];
  [[0.5, 0.2, 0], [0.28, 0.14, 380], [0.72, 0.16, 720], [0.45, 0.08, 1100], [0.6, 0.22, 1500]].forEach(([x, y, d]) => setTimeout(() => fire({
    particleCount: 50, spread: 360, startVelocity: 24, gravity: 0.5, decay: 0.93, ticks: 150, scalar: 0.8, shapes: ['circle'], origin: { x, y }, colors,
  }), d));
}

/* ---------- البداية ---------- */
(async () => {
  world.start();
  paintSail(dhow, state.color);
  if (document.fonts) document.fonts.load('600 40px Kufi').catch(() => {});
  try {
    state.game = await api('/api/game');
  } catch {
    $('loading').hidden = true;
    return ended('تعذّر الاتصال', 'لم نستطع تحميل الرحلة. تحقّق من الإنترنت ثم حاول مجدداً.');
  }
  if (state.game.school) $('school').textContent = state.game.school;
  buildIslands();
  $('loading').classList.add('gone');
  setTimeout(() => { $('loading').hidden = true; }, 700);
  if (state.game.voted) { cam.pos.set(5, 2.6, -15); cam.look.set(20, 21, 80); return ended('سبق أن رشّحت', 'سُجّل ترشيحك من هذا الجهاز من قبل. لكل طالب صوت واحد.'); }
  if (!state.game.open) { cam.pos.set(5, 2.6, -15); cam.look.set(20, 21, 80); return ended('التصويت مغلق', 'انتهت فترة الترشيح. شكراً لكل من شارك.'); }
  if (!state.game.teachers.length) return ended('لم تبدأ الرحلة بعد', 'لم تُضف أسماء المعلّمين بعد. عُد لاحقاً.');
  if (calm || new URLSearchParams(location.search).has('nocine')) { boat.x = 0; boat.z = 0; } else await cinematic();
  outfitter();
})();
window.__game = { state, world, boat, input };
