/* تحدّي المادة: سباق على شارع الخليج ضد «الغش» و«الكسل».
   - ثلاثة مسارات: ▲▼ للتنقّل، A للقفز فوق العقبات.
   - العقبات عادات سيئة: أصحاب السوء، الجوال، ورقة الغش، السهر. الاصطدام يبطئك.
   - كتب ونجوم على الطريق تزيد النقاط.
   - أسئلة المادة بوابات بعرض الطريق: لكل مسار إجابة، والمسار الصحيح يعطيك دفعة وبطاقة ذهبية.
   - من يصل أولاً يفوز. ومع كل محاولة جديدة يبطؤ المنافسان قليلاً كي لا يعلق أحد. */
import { canvas, rng, starSprite, playerFrames } from './art.js';

const INK = '#2a1f33';
const OBSTACLES = { friends: 'أصحاب السوء', phone: 'الجوال', cheat: 'ورقة الغش', sleep: 'السهر' };
const LANE_NAMES = ['فوق', 'الوسط', 'تحت'];

/* ---------- الرسومات ---------- */
function kartFrames(driver, body, { mask = false, sleepy = false, skin = '#f0c8a0' } = {}) {
  return [0, 1].map((spin) => {
    const [c, g] = canvas(40, 32);
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    g.drawImage(driver, 0, 0, 24, 22, 7, 0, 24, 22);                               // السائق: الرأس والكتفان
    if (mask) { P(14, 9, 15, 3, '#141018'); P(23, 10, 2, 1, '#ffffff'); P(13, 1, 17, 3, '#141018'); }
    if (sleepy) { P(22, 9, 4, 3, skin); P(22, 11, 4, 1, '#3a2a22'); }
    P(0, 11, 5, 9, INK); P(1, 12, 3, 7, body);                                       // الجناح الخلفي
    P(2, 16, 33, 9, INK); P(3, 17, 31, 7, body); P(3, 17, 31, 2, '#ffffff40');       // الهيكل
    P(32, 19, 6, 5, INK); P(32, 20, 5, 3, body); P(37, 21, 2, 3, INK);               // المقدّمة
    P(27, 12, 4, 6, INK); P(28, 13, 2, 4, '#bfe0e8');                                // الزجاج
    P(15, 19, 4, 3, '#f6d79a');
    for (const wx of [4, 25]) {                                                      // العجلات
      P(wx, 22, 10, 10, INK); P(wx + 1, 23, 8, 8, '#1b1b1b');
      P(wx + (spin ? 3 : 4), 25 + (spin ? 1 : 0), 3, 3, '#9a9aa6');
      g.clearRect(wx, 22, 1, 1); g.clearRect(wx + 9, 22, 1, 1); g.clearRect(wx, 31, 1, 1); g.clearRect(wx + 9, 31, 1, 1);
    }
    return c;
  });
}
function obstacleSprite(kind) {
  const [c, g] = canvas(28, 30);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (kind === 'phone') {
    P(7, 1, 15, 28, INK); P(8, 2, 13, 26, '#1b1b22'); P(9, 5, 11, 18, '#5fa8e8');
    P(10, 7, 4, 4, '#f6d79a'); P(15, 7, 4, 4, '#ef8f6a'); P(10, 12, 4, 4, '#5fcf86'); P(15, 12, 4, 4, '#f3e7d3'); P(10, 17, 9, 2, '#ffffff90');
    P(18, 0, 6, 6, INK); P(19, 1, 4, 4, '#e8453b'); P(12, 25, 5, 1, '#666');
  } else if (kind === 'friends') {
    for (const x of [0, 14]) {
      P(x + 1, 3, 12, 10, INK); P(x + 2, 4, 10, 9, '#3a2d3a'); P(x + 4, 7, 6, 5, '#b07850');
      P(x + 5, 8, 1, 1, '#fff'); P(x + 8, 8, 1, 1, '#fff'); P(x + 5, 10, 4, 1, '#ffffff');
      P(x, 13, 14, 11, INK); P(x + 1, 13, 12, 10, '#3a2d3a'); P(x + 2, 24, 4, 6, '#2a2a3a'); P(x + 8, 24, 4, 6, '#2a2a3a');
    }
    P(12, 15, 4, 2, '#b07850');
  } else if (kind === 'cheat') {
    P(3, 1, 22, 28, INK); P(4, 2, 20, 26, '#fbfaf6'); P(20, 2, 4, 4, '#d8d2c4');
    for (let k = 0; k < 5; k++) P(6, 6 + k * 4, 14 - (k % 2) * 4, 1, '#8aa0c8');
    P(6, 8, 7, 1, '#c8453b'); P(8, 20, 9, 1, '#c8453b');
    P(15, 13, 6, 1, '#c8453b'); P(15, 14, 1, 3, '#c8453b');
  } else {                                                                         // السهر: منبّه وقمر
    P(3, 3, 6, 5, INK); P(19, 3, 6, 5, INK); P(4, 4, 4, 3, '#e8453b'); P(20, 4, 4, 3, '#e8453b');
    P(4, 6, 20, 20, INK); P(5, 7, 18, 18, '#e8453b'); P(7, 9, 14, 14, '#fbfaf6');
    P(13, 11, 2, 6, INK); P(13, 16, 5, 2, INK); P(6, 26, 4, 4, INK); P(18, 26, 4, 4, INK);
    P(22, 0, 6, 6, '#f6d79a'); P(24, 0, 4, 4, '#00000000');
  }
  return c;
}
function bookSprite() {
  const [c, g] = canvas(14, 12);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  P(0, 0, 14, 12, INK); P(1, 1, 12, 10, '#c8453b'); P(10, 1, 3, 10, '#8f2f28'); P(1, 8, 9, 3, '#f3e7d3'); P(4, 3, 3, 3, '#f6d79a');
  return c;
}

