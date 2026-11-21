/* سماء المدرسة: شاشة العرض الكبيرة. كل معلّم نجم، ونوره يكبر بعدد أصواته.
   مع كل ترشيح جديد يصعد نور من أبراج الكويت إلى نجم المعلّم، وحفل الإعلان يُشعل النجوم واحداً واحداً. */
import * as THREE from 'three';
import { createWorld, makeTeacherStar, tween, glowTexture } from './world.js';

const $ = (id) => document.getElementById(id);
const votesWord = (n) => (n === 0 ? 'لا أصوات' : n === 1 ? 'صوت واحد' : n === 2 ? 'صوتان' : n <= 10 ? `${n} أصوات` : `${n} صوتاً`);

const status = await fetch('/api/admin/status').then((r) => r.json()).catch(() => ({}));
if (!status.authed) location.replace('/admin');

const world = createWorld($('world'), { quality: 'high' });
const eye = new THREE.Vector3(14, 7, -42), look = new THREE.Vector3(22, 80, 110);
world.onFrame.add((dt, t) => {
  world.camera.position.set(eye.x + Math.sin(t * 0.04) * 5, eye.y, eye.z);
  world.camera.lookAt(look);
});
world.start();

/* ---------- النجوم ---------- */
const R = 420;
const fwdDir = new THREE.Vector3().subVectors(look, eye).setY(0).normalize();
const baseAz = Math.atan2(fwdDir.x, -fwdDir.z);
const dirOf = (az, el) => new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
const stars = new Map();               // id → {sp, pos, label, votes, size}
let group = null, layoutKey = '';
const hfov = () => 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(world.camera.fov) / 2) * world.camera.aspect);

function layout(results) {
  const key = results.map((r) => r.id + ':' + r.subject).sort().join('|') + '@' + world.camera.aspect.toFixed(2);
  if (key === layoutKey) return;
  layoutKey = key;
  if (group) world.scene.remove(group);
  $('labels').replaceChildren(); stars.clear();
  group = new THREE.Group(); world.scene.add(group);
  const bySubject = new Map();
  for (const r of results) {
    const s = r.subject || 'معلّمون آخرون';
    if (!bySubject.has(s)) bySubject.set(s, []);
    bySubject.get(s).push(r);
  }
  const groups = [...bySubject].sort((a, b) => b[1].length - a[1].length);
  const span = hfov() * 0.92, weights = groups.map(([, l]) => l.length + 0.7);
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = -span / 2, k = 0;
  groups.forEach(([subject, list], gi) => {
    const w = (weights[gi] / total) * span, levels = list.length > 6 ? 3 : 2;
    const pts = [];
    list.forEach((r, i) => {
      // صفّ متعرّج: كل نجم بجانب الآخر وعلى ارتفاع مختلف، فلا تتداخل الأسماء
      const az = baseAz - (cursor + w * ((i + 0.5 + 0.35) / (list.length + 0.7)));       // من اليمين إلى اليسار
      const el = 0.32 + ((k++) % 3) * 0.1;                                              // ثلاثة ارتفاعات متناوبة عبر كل النجوم
      const pos = new THREE.Vector3().copy(eye).add(dirOf(az, el).multiplyScalar(R));
      const sp = makeTeacherStar(); sp.position.copy(pos); group.add(sp);
      const lb = document.createElement('div'); lb.className = 'tag sky-tag';
      lb.innerHTML = '<span class="tag-name"></span><span class="tag-sub"></span>';
      lb.querySelector('.tag-name').textContent = r.name;
      $('labels').append(lb);
      stars.set(r.id, { sp, pos, lb, votes: -1, size: 8, name: r.name });
      pts.push(pos);
    });
    // اسم الكوكبة فوقها
    const top = pts.reduce((a, p) => (p.y > a.y ? p : a), pts[0]).clone();
    const mid = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const cap = document.createElement('div'); cap.className = 'tag sky-cap'; cap.textContent = subject;
    $('labels').append(cap);
    stars.set('cap:' + subject, { cap, pos: new THREE.Vector3(mid.x, top.y + 38, mid.z) });
    // خطوط الكوكبة
    const seg = [], inTree = [0];
    while (inTree.length < pts.length) {
      let best = null;
      for (const a of inTree) for (let b = 0; b < pts.length; b++) {
        if (inTree.includes(b)) continue;
        const d = pts[a].distanceTo(pts[b]); if (!best || d < best.d) best = { a, b, d };
      }
      inTree.push(best.b); seg.push(...pts[best.a].toArray(), ...pts[best.b].toArray());
    }
    if (seg.length) {
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
      group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xf3c76c, transparent: true, opacity: 0.25, fog: false })));
    }
    cursor += w;
  });
}

const v3 = new THREE.Vector3();
world.onFrame.add((dt, t) => {
  const w = innerWidth, h = innerHeight;
  for (const s of stars.values()) {
    const node = s.lb || s.cap;
    v3.copy(s.pos).project(world.camera);
    if (v3.z > 1) { node.style.visibility = 'hidden'; continue; }
    node.style.visibility = '';
    const dy = s.lb ? 18 + s.size * 0.9 : 0;
    node.style.transform = `translate(-50%, 0) translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h + dy}px)`;
    if (s.sp) s.sp.scale.setScalar(s.size * (1 + Math.sin(t * 1.7 + s.pos.x) * 0.04));
  }
});
addEventListener('resize', () => { layoutKey = ''; if (last) apply(last, false); });

