/* رحلة «نجمك يا معلّم»: الميناء ← جزيرة المادة ← الغوص (اختياري) ← نجم المعلّم ← الرسالة ← الوصول */
import * as THREE from 'three';
import { createWorld, makeDhow, paintSail, makeIsland, makeTeacherStar, tween, waveHeight, glowTexture, webglSupported } from './world.js';

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
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pearlWord = (n) => (n === 1 ? 'لؤلؤة واحدة' : n === 2 ? 'لؤلؤتين' : `${n} لآلئ`);
const hfov = () => 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(world.camera.fov) / 2) * world.camera.aspect);

if (!webglSupported()) location.replace('/?quick=1');

async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'حدث خطأ. حاول مجدداً.'), { status: res.status });
  return data;
}

/* ---------- العالم والسفينة ---------- */
const world = createWorld($('world'));
const dhow = makeDhow();
world.scene.add(dhow);
const boat = { x: 0, z: 0, heading: 0 };
world.onFrame.add((dt, t) => {
  const y = waveHeight(boat.x, boat.z, t) * 0.7 + 0.15;
  dhow.position.set(boat.x, y, boat.z);
  dhow.rotation.set(Math.sin(t * 0.9) * 0.03, -boat.heading, Math.sin(t * 1.3) * 0.05, 'YXZ');
});
const fwd = (a) => new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
const boatPos = () => new THREE.Vector3(boat.x, 0, boat.z);

// أثر السفينة على الماء
const wake = (() => {
  const n = 90, pos = new Float32Array(n * 3), life = new Float32Array(n);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'), size: 1.6, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  world.scene.add(pts);
  let i = 0, acc = 0, last = boatPos();
  world.onFrame.add((dt) => {
    const now = boatPos(), moving = now.distanceTo(last) > 0.01;
    last = now; acc += dt;
    if (moving && acc > 0.03) {
      acc = 0;
      const back = fwd(boat.heading).multiplyScalar(-4.4).add(now);
      for (const s of [-1, 1]) {
        const side = new THREE.Vector3(Math.cos(boat.heading), 0, Math.sin(boat.heading)).multiplyScalar(s * (0.6 + Math.random() * 0.6));
        pos.set([back.x + side.x, 0.35, back.z + side.z], i * 3); life[i] = 1; i = (i + 1) % n;
      }
    }
    for (let k = 0; k < n; k++) if (life[k] > 0) { life[k] -= dt * 0.5; if (life[k] <= 0) pos[k * 3 + 1] = -50; }
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
})();

/* ---------- الكاميرا ---------- */
const PORT_CAM = { pos: new THREE.Vector3(5, 2.6, -15), look: new THREE.Vector3(20, 21, 80) };
const cam = { pos: PORT_CAM.pos.clone(), look: PORT_CAM.look.clone() };
world.onFrame.add(() => { world.camera.position.copy(cam.pos); world.camera.lookAt(cam.look); });
function moveCam(pos, look, ms = 1800) {
  const p0 = cam.pos.clone(), l0 = cam.look.clone();
  return tween(world, ms, (e) => { cam.pos.lerpVectors(p0, pos, e); cam.look.lerpVectors(l0, look, e); });
}
const chase = () => ({
  pos: boatPos().add(fwd(boat.heading).multiplyScalar(-15)).add(new THREE.Vector3(0, 6.5, 0)),
  look: boatPos().add(fwd(boat.heading).multiplyScalar(25)).add(new THREE.Vector3(0, 2, 0)),
});

/** تبحر السفينة على منحنى ناعم إلى نقطة، والكاميرا تتبعها */
function sailTo(target, ms = 3800) {
  const start = boatPos(), h0 = boat.heading;
  const dir = target.clone().sub(start); const dist = dir.length();
  const h1 = Math.atan2(dir.x, -dir.z);
  const ctrl = start.clone().add(fwd(h0).multiplyScalar(dist * 0.45));
  const curve = new THREE.QuadraticBezierCurve3(start, ctrl, target);
  let follow = true;
  const camFn = () => { if (!follow) return; const c = chase(); cam.pos.lerp(c.pos, 0.06); cam.look.lerp(c.look, 0.08); };
  world.onFrame.add(camFn);
  return tween(world, ms, (e) => {
    const p = curve.getPoint(e), tan = curve.getTangent(Math.min(e, 0.999));
    boat.x = p.x; boat.z = p.z; boat.heading = Math.atan2(tan.x, -tan.z);
  }).then(() => { follow = false; world.onFrame.delete(camFn); boat.heading = h1 + (boat.heading - h1); });
}

/* ---------- تسميات ثلاثية الأبعاد (أزرار HTML فوق المشهد) ---------- */
const labels = new Set();
function label3d(anchor, content, onClick, cls = '') {
  const b = el('button', { class: 'tag ' + cls, type: 'button', onclick: onClick }, content);
  $('labels').append(b);
  const item = { b, anchor, hidden: false };
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
    if (!off) l.b.style.transform = `translate(-50%, -100%) translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h}px)`;
  }
});