/* ---------- السباق ---------- */
export function createRace(o) {
  const { W, H, scene, look, questions, retries, ui, sound } = o;
  const roadTop = Math.round(H * 0.5), roadBot = Math.round(H * 0.86), lh = (roadBot - roadTop) / 3;
  const laneY = (l) => roadTop + (l + 1) * lh - 3;
  const v = Math.max(80, W * 0.47);                         // سرعة تعطي نحو ثانية ونصف لرؤية ما أمامك
  const L = Math.round(v * 34);
  const ease = Math.max(0.78, 1 - 0.07 * retries);           // كل محاولة جديدة أسهل قليلاً
  const px = W * 0.3;
  const r = rng(Math.floor(Math.random() * 1e6) + 1);

  const me = { d: 0, lane: 1, ly: laneY(1), sp: 0, slowT: 0, boostT: 0, jumpT: 0, bumpT: 0, frames: kartFrames(playerFrames(look)[4], '#e9b44c') };
  const rivals = [
    { key: 'cheat', name: 'الغش', d: 0, lane: 0, base: 1.0, sp: 0, slowT: 0, trickT: 0, nextTrick: 5 + r() * 3, nextLane: 3 + r() * 3,
      frames: kartFrames(playerFrames({ outfit: 'hoodie', head: 'hair', skin: '#d9a578', color: '#3a2a44' })[4], '#6b3d7a', { mask: true }) },
    { key: 'lazy', name: 'الكسل', d: 0, lane: 2, base: 0.86, sp: 0, slowT: 0, sleepT: 0, nextSleep: 6 + r() * 3, nextLane: 4 + r() * 3,
      frames: kartFrames(playerFrames({ outfit: 'dishdasha', head: 'taqiya', skin: '#f0c8a0', color: '#d9c7a3' })[4], '#7a9a5a', { sleepy: true, skin: '#f0c8a0' }) },
  ];
  for (const rv of rivals) rv.ly = laneY(rv.lane);

  // البوابات: أسئلة المادة موزّعة على الطريق
  const gates = questions.slice(0, 3).map((q, i, a) => ({ q, d: Math.round(L * (0.25 + (0.55 * (i + 0.5)) / a.length)), passed: false, result: null, lane: -1 }));
  // العقبات والجوائز: عقبة واحدة في كل موضع فيبقى مساران مفتوحان دائماً
  const obsImg = Object.fromEntries(Object.keys(OBSTACLES).map((k) => [k, obstacleSprite(k)]));
  const book = bookSprite(), star = starSprite(5, '#f6c453');
  const items = [];
  const nearGate = (d) => gates.some((gt) => d > gt.d - v * 1.8 && d < gt.d + v * 0.7);
  const kinds = Object.keys(OBSTACLES);
  for (let d = v * 2.6; d < L - v * 1.2; d += v * (1.05 + r() * 0.7)) {
    if (nearGate(d)) continue;
    items.push({ type: 'ob', kind: kinds[Math.floor(r() * kinds.length)], d: Math.round(d), lane: Math.floor(r() * 3) });
    const pd = d + v * (0.45 + r() * 0.2);
    if (!nearGate(pd)) items.push({ type: r() < 0.25 ? 'star' : 'book', d: Math.round(pd), lane: Math.floor(r() * 3) });
  }

  const R = { t: 0, phase: 'count', score: 0, rank: 0, shake: 0, overtook: false, behindT: 0, done: false, active: null };
  const banner = ui.banner;
  const add = (n) => { R.score += n; ui.score(n); };

  function showBanner(gt) {
    banner.replaceChildren();
    const q = document.createElement('p'); q.className = 'q'; q.textContent = gt.q.q;
    const list = document.createElement('div'); list.className = 'lanes';
    gt.q.choices.slice(0, 3).forEach((c, k) => {
      const row = document.createElement('span'); row.className = 'lane'; row.dataset.k = k;
      const tagEl = document.createElement('small'); tagEl.textContent = LANE_NAMES[k];
      const b = document.createElement('b'); b.textContent = c;
      row.append(tagEl, b); list.append(row);
    });
    const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'ادخل بوابة الإجابة الصحيحة: ▲▼ لتغيير المسار';
    banner.append(q, list, hint);
    banner.hidden = false;
  }
  async function crossGate(gt) {
    gt.passed = true; gt.lane = me.lane;
    sound.sfx.gate();
    const res = await ui.gate(gt.q, me.lane);
    const ok = !!(res && res.correct);
    gt.result = ok; gt.answer = res ? res.answer : -1;
    banner.querySelectorAll('.lane').forEach((n) => {
      const k = Number(n.dataset.k);
      if (k === gt.answer) n.classList.add('right'); else if (k === gt.lane) n.classList.add('wrong');
    });
    if (ok) { me.boostT = 1.7; sound.voice('correct'); add(500); }
    else { me.slowT = Math.max(me.slowT, 0.7); add(100); }
    setTimeout(() => { if (R.active === gt) { banner.hidden = true; R.active = null; } }, 1100);
  }

  function step(dt, input) {
    R.t += dt;
    R.shake = Math.max(0, R.shake - dt);
    if (R.phase === 'count') {
      if (R.t >= 3) { R.phase = 'go'; R.t = 0; sound.voice('start'); }
      return;
    }
    // سؤال قريب: الجميع يبطئ كي يقرأ الطالب
    const next = gates.find((gt) => !gt.passed);
    if (next && next.d - me.d < v * 5 && R.active !== next) { R.active = next; showBanner(next); }
    const qMul = next && next.d - me.d < v * 5 ? 0.62 : 1;

    // اللاعب
    if (R.phase === 'go') {
      if (input.up) { if (me.lane > 0) { me.lane--; sound.sfx.whoosh(); } input.up = false; }
      if (input.down) { if (me.lane < 2) { me.lane++; sound.sfx.whoosh(); } input.down = false; }
    }
    me.slowT = Math.max(0, me.slowT - dt); me.boostT = Math.max(0, me.boostT - dt); me.jumpT = Math.max(0, me.jumpT - dt); me.bumpT = Math.max(0, me.bumpT - dt);
    let target = v * 1.04 * qMul;
    if (me.boostT > 0) target *= 1.5;
    if (me.slowT > 0) target *= 0.35;
    if (R.phase === 'end') target = 0;
    me.sp += (target - me.sp) * Math.min(1, dt * (me.slowT > 0 ? 6 : 2.4));
    me.d += me.sp * dt;
    me.ly += (laneY(me.lane) - me.ly) * Math.min(1, dt * 14);
    sound.engine(R.phase === 'end' ? 0 : Math.min(1.4, me.sp / v));

    // المنافسان
    for (const rv of rivals) {
      if (rv.d >= L) { rv.sp = 0; continue; }
      rv.slowT = Math.max(0, rv.slowT - dt);
      let s = v * rv.base * ease * qMul;
      if (rv.key === 'cheat') {
        rv.nextTrick -= dt;
        if (rv.nextTrick <= 0) { rv.trickT = 1.4; rv.nextTrick = 6 + r() * 3; }
        if (rv.trickT > 0) { rv.trickT -= dt; s *= 1.35; }
      } else {
        rv.nextSleep -= dt;
        if (rv.nextSleep <= 0) { rv.sleepT = 1.3; rv.nextSleep = 7 + r() * 4; }
        if (rv.sleepT > 0) { rv.sleepT -= dt; s *= 0.15; }
      }
      if (rv.slowT > 0) s *= 0.5;
      rv.sp += (s - rv.sp) * Math.min(1, dt * 2);
      rv.d = Math.min(L, rv.d + rv.sp * dt);
      rv.nextLane -= dt;
      if (rv.nextLane <= 0) { rv.lane = Math.max(0, Math.min(2, rv.lane + (r() < 0.5 ? -1 : 1))); rv.nextLane = 3 + r() * 3; }
      rv.ly += (laneY(rv.lane) - rv.ly) * Math.min(1, dt * 8);
      // تصادم مع اللاعب
      if (R.phase === 'go' && rv.lane === me.lane && Math.abs(rv.d - me.d) < 24 && me.jumpT <= 0 && me.bumpT <= 0) {
        me.bumpT = 1;
        if (me.d < rv.d) { me.slowT = Math.max(me.slowT, 0.45); } else rv.slowT = 0.6;
        sound.sfx.hit(); R.shake = 0.2;
      }
    }
    // تجاوز الغش أول مرة: «أحسنت يا بطل»
    const cheat = rivals[0];
    if (me.d < cheat.d) R.behindT += dt;
    else if (!R.overtook && R.behindT > 2 && R.phase === 'go') { R.overtook = true; sound.voice('good'); }

    // العقبات والجوائز
    for (const it of items) {
      if (it.done) continue;
      const dx = it.d - me.d;
      if (it.type === 'ob') {
        if (Math.abs(dx) < 14 && it.lane === me.lane && me.jumpT <= 0 && R.phase === 'go') {
          it.done = true; it.hit = true; me.slowT = 1.2; R.shake = 0.3; sound.sfx.hit();
        } else if (dx < -18) { it.done = true; add(50); }
      } else if (Math.abs(dx) < 12 && it.lane === me.lane) {
        it.done = true; it.got = true; sound.sfx.pick(); add(it.type === 'star' ? 200 : 100);
      } else if (dx < -20) it.done = true;
    }
    // البوابات
    for (const gt of gates) if (!gt.passed && me.d >= gt.d) crossGate(gt);

    // خط النهاية
    if (R.phase === 'go' && me.d >= L) {
      R.phase = 'end';
      R.rank = 1 + rivals.filter((rv) => rv.d >= L).length;
      const ahead = rivals.filter((rv) => rv.d >= L).map((rv) => rv.name);
      setTimeout(() => { R.done = true; ui.finish(R.rank, ahead); }, 1200);
    }
    // إن وصل المنافسان كلاهما قبل اللاعب بكثير لا داعي للانتظار
    if (R.phase === 'go' && rivals.every((rv) => rv.d >= L) && L - me.d > v * 3) {
      R.phase = 'end'; R.rank = 3;
      setTimeout(() => { R.done = true; ui.finish(3, rivals.map((rv) => rv.name)); }, 900);
    }
  }

  /* ---------- الرسم ---------- */
  const [roadTile, rt] = canvas(64, roadBot - roadTop);
  rt.fillStyle = '#40343f'; rt.fillRect(0, 0, 64, roadBot - roadTop);
  const rr = rng(3); rt.fillStyle = '#4a3d49';
  for (let i = 0; i < 70; i++) rt.fillRect(Math.floor(rr() * 64), Math.floor(rr() * (roadBot - roadTop)), 1, 1);

  function draw(g, t) {
    const cam = me.d - px;
    const sx = R.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    g.save(); g.translate(sx, 0);
    scene.draw(g, cam * 0.5, t, 0);
    // الطريق
    g.fillStyle = '#9c8590'; g.fillRect(0, roadTop - 4, W, 4);
    for (let x = -(((cam % 64) + 64) % 64); x < W; x += 64) g.drawImage(roadTile, Math.round(x), roadTop);
    g.fillStyle = '#f3e7d3aa';
    for (let k = 1; k < 3; k++) for (let x = -(((cam % 28) + 28) % 28); x < W; x += 28) g.fillRect(Math.round(x), Math.round(roadTop + k * lh) - 1, 14, 2);
    g.fillStyle = '#7d6a76'; g.fillRect(0, roadBot, W, 4);
    g.fillStyle = '#2c222d'; g.fillRect(0, roadBot + 4, W, H - roadBot - 4);
    // خط البداية والنهاية
    for (const [d, lbl] of [[0, null], [L, 'finish']]) {
      const x = Math.round(px + d - me.d);
      if (x < -20 || x > W + 20) continue;
      for (let y = roadTop, k = 0; y < roadBot; y += 6, k++) { g.fillStyle = k % 2 ? INK : '#fbfaf6'; g.fillRect(x, y, 6, 6); g.fillStyle = k % 2 ? '#fbfaf6' : INK; g.fillRect(x + 6, y, 6, 6); }
      if (lbl) { g.fillStyle = INK; g.fillRect(x + 4, roadTop - 40, 4, 40); }
    }
    ui.tag('fin', '<b>خط النهاية</b>', 'finish', px + L - me.d + 6, roadTop - 40, Math.abs(L - me.d) < W);
    // البوابات
    gates.forEach((gt, gi) => {
      const x = Math.round(px + gt.d - me.d);
      const vis = x > -30 && x < W + 30;
      for (let k = 0; k < 3; k++) {
        const y0 = Math.round(roadTop + k * lh);
        if (vis) {
          let col = ['#f6c453', '#5fa8e8', '#ef8f6a'][k];
          if (gt.result != null) col = k === gt.answer ? '#5fcf86' : k === gt.lane ? '#ff6f61' : '#6b5578';
          g.fillStyle = INK; g.fillRect(x - 3, y0 + 1, 10, Math.round(lh) - 2);
          g.fillStyle = col; g.fillRect(x - 2, y0 + 2, 8, Math.round(lh) - 4);
        }
        const c = gt.q.choices[k];
        ui.tag(`g${gi}${k}`, c == null ? '' : `<b>${esc(c)}</b>`, 'gate', x + 2, y0 + lh * 0.62, vis && c != null && gt.result == null);
      }
      if (vis) { g.fillStyle = INK; g.fillRect(x - 3, roadTop - 18, 10, 18); g.fillStyle = '#f6c453'; g.fillRect(x - 2, roadTop - 17, 8, 4); }
    });
    // ترتيب الرسم حسب المسار: الأبعد أولاً
    const ents = [];
    for (const it of items) {
      const x = px + it.d - me.d;
      if (x < -30 || x > W + 30 || it.got) { if (it.type === 'ob') ui.tag('o' + it.d, '', 'ob', 0, 0, false); continue; }
      ents.push({ y: laneY(it.lane), draw: () => {
        const img = it.type === 'ob' ? obsImg[it.kind] : it.type === 'star' ? star : book;
        const bob = it.type === 'ob' ? 0 : Math.round(Math.sin(t * 5 + it.d) * 2);
        g.globalAlpha = it.hit ? 0.45 : 1;
        g.drawImage(img, Math.round(x - img.width / 2), Math.round(laneY(it.lane) - img.height - 2 + bob));
        g.globalAlpha = 1;
        if (it.type === 'ob') ui.tag('o' + it.d, OBSTACLES[it.kind], 'ob' + (it.hit ? ' hit' : ''), x, laneY(it.lane) - img.height - 4, true);
      } });
    }
    for (const rv of rivals) {
      const x = px + rv.d - me.d;
      const vis = x > -40 && x < W + 40;
      ui.tag('rv' + rv.key, `<b>${rv.name}</b>${rv.key === 'cheat' && rv.trickT > 0 ? '<small>يغش!</small>' : rv.key === 'lazy' && rv.sleepT > 0 ? '<small>نايم…</small>' : ''}`, 'rival ' + rv.key, x, rv.ly - 34, vis);
      if (!vis) continue;
      ents.push({ y: rv.ly, draw: () => {
        const img = rv.frames[Math.floor(t * 14) % 2];
        g.drawImage(img, Math.round(x - img.width / 2), Math.round(rv.ly - img.height));
        if (rv.key === 'lazy' && rv.sleepT > 0) { g.fillStyle = '#fff6e6'; g.fillRect(Math.round(x + 8), Math.round(rv.ly - 40 - (t * 10) % 6), 3, 1); }
      } });
    }
    ents.push({ y: me.ly + 0.1, draw: () => {
      const jump = me.jumpT > 0 ? Math.sin((1 - me.jumpT / 0.55) * Math.PI) * 20 : 0;
      const img = me.frames[me.sp > 5 ? Math.floor(t * 16) % 2 : 0];
      g.fillStyle = 'rgba(20,10,24,.35)'; g.fillRect(Math.round(px - 14), Math.round(me.ly - 2), 28, 3);
      if (me.boostT > 0) { g.fillStyle = '#f6d79a'; for (let k = 0; k < 4; k++) g.fillRect(Math.round(px - 24 - k * 6 - (t * 60) % 6), Math.round(me.ly - 10 - jump + k % 2 * 3), 5, 2); }
      g.drawImage(img, Math.round(px - img.width / 2), Math.round(me.ly - img.height - jump));
    } });
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
    g.restore();

    // شريط التقدّم
    const bx = Math.round(W * 0.12), bw = Math.round(W * 0.76), by = roadTop - 12;
    g.fillStyle = 'rgba(42,31,51,.85)'; g.fillRect(bx - 4, by - 4, bw + 8, 9);
    g.fillStyle = '#6b5578'; g.fillRect(bx, by, bw, 1);
    g.fillStyle = '#fbfaf6'; g.fillRect(bx + bw - 1, by - 3, 2, 7);
    const mark = (d, col, big) => { const mx = Math.round(bx + (bw * Math.min(d, L)) / L); g.fillStyle = INK; g.fillRect(mx - (big ? 3 : 2), by - (big ? 3 : 2), big ? 6 : 5, big ? 6 : 5); g.fillStyle = col; g.fillRect(mx - (big ? 2 : 1), by - (big ? 2 : 1), big ? 4 : 3, big ? 4 : 3); };
    mark(rivals[1].d, '#7a9a5a'); mark(rivals[0].d, '#b06ac8'); mark(me.d, '#f6c453', true);

    // العدّ التنازلي
    if (R.phase === 'count' || (R.phase === 'go' && R.t < 0.8)) {
      const n = R.phase === 'count' ? String(3 - Math.floor(R.t)) : 'GO!';
      const size = Math.round(Math.min(W, H) * 0.16);
      g.font = `${size}px "Pixel", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#c8453b'; g.fillText(n, W / 2 + 3, H * 0.33 + 3);
      g.fillStyle = '#f6c453'; g.fillText(n, W / 2, H * 0.33);
    }
  }

  return {
    get done() { return R.done; },
    get score() { return R.score; },
    jump() { if (R.phase === 'go' && me.jumpT <= 0) { me.jumpT = 0.55; sound.sfx.jump(); } },
    update: step,
    draw,
    stop() { sound.engine(0); banner.hidden = true; },
    get rank() { return R.rank; },
    debug: { me, items, gates, rivals, L, v, R },
  };
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