/* ---------- نور يصعد من أبراج الكويت إلى النجم ---------- */
const towerTop = new THREE.Vector3(26, 47, 78);
function rise(to) {
  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  orb.scale.setScalar(9); world.scene.add(orb);
  const curve = new THREE.QuadraticBezierCurve3(towerTop.clone(), towerTop.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 80, 0)), to.clone());
  return tween(world, 2600, (e) => orb.position.copy(curve.getPoint(e))).then(() => {
    world.scene.remove(orb);
    const ring = new THREE.Sprite(orb.material.clone()); ring.position.copy(to); world.scene.add(ring);
    tween(world, 1200, (e) => { ring.scale.setScalar(20 + e * 140); ring.material.opacity = 1 - e; }).then(() => world.scene.remove(ring));
  });
}

/* ---------- البيانات الحيّة ---------- */
let last = null, ceremony = false, seenReasons = new Set(), lanterns = [];
const sizeFor = (votes, max) => (votes ? 12 + 30 * Math.sqrt(votes / Math.max(1, max)) : 7);
function apply(d, animate) {
  layout(d.results);
  const max = Math.max(1, ...d.results.map((r) => r.votes));
  for (const r of d.results) {
    const s = stars.get(r.id); if (!s) continue;
    const grew = s.votes >= 0 && r.votes > s.votes;
    s.votes = r.votes; s.pct = r.pct;
    if (ceremony) continue;
    s.lb.querySelector('.tag-sub').textContent = votesWord(r.votes);
    s.lb.classList.toggle('lead', r.rank === 1 && r.votes > 0);
    const target = sizeFor(r.votes, max);
    if (grew && animate) rise(s.pos).then(() => { s.size = target; });
    else s.size = target;
    s.sp.material.opacity = r.votes ? 1 : 0.45;
  }
  $('total').textContent = `${votesWord(d.totals.counted)} · ${d.totals.teachers} معلّماً`;
  if (d.settings.school) $('school').textContent = `سماء ${d.settings.school}`;
  for (const r of d.results) for (const q of r.reasons) {
    if (seenReasons.has(q.id)) continue;
    seenReasons.add(q.id);
    lanterns.unshift({ text: q.text, name: r.name });
  }
  lanterns = lanterns.slice(0, 12);
}
async function poll(animate = true) {
  try {
    const res = await fetch('/api/admin/dashboard');
    if (res.status === 401) return location.replace('/admin');
    const d = await res.json(); apply(d, animate && !!last); last = d;
  } catch { /* نحاول في الدورة التالية */ }
}
await poll(false);
setInterval(() => { if (!document.hidden) poll(); }, 4000);

// رسائل الطلاب تمرّ كفوانيس في أسفل الشاشة
let li = 0;
setInterval(() => {
  if (!lanterns.length || ceremony) { $('lantern').textContent = ''; return; }
  const l = lanterns[li++ % lanterns.length];
  const n = $('lantern'); n.classList.remove('on');
  setTimeout(() => { n.textContent = `«${l.text}» إلى ${l.name}`; n.classList.add('on'); }, 500);
}, 7000);

/* ---------- حفل الإعلان ---------- */
$('ceremony').addEventListener('click', async () => {
  if (!last || ceremony) return;
  ceremony = true; $('ceremony').disabled = true; $('reveal').hidden = true; document.body.classList.remove('revealed'); $('lantern').textContent = '';
  const order = last.results.filter((r) => r.votes).sort((a, b) => a.votes - b.votes);
  const max = Math.max(1, ...order.map((r) => r.votes));
  for (const s of stars.values()) if (s.sp) { s.size = 5; s.sp.material.opacity = 0.3; s.lb.querySelector('.tag-sub').textContent = ''; s.lb.classList.remove('lead'); }
  await new Promise((r) => setTimeout(r, 1500));
  const top = order.length ? order[order.length - 1].votes : 0;
  for (const r of order) {
    const s = stars.get(r.id);
    const final = r.votes === top;
    if (final && order.filter((o) => o.votes === top)[0] === r) await new Promise((res) => setTimeout(res, 1200));   // لحظة صمت قبل الأخير
    await rise(s.pos);
    s.size = sizeFor(r.votes, max); s.sp.material.opacity = 1;
    s.lb.querySelector('.tag-sub').textContent = `${votesWord(r.votes)} · ${r.pct}%`;
    await new Promise((res) => setTimeout(res, final ? 300 : 900));
  }
  const winners = order.filter((r) => r.votes === top);
  for (const w of winners) stars.get(w.id).lb.classList.add('lead');
  if (winners.length) {
    $('reveal-name').textContent = winners.map((w) => w.name).join(' و ');
    $('reveal-meta').textContent = `${votesWord(top)} · ${winners[0].pct}% من الأصوات` + (winners.length > 1 ? ' لكلٍّ منهم' : '');
    $('reveal').hidden = false; document.body.classList.add('revealed');
    if (window.confetti) {
      const fire = window.confetti.create($('fx'), { resize: true });
      const colors = ['#f3c76c', '#e9b44c', '#5cc0b5', '#ffffff'];
      for (let i = 0; i < 9; i++) setTimeout(() => fire({ particleCount: 70, spread: 360, startVelocity: 30, gravity: 0.5, decay: 0.93, ticks: 180, shapes: ['circle'], origin: { x: 0.15 + Math.random() * 0.7, y: 0.1 + Math.random() * 0.3 }, colors }), i * 450);
    }
  }
  setTimeout(() => { ceremony = false; $('ceremony').disabled = false; }, 8000);
});
$('full').addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}));