/* ---------- واجهة الرصيف السفلي ---------- */
const dock = $('dock');
function setDock(...kids) {
  dock.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
  if (!calm && window.Motion) Motion.animate([...dock.children], { opacity: [0, 1], y: [14, 0] }, { delay: Motion.stagger(0.06), duration: 0.45 });
}
function setStep(i) {
  [...document.querySelectorAll('#steps li')].forEach((li, k) => {
    li.classList.toggle('done', k < i); li.classList.toggle('now', k === i);
    if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
}
const head = (eyebrow, title, text) => [el('p', { class: 'eyebrow' }, eyebrow), el('h2', { class: 'display' }, title), text && el('p', { class: 'lede' }, text)];

/* ---------- الحالة ---------- */
const state = { color: '#f3efe4', subject: null, teacher: null, answers: {}, pearls: 0, game: null };
const COLORS = [['#f3efe4', 'أبيض'], ['#e9b44c', 'ذهبي'], ['#c8453b', 'أحمر'], ['#2f7fbf', 'أزرق'], ['#3f9d6a', 'أخضر'], ['#7a4fa3', 'بنفسجي']];

/* ---------- ١. الميناء ---------- */
function port() {
  setStep(0);
  const sw = el('div', { class: 'swatches', role: 'group', 'aria-label': 'لون الشراع' }, COLORS.map(([c, n]) => el('button', {
    type: 'button', class: 'swatch', style: `--c:${c}`, 'aria-label': `شراع ${n}`, 'aria-pressed': String(c === state.color),
    onclick: (e) => {
      state.color = c; paintSail(dhow, c);
      sw.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
    },
  })));
  setDock(...head('مبادرة معلّمي المفضّل', 'يا نوخذة، جهّز سفينتك',
    'في زمن البحر كان «المعلّم» هو من يهدي السفينة بالنجوم. اختر لون شراعك، وأبحر إلى المعلّم الذي أنار طريقك.'),
  sw,
  el('div', { class: 'acts' }, el('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: subjects }, 'أبحر')));
}

/* ---------- ٢. جزر المواد ---------- */
let islands = [];
async function subjects() {
  setStep(1);
  const g = state.game;
  if (!g.subjects.length) return chooseStar({ name: 'كل المعلّمين', teachers: g.teachers, all: true });
  boat.x = 0; boat.z = 0; boat.heading = 0;
  if (!islands.length) {
    const list = [...g.subjects.map((s) => ({ ...s })), { name: 'كل المعلّمين', teachers: g.teachers, all: true }];
    // صفوف من الجزر داخل مجال الرؤية (الجوال العمودي يأخذ ٣ في الصف)
    const perRow = world.camera.aspect < 0.8 ? 2 : 4, half = Math.tan(hfov() / 2);
    list.forEach((s, i) => {
      const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, list.length - row * perRow);
      const d = 62 + row * 46, width = (d + 40) * half * 1.15;
      const x = inRow === 1 ? 0 : -width / 2 + (width * col) / (inRow - 1) + (row % 2 ? width / (inRow * 2.5) : 0);
      const isl = makeIsland(!!s.all);
      isl.position.set(x, 0, -d);
      isl.rotation.y = Math.random() * Math.PI;
      world.scene.add(isl);
      islands.push({ ...s, mesh: isl });
    });
    world.onFrame.add((dt, t) => islands.forEach((s, i) => { s.mesh.userData.light.material.opacity = 0.75 + Math.sin(t * 2 + i) * 0.25; }));
  }
  clearLabels();
  for (const s of islands) {
    label3d(() => s.mesh.localToWorld(s.mesh.userData.top.clone()), [el('span', { class: 'tag-name' }, s.name),
      el('span', { class: 'tag-sub' }, s.all ? 'أي معلّم' : `${s.teachers.length} ${s.teachers.length > 10 ? 'معلّماً' : s.teachers.length > 2 ? 'معلّمين' : s.teachers.length === 2 ? 'معلّمان' : 'معلّم'}`)],
    () => goIsland(s), s.all ? 'tag-all' : '');
  }
  boat.heading = 0;
  await moveCam(new THREE.Vector3(0, 70, 40), new THREE.Vector3(0, -10, -95), 2200);
  setDock(...head('بحر المواد', 'إلى أي جزيرة تبحر؟', 'كل جزيرة مادة. أبحر إلى المادة التي تحبّها، أو إلى جزيرة «كل المعلّمين».'),
    el('ul', { class: 'choices' }, islands.map((s) => el('li', {}, el('button', { type: 'button', onclick: () => goIsland(s) },
      el('span', { class: 'nm' }, s.name), el('span', { class: 'pick' }, s.all ? 'كل المواد' : 'أبحر'))))));
}

async function goIsland(s) {
  state.subject = s;
  clearLabels();
  setDock(...head('في الطريق', `نبحر إلى جزيرة ${s.name}`, null));
  const p = s.mesh.position.clone();
  const stop = p.clone().add(boatPos().sub(p).setY(0).normalize().multiplyScalar(18));
  await sailTo(stop, 4200);
  if (!s.all && s.questions > 0) return offerDive();
  chooseStar(s);
}

/* ---------- ٣. الغوص على اللؤلؤ (اختياري) ---------- */
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
    await new Promise((res) => setTimeout(res, calm ? 600 : 1300));
  }
  ov.querySelector('.dive-in').replaceChildren(counter,
    el('h2', { class: 'display' }, state.pearls ? `جمعت ${pearlWord(state.pearls)}` : 'لم تجد لؤلؤاً هذه المرة'),
    el('p', { class: 'lede' }, state.pearls ? 'ستهديها لمعلّمك مع ترشيحك.' : 'لا بأس، الغوص لا يغيّر صوتك.'),
    el('div', { class: 'acts' }, el('button', { class: 'btn btn-primary', type: 'button', onclick: () => { ov.hidden = true; chooseStar(state.subject); } }, 'اصعد إلى السطح')));
  draw();
}

/* ---------- ٤. سماء المعلّمين ---------- */
let starGroup = null;
async function chooseStar(s) {
  setStep(2);
  state.subject = s; state.teacher = null;
  clearLabels();
  if (starGroup) world.scene.remove(starGroup);
  starGroup = new THREE.Group(); world.scene.add(starGroup);
  const list = shuffle(s.teachers);
  const center = s.mesh ? Math.atan2(s.mesh.position.x - boat.x, -(s.mesh.position.z - boat.z)) : boat.heading;
  const n = list.length, portrait = world.camera.aspect < 0.8;
  const cols = Math.max(1, Math.min(n, portrait ? 2 : Math.min(5, Math.ceil(Math.sqrt(n * 2))))), rows = Math.ceil(n / cols);
  const R = 300, azSpan = hfov() * (portrait ? 0.62 : 0.6), elLo = 0.32, elHi = elLo + 0.15 * (rows - 1);
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
  // خطوط الكوكبة: أقرب جار
  const seg = [];
  const inTree = [0];
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
  const eye = boatPos().add(fwd(center).multiplyScalar(-12)).add(new THREE.Vector3(0, 10, 0));
  const lookAt = mid.clone().sub(eye).normalize();
  const pitch = Math.asin(lookAt.y) - THREE.MathUtils.degToRad(world.camera.fov) * 0.22;   // الكوكبة في النصف العلوي فوق الرصيف
  const flat = new THREE.Vector3(lookAt.x, 0, lookAt.z).normalize();
  state.starView = { eye, look: eye.clone().add(flat.multiplyScalar(Math.cos(pitch)).setY(Math.sin(pitch)).multiplyScalar(50)) };
  await moveCam(state.starView.eye, state.starView.look, 2200);
  stars.forEach((s2, i) => tween(world, 600 + i * 60, (e) => s2.sp.scale.setScalar(12 * e)));
  const pick = (s2) => {
    state.teacher = s2.t;
    stars.forEach((o) => { o.sp.material.opacity = o === s2 ? 1 : 0.45; o.sp.scale.setScalar(o === s2 ? 22 : 11); });
    document.querySelectorAll('#labels .tag, #dock .choices button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === String(s2.t.id))));
    next.disabled = false; next.textContent = `أبحر إلى نجم ${s2.t.name}`;
  };
  const showLabels = n <= 12;
  if (showLabels) for (const s2 of stars) {
    const lb = label3d(s2.pos.clone().add(new THREE.Vector3(0, -9, 0)), el('span', { class: 'tag-name' }, s2.t.name), () => pick(s2), 'tag-star');
    lb.b.dataset.id = s2.t.id;
  }
  const next = el('button', { class: 'btn btn-primary btn-block', type: 'button', disabled: true, onclick: () => state.teacher && message() }, 'اختر نجماً');
  const search = el('input', { class: 'input', type: 'search', placeholder: 'ابحث باسم المعلّم', 'aria-label': 'ابحث باسم المعلّم', autocomplete: 'off' });
  const found = el('ul', { class: 'choices' });
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = search.value.trim();
      if (q.length < 2) { found.replaceChildren(...(showLabels ? [] : rowsFor(stars))); return; }
      const { items } = await api('/api/suggest?q=' + encodeURIComponent(q)).catch(() => ({ items: [] }));
      found.replaceChildren(...items.map((t) => {
        const hit = stars.find((x) => x.t.id === t.id);
        return el('li', {}, el('button', { type: 'button', 'data-id': t.id, onclick: () => (hit ? pick(hit) : pickOther(t)) }, el('span', { class: 'nm' }, t.name), el('span', { class: 'pick' }, 'اختر')));
      }));
    }, 160);
  });
  const rowsFor = (arr) => arr.map((s2) => el('li', {}, el('button', { type: 'button', 'data-id': s2.t.id, onclick: () => pick(s2) }, el('span', { class: 'nm' }, s2.t.name), el('span', { class: 'pick' }, 'اختر'))));
  if (!showLabels) found.replaceChildren(...rowsFor(stars));
  function pickOther(t) {                                              // معلّم من مادة أخرى: نجم جديد يظهر
    const sp = makeTeacherStar(); const pos = mid.clone().add(new THREE.Vector3(0, 30, 0)); sp.position.copy(pos); starGroup.add(sp);
    const s2 = { t, sp, pos }; stars.push(s2); pick(s2);
  }
  setDock(...head(s.all ? 'سماء المدرسة' : `كوكبة ${s.name}`, 'أيّ نجم دلّك على طريقك؟', 'كل نجم معلّم. المس نجم معلّمك، أو ابحث باسمه.'),
    search, found, el('div', { class: 'acts' }, next),
    state.game.subjects.length ? el('button', { class: 'link link-ink', type: 'button', onclick: () => { if (starGroup) world.scene.remove(starGroup); subjects(); } }, 'غيّر الجزيرة') : null);
  state.stars = stars;
}

/* ---------- ٥. الرسالة على الشراع ---------- */
async function message() {
  setStep(3);
  clearLabels();
  const side = new THREE.Vector3(Math.cos(boat.heading), 0, Math.sin(boat.heading));
  moveCam(boatPos().add(side.clone().multiplyScalar(17)).add(new THREE.Vector3(0, 4, 0)), boatPos().add(new THREE.Vector3(0, 0.8, 0)), 1600);
  const ta = el('textarea', { class: 'textarea', id: 'reason', maxlength: 300, rows: 3, 'aria-describedby': 'reason-hint' });
  const count = el('span', { class: 'num' }, '0/300');
  let timer;
  ta.addEventListener('input', () => {
    count.textContent = `${ta.value.length}/300`;
    clearTimeout(timer); timer = setTimeout(() => paintSail(dhow, state.color, ta.value.trim()), 120);
  });
  const send = el('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => finale(ta.value.trim(), send) }, `أشعل نجم ${state.teacher.name}`);
  const err = el('p', { class: 'error', role: 'alert', hidden: true });
  setDock(...head('رسالتك', 'لماذا اخترته؟', 'اكتب كلمتك لمعلّمك، وستُكتب على شراعك. الرسالة اختيارية.'),
    el('div', { class: 'field' }, el('label', { for: 'reason', class: 'sr' }, 'لماذا اخترته؟'), ta,
      el('p', { class: 'hint', id: 'reason-hint' }, el('span', {}, 'ماذا يميّزه؟ ماذا تعلّمت منه؟'), count)),
    err, el('div', { class: 'acts' }, send),
    el('button', { class: 'link link-ink', type: 'button', onclick: () => chooseStar(state.subject) }, 'غيّر المعلّم'));
  dock.err = err;
  setTimeout(() => ta.focus({ preventScroll: true }), 300);
}

/* ---------- ٦. الوصول: نور يصعد من السفينة إلى النجم ---------- */
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
  setStep(4);
  try { localStorage.setItem('voted', '1'); } catch {}
  dock.replaceChildren();
  const target = state.stars.find((s) => s.t.id === state.teacher.id);
  const from = dhow.localToWorld(dhow.userData.mastTop.clone());
  const to = target.pos.clone();
  await moveCam(boatPos().add(fwd(boat.heading).multiplyScalar(-26)).add(new THREE.Vector3(0, 5, 0)), from.clone().lerp(to, 0.5), 1200);
  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  orb.scale.setScalar(5); world.scene.add(orb);
  const ctrl = from.clone().lerp(to, 0.35).add(new THREE.Vector3(0, 60, 0));
  const curve = new THREE.QuadraticBezierCurve3(from, ctrl, to);
  const trail = [];
  await tween(world, 2800, (e) => {
    const p = curve.getPoint(e); orb.position.copy(p);
    cam.look.lerp(p, 0.05);
    if (Math.random() < 0.6) {
      const s = new THREE.Sprite(orb.material.clone()); s.position.copy(p); s.scale.setScalar(3); world.scene.add(s); trail.push(s);
    }
    for (const s of trail) { s.material.opacity *= 0.95; s.scale.multiplyScalar(0.985); }
  });
  world.scene.remove(orb); trail.forEach((s) => world.scene.remove(s));
  // النجم يكبر ويضيء، وموجة نور
  const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,0.9)', 'rgba(243,199,108,0)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  ring.position.copy(to); world.scene.add(ring);
  tween(world, 1400, (e) => { ring.scale.setScalar(20 + e * 160); ring.material.opacity = 1 - e; }).then(() => world.scene.remove(ring));
  tween(world, 900, (e) => target.sp.scale.setScalar(22 + Math.sin(e * Math.PI) * 30 + e * 12));
  fireworks();
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
  $('loading').classList.add('gone');
  setTimeout(() => { $('loading').hidden = true; }, 700);
  if (state.game.voted) return ended('سبق أن رشّحت', 'سُجّل ترشيحك من هذا الجهاز من قبل. لكل طالب صوت واحد.');
  if (!state.game.open) return ended('التصويت مغلق', 'انتهت فترة الترشيح. شكراً لكل من شارك.');
  if (!state.game.teachers.length) return ended('لم تبدأ الرحلة بعد', 'لم تُضف أسماء المعلّمين بعد. عُد لاحقاً.');
  port();
})();
window.__game = { state, world, boat };
