/* تحدّي المادة: صعود الجبل.
   - يقفز الطالب تلقائياً من صخرة إلى صخرة، ويوجّه نفسه بـ ◀ ▶ (أو بلمس نصف الشاشة).
   - العائقان الأهم: «الكسل» (كتلة نائمة تُثقل قفزك) و«الغش» (يرمي أوراق الغش فتزلّ قدمك).
     القفز فوق رأسيهما من أعلى يغلبهما، ولمسهما من الجانب يُفقدك قلباً.
   - للجبل ثلاث مراحل بعدد الدروس الثلاثة، وفي بداية كل مرحلة مخيّم. السقوط يُفقدك قلباً ويعيدك إلى آخر صخرة وقفت عليها.
   - أسئلة الدروس خلال الصعود: في كل مرحلة صخرة سؤال، وعند نهايتها سؤال (مخيّم المرحلة التالية، والأخير عند القمة).
     الإجابة الصحيحة قفزة عالية وبطاقة ذهبية.
   - ثلاثة قلوب. من يصل القمة يفوز. */
import { canvas, rng, playerFrames, kuwaitTowers } from './art.js';

const INK = '#2a1f33';
const mix = (a, b, t) => {
  const A = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), B = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};

function lazySprite() {
  const [c, g] = canvas(26, 18);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  P(3, 2, 20, 16, INK); P(1, 5, 24, 13, INK); P(4, 3, 18, 14, '#9a8fb8'); P(2, 6, 22, 11, '#9a8fb8');
  P(2, 13, 22, 4, '#7d72a0'); P(5, 4, 8, 2, '#c4bce0');
  P(7, 9, 4, 1, INK); P(15, 9, 4, 1, INK); P(11, 12, 4, 2, '#5a4f78');           // عينان مغمضتان وتثاؤب
  return c;
}
function paperSprite() {
  const [c, g] = canvas(10, 12);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  P(0, 0, 10, 12, INK); P(1, 1, 8, 10, '#fbfaf6'); P(2, 3, 6, 1, '#8aa0c8'); P(2, 5, 5, 1, '#c8453b'); P(2, 7, 6, 1, '#8aa0c8');
  return c;
}
function heart(g, x, y, on) {
  const rows = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') { g.fillStyle = on ? (j === 1 && i === 1 ? '#ffb3a8' : '#e8453b') : '#4a3d55'; g.fillRect(x + i, y + j, 1, 1); } }));
}

export function createClimb(o) {
  const { W, H, K, look, lessons, retries, ui, sound } = o;
  const k = Math.max(1, K - 1);                               // حجم الشخصية على الجبل
  const frames = playerFrames(look);
  const cheatFrames = playerFrames({ outfit: 'hoodie', head: 'hair', skin: '#d9a578', color: '#3a2a44' });
  const lazyImg = lazySprite(), paperImg = paperSprite(), towers = kuwaitTowers(Math.round(H * 0.5));
  const r = rng(Math.floor(Math.random() * 1e6) + 1);

  // فيزياء القفز: ارتفاع القفزة نحو ٠٫٣ من الشاشة
  const hJ = H * 0.3, up = 0.55, G = (2 * hJ) / (up * up), JV = G * up;
  const vmax = Math.min(W * 0.85, H * 0.75);
  const A = Math.round(H * 7);                                 // ارتفاع الجبل
  const cx = W / 2;
  const halfW = (a) => W * 0.5 * (0.98 - 0.42 * Math.min(1, Math.max(0, a / A))) + Math.sin(a * 0.031) * 5;
  const ease = Math.max(0.35, 1 - 0.25 * retries);             // كل محاولة جديدة: عوائق أقل

  /* ---------- بناء الجبل ---------- */
  const ledges = [{ x: 0, w: W, a: 0, camp: 0 }];
  const enemies = [], items = [];
  const campAt = [A / 3, (2 * A) / 3];
  let a = 0, prevC = cx, nextCamp = 0;
  while (a < A - H * 0.2) {
    a += H * (0.15 + r() * 0.08);
    if (nextCamp < 2 && a >= campAt[nextCamp]) {
      const hw = halfW(a) * 0.9;
      ledges.push({ x: cx - hw, w: hw * 2, a, camp: nextCamp + 1 });
      nextCamp++; prevC = cx; continue;
    }
    const hw = halfW(a), w = Math.max(40, Math.min(120, W * 0.3)) * (0.8 + r() * 0.4);
    const lo = cx - hw + 4, hi = cx + hw - w - 4;
    let x = prevC - w / 2 + (r() - 0.5) * Math.min(W * 0.9, vmax * 0.9 * 2);
    x = Math.max(lo, Math.min(hi, x));
    const stage = a / A;
    const L = { x, w, a, vx: stage > 0.68 && r() < 0.35 ? (r() < 0.5 ? -1 : 1) * H * 0.06 : 0, lo, hi };
    ledges.push(L);
    prevC = x + w / 2;
    // العوائق والجوائز على الصخرة
    const roll = r(), calmStart = a < H * 1.3;                 // أول الجبل بلا عوائق كي يتعلّم الطالب الحركة
    const pl = calmStart ? 0 : (0.1 + 0.12 * stage) * ease, pc = calmStart ? 0 : (0.06 + 0.1 * stage) * ease;
    if (roll < pl) enemies.push({ type: 'lazy', ledge: L, off: r() * (w - 26), dir: r() < 0.5 ? -1 : 1 });
    else if (roll < pl + pc) enemies.push({ type: 'cheat', ledge: L, off: r() < 0.5 ? 2 : w - 16, t: 1 + r() * 2 });
    else if (roll < 0.62) items.push({ type: r() < 0.22 ? 'star' : 'book', ledge: L, off: w / 2, got: false });
  }
  const top = { x: cx - halfW(A) * 0.8, w: halfW(A) * 1.6, a: A, summit: true };
  ledges.push(top);
  const papers = [];

  /* ---------- أسئلة الدروس على الطريق ---------- */
  const stageQs = [[], [], []], loose = [];
  for (const q of o.questions || []) { const st = lessons.indexOf(q.lesson); (st >= 0 ? stageQs[st] : loose).push(q); }
  for (const q of loose) stageQs[[0, 1, 2].sort((x, y) => stageQs[x].length - stageQs[y].length)[0]].push(q);
  const ends = [ledges.find((L) => L.camp === 1), ledges.find((L) => L.camp === 2), top];
  const qLedges = [];
  stageQs.forEach((list, st) => {
    if (!list.length) return;
    const end = ends[st], lo = (st * A) / 3, hi = ((st + 1) * A) / 3;
    const mids = list.slice(0, -1);
    mids.forEach((q, j) => {
      const target = lo + ((hi - lo) * (j + 1)) / (mids.length + 1);
      const L = ledges.filter((x) => !x.camp && !x.summit && x.a > lo + H * 0.25 && x.a < hi - H * 0.25 && !x.vx && !x.qs)
        .sort((x, y) => Math.abs(x.a - target) - Math.abs(y.a - target))[0];
      const host = L || end;
      if (L) {                                                           // صخرة السؤال: أعرض، وبلا عوائق
        const hw = halfW(L.a), nw = Math.max(L.w, Math.min(W * 0.45, hw * 1.4));
        L.x = Math.max(cx - hw + 4, Math.min(cx + hw - nw - 4, L.x + L.w / 2 - nw / 2)); L.w = nw;
        for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].ledge === L) enemies.splice(i, 1);
      }
      (host.qs = host.qs || []).push({ q, stage: st });
    });
    (end.qs = end.qs || []).push({ q: list[list.length - 1], stage: st });
  });
  for (const L of ledges) if (L.qs) { qLedges.push(L); for (const it of items) if (it.ledge === L) it.got = true; }

  /* ---------- الحالة ---------- */
  const me = { x: cx, a: 0, va: JV, vx: 0, dir: 1, hearts: 3, inv: 0, lazyT: 0, cp: ledges[0] };
  const S = { cam: 0, t: 0, done: false, won: false, phase: 'go', score: 0, shake: 0, goodCd: 0, best: 0, boostT: 0 };
  const add = (n) => { S.score += n; ui.score(n); };
  const yOf = (alt) => H * 0.88 - (alt - S.cam);
  const ledgeX = (L) => L.x;

  function hurt(kind) {
    if (me.inv > 0 || S.phase !== 'go') return;
    me.hearts--; me.inv = 1.5; S.shake = 0.3; sound.sfx.hit();
    if (kind === 'lazy') me.lazyT = 2.5;
    else me.va = -JV * 0.35;
    if (me.hearts <= 0) lose();
  }
  function lose() {
    S.phase = 'lost'; sound.voice('again');
    setTimeout(() => { S.done = true; ui.finish(false); }, 900);
  }
  function respawn() {
    me.hearts--; sound.sfx.hit();
    if (me.hearts <= 0) { lose(); return; }
    const L = me.cp;
    me.x = L.x + L.w / 2; me.a = L.a + 1; me.va = JV; me.inv = 1.5; me.lazyT = 0;
    S.cam = Math.max(0, L.a - H * 0.25);
  }

  function step(dt, input) {
    S.t += dt; S.shake = Math.max(0, S.shake - dt); S.goodCd = Math.max(0, S.goodCd - dt);
    if (S.phase === 'summit' || S.phase === 'lost' || S.phase === 'ask') { me.va = 0; return; }
    S.boostT = Math.max(0, S.boostT - dt);
    if (S.t < 0.05 && !S.started) { S.started = true; sound.voice('start'); }
    // صخور متحرّكة
    for (const L of ledges) if (L.vx) { L.x += L.vx * dt; if (L.x < L.lo || L.x > L.hi) { L.vx *= -1; L.x = Math.max(L.lo, Math.min(L.hi, L.x)); } }
    // الحركة الأفقية
    const lazy = me.lazyT > 0;
    me.lazyT = Math.max(0, me.lazyT - dt); me.inv = Math.max(0, me.inv - dt);
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const vm = vmax * (lazy ? 0.5 : 1);
    me.vx += (dir * vm - me.vx) * Math.min(1, dt * (dir ? 9 : 6));
    if (dir) me.dir = dir;
    const hw = halfW(me.a);
    me.x = Math.max(cx - hw + 6, Math.min(cx + hw - 6, me.x + me.vx * dt));
    // الجاذبية والهبوط على الصخور
    const prevA = me.a;
    me.va -= G * dt; me.a += me.va * dt;
    if (me.va < 0) {
      for (const L of ledges) {
        if (prevA >= L.a - 0.5 && me.a <= L.a && me.x > ledgeX(L) - 5 && me.x < ledgeX(L) + L.w + 5) {
          me.a = L.a; me.va = JV * (lazy ? 0.82 : 1);
          sound.sfx.step();
          if (L.camp && !L.reached) { L.reached = true; add(150); sound.sfx.gate(); ui.camp(L.camp); }
          if (!L.vx) me.cp = L;                                          // السقوط يعيدك إلى آخر صخرة وقفت عليها
          if (L.qs && !L.asked) { askAt(L); return; }
          if (L.summit) { win(); return; }
          break;
        }
      }
    }
    S.best = Math.max(S.best, me.a);
    // الكاميرا ترتفع مع الطالب ولا تنزل
    S.cam = Math.max(S.cam, me.a - H * 0.42);
    if (yOf(me.a) > H + 30) { respawn(); return; }

    // العوائق
    for (const e of enemies) {
      if (e.dead) continue;
      const L = e.ledge;
      if (e.type === 'lazy') {
        e.off += e.dir * 12 * dt;
        if (e.off < 0 || e.off > L.w - 26) { e.dir *= -1; e.off = Math.max(0, Math.min(L.w - 26, e.off)); }
      } else {
        e.t -= dt;
        const face = e.off < L.w / 2 ? 1 : -1;
        // يرمي ورقة الغش حين يكون الطالب قريباً منه فقط، وتطير ببطء لمسافة محدودة
        if (e.t <= 0 && Math.abs(L.a - me.a) < H * 0.22) { e.t = 2.6 + r() * 1.4; const x0 = L.x + e.off + 7 + face * 8; papers.push({ x: x0, x0, a: L.a + 22, vx: face * Math.max(36, W * 0.16) }); }
      }
      const ex = L.x + e.off, ew = e.type === 'lazy' ? 26 : 14, eh = e.type === 'lazy' ? 18 : 40;
      const pw = 10 * k, ph = 40 * k;
      const overlap = me.x + pw / 2 > ex && me.x - pw / 2 < ex + ew && me.a < L.a + eh && me.a + ph > L.a;
      if (!overlap) continue;
      if (me.va < 0 && prevA >= L.a + eh - 6) {
        e.dead = true; me.va = JV * 1.05; add(e.type === 'lazy' ? 200 : 300); sound.sfx.pick();
        ui.burst(ex + ew / 2, yOf(L.a + eh / 2), e.type);
        if (S.goodCd <= 0) { sound.voice('good'); S.goodCd = 8; }
      } else hurt(e.type);
    }
    for (const p of papers) {
      p.x += p.vx * dt;
      if (p.x < -20 || p.x > W + 20 || Math.abs(p.x - p.x0) > Math.max(110, W * 0.55)) p.gone = true;
      if (!p.gone && Math.abs(p.x - me.x) < 8 && p.a > me.a && p.a < me.a + 40 * k) { p.gone = true; hurt('cheat'); }
    }
    for (let i = papers.length - 1; i >= 0; i--) if (papers[i].gone) papers.splice(i, 1);
    // الجوائز
    for (const it of items) {
      if (it.got) continue;
      const ix = it.ledge.x + it.off, ia = it.ledge.a + 14;
      if (Math.abs(ix - me.x) < 10 && ia > me.a - 4 && ia < me.a + 40 * k) { it.got = true; sound.sfx.pick(); add(it.type === 'star' ? 200 : 100); }
    }
  }
  /** توقّف على صخرة السؤال: الصحيحة قفزة عالية، والخطأ قفزة عادية */
  async function askAt(L) {
    L.asked = true; S.phase = 'ask'; me.va = 0; me.a = L.a; me.vx = 0;
    let ok = false;
    L.results = [];
    for (const { q, stage } of L.qs) { ok = await ui.ask(q, stage); L.results.push(ok); }
    if (L.summit) { win(); return; }
    S.phase = 'go';
    me.va = JV * (ok ? 1.65 : 1); me.inv = Math.max(me.inv, ok ? 1.2 : 0.6);
    if (ok) S.boostT = 1.3;
  }
  function win() {
    S.phase = 'summit'; me.va = 0; me.a = A; S.won = true;
    sound.voice('win'); add(1000);
    setTimeout(() => { S.done = true; ui.finish(true); }, 1300);
  }

  /* ---------- الرسم ---------- */
  function draw(g, t) {
    const f = Math.min(1, S.cam / A);
    const sx = S.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    g.save(); g.translate(sx, 0);
    // السماء: من الغروب إلى الليل كلما صعدت
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, mix('#5a4266', '#141026', f)); grad.addColorStop(1, mix('#f0a263', '#3a2d55', f));
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    if (f > 0.3) {
      const sr = rng(5);
      g.fillStyle = `rgba(255,246,220,${Math.min(1, (f - 0.3) * 2)})`;
      for (let i = 0; i < 70; i++) { const x = sr() * W, y = sr() * H * 0.8; if ((Math.sin(t * 2 + i) + 1) > 0.4) g.fillRect(Math.round(x), Math.round(y), 1, 1); }
    }
    // جبال بعيدة ومدينة الكويت في الأسفل
    const far = (shift, col, amp, base) => {
      g.fillStyle = col;
      for (let x = 0; x < W; x += 2) {
        const yy = base + S.cam * shift - (Math.sin(x * 0.02 + shift * 10) * amp + Math.sin(x * 0.053) * amp * 0.5);
        g.fillRect(x, Math.round(yy), 2, H);
      }
    };
    far(0.15, mix('#8a5a6e', '#2a2244', f), H * 0.08, H * 0.55);
    if (S.cam < H * 1.5) g.drawImage(towers, Math.round(W * 0.06), Math.round(H * 0.88 + S.cam * 0.45 - towers.height));
    far(0.3, mix('#6b4a6b', '#221b38', f), H * 0.06, H * 0.72);
    // وجه الجبل
    for (let y = 0; y < H; y += 2) {
      const alt = S.cam + (H * 0.88 - y);
      if (alt < -10) continue;
      const hw = halfW(alt);
      const band = Math.floor(alt / 10) % 2;
      g.fillStyle = band ? '#93705c' : '#8a6652';
      g.fillRect(Math.round(cx - hw), y, Math.round(hw * 2), 2);
      g.fillStyle = '#6e5042'; g.fillRect(Math.round(cx - hw), y, 3, 2); g.fillRect(Math.round(cx + hw - 3), y, 3, 2);
      if (Math.floor(alt / 2) % 23 === 0) { g.fillStyle = '#6e5042'; g.fillRect(Math.round(cx + Math.sin(alt) * hw * 0.6), y, 7, 1); }
    }
    // الأرض عند السفح
    const gy = yOf(0);
    if (gy < H) { g.fillStyle = '#c9a97a'; g.fillRect(0, Math.round(gy), W, H); g.fillStyle = '#e6c896'; g.fillRect(0, Math.round(gy), W, 3); }
    // الصخور
    for (const L of ledges) {
      const y = Math.round(yOf(L.a));
      if (y < -30 || y > H + 20 || L.a === 0) continue;
      const x = Math.round(L.x), w = Math.round(L.w);
      g.fillStyle = INK; g.fillRect(x - 1, y - 1, w + 2, 12);
      g.fillStyle = '#7a5a4a'; g.fillRect(x, y + 3, w, 8);
      g.fillStyle = '#e6c896'; g.fillRect(x, y, w, 4);
      g.fillStyle = '#5a4038'; g.fillRect(x + 2, y + 9, w - 4, 2);
      if (L.camp) {                                                        // المخيّم: خيمة وعلم المرحلة
        const tx = x + Math.round(w * 0.18);
        for (let i = 0; i < 14; i++) { g.fillStyle = i % 4 < 2 ? '#c8453b' : '#f3e7d3'; g.fillRect(tx + i, y - Math.min(i, 13 - i) * 1.4 - 2, 1, Math.min(i, 13 - i) * 1.4 + 2); }
        g.fillStyle = INK; g.fillRect(x + w - 18, y - 26, 2, 26); g.fillStyle = '#f6c453'; g.fillRect(x + w - 16, y - 26, 10, 7);
      }
      if (L.qs && !L.summit && !L.camp) {                                // لوح السؤال الحجري
        const sx = Math.round(L.x + L.w / 2) - 8, done = L.asked;
        g.fillStyle = INK; g.fillRect(sx - 1, y - 19, 18, 18);
        g.fillStyle = done ? '#6b5f58' : '#a39488'; g.fillRect(sx, y - 18, 16, 16);
        g.fillStyle = done ? (L.results && L.results.every(Boolean) ? '#5fcf86' : '#c9b49c') : '#f6c453';
        for (const [px2, py2] of [[5, 3], [6, 3], [7, 3], [8, 3], [9, 4], [10, 5], [10, 6], [9, 7], [8, 8], [7, 9], [7, 10], [7, 13]]) g.fillRect(sx + px2 - 1, y - 18 + py2, 2, 1);
      }
      if (L.summit) {
        g.fillStyle = INK; g.fillRect(Math.round(cx) - 1, y - 40, 3, 40);
        g.fillStyle = '#f6c453'; g.fillRect(Math.round(cx) + 2, y - 40, 18, 12); g.fillStyle = '#fff6e6'; g.fillRect(Math.round(cx) + 9, y - 36, 4, 4);
      }
    }
    ui.tag('stage1', lessons[0] ? `<b>المرحلة ١</b><small>${lessons[0]}</small>` : '<b>المرحلة ١</b>', 'camp', W * 0.5, yOf(0) - 46, yOf(0) < H + 10 && yOf(0) > 60);
    ledges.filter((L) => L.camp).forEach((L) => {
      const y = yOf(L.a), lab = lessons[L.camp];
      ui.tag('camp' + L.camp, `<b>المرحلة ${L.camp === 1 ? '٢' : '٣'}</b>${lab ? `<small>${lab}</small>` : ''}`, 'camp', L.x + L.w * 0.62, y - 30, y > 60 && y < H + 10);
    });
    ui.tag('summit', top.qs ? '<b>القمة</b><small>سؤال أخير</small>' : '<b>القمة</b>', 'camp gold', cx, yOf(A) - 44, yOf(A) > 50 && yOf(A) < H);
    qLedges.forEach((L, i) => {
      if (L.camp || L.summit) return;
      const y = yOf(L.a), st = L.qs[0].stage;
      ui.tag('q' + i, L.asked ? `<b>${L.results && L.results.every(Boolean) ? 'أحسنت ✓' : 'تمّ'}</b>` : `<b>سؤال</b><small>${lessons[st] || `المرحلة ${['١', '٢', '٣'][st]}`}</small>`, 'qmark' + (L.asked ? ' done' : ''), L.x + L.w / 2, y - 22, y > 50 && y < H + 10);
    });
    // الجوائز
    for (const it of items) {
      if (it.got) continue;
      const x = it.ledge.x + it.off, y = yOf(it.ledge.a) - 10 + Math.sin(t * 4 + it.off) * 2;
      if (y < -10 || y > H + 10) continue;
      if (it.type === 'star') { g.fillStyle = '#f6c453'; g.fillRect(Math.round(x) - 4, Math.round(y) - 1, 9, 3); g.fillRect(Math.round(x) - 1, Math.round(y) - 4, 3, 9); }
      else { g.fillStyle = INK; g.fillRect(Math.round(x) - 6, Math.round(y) - 5, 12, 10); g.fillStyle = '#c8453b'; g.fillRect(Math.round(x) - 5, Math.round(y) - 4, 10, 8); g.fillStyle = '#f3e7d3'; g.fillRect(Math.round(x) - 5, Math.round(y) + 2, 8, 2); }
    }
    // العوائق
    enemies.forEach((e, i) => {
      const L = e.ledge, x = L.x + e.off, y = yOf(L.a);
      const vis = !e.dead && y > -40 && y < H + 40;
      ui.tag('en' + i, e.type === 'lazy' ? '<b>الكسل</b>' : '<b>الغش</b>', 'foe ' + e.type, x + (e.type === 'lazy' ? 13 : 7), y - (e.type === 'lazy' ? 22 : 44), vis);
      if (!vis) return;
      if (e.type === 'lazy') {
        const bob = Math.round(Math.sin(t * 2 + i) * 1);
        g.drawImage(lazyImg, Math.round(x), Math.round(y - 18 + bob));
        g.fillStyle = '#e8e2f6'; const zt = (t * 0.8 + i) % 1; g.fillRect(Math.round(x + 20 + zt * 6), Math.round(y - 22 - zt * 10), 3, 1);
      } else {
        const img = cheatFrames[4], w = 24 * k, h = 48 * k, face = e.off < L.w / 2 ? 1 : -1;
        const dx = Math.round(x + 7 - w / 2), dy = Math.round(y - h);
        g.save(); g.translate(face < 0 ? dx + w : dx, dy); g.scale(face < 0 ? -1 : 1, 1);
        g.drawImage(img, 0, 0, w, h);
        g.fillStyle = '#141018'; g.fillRect(13 * k, 9 * k, 9 * k, 3 * k); g.fillRect(7 * k, 1 * k, 14 * k, 3 * k);    // القناع والقبّعة
        g.restore();
      }
    });
    for (const p of papers) { const y = yOf(p.a); g.drawImage(paperImg, Math.round(p.x - 5), Math.round(y - 6 + Math.sin(p.x * 0.2) * 2)); }
    // الطالب (يومض بعد الإصابة فقط، لا بعد القفزة العالية)
    if (S.boostT > 0) { g.fillStyle = '#f6d79a'; for (let i = 0; i < 6; i++) g.fillRect(Math.round(me.x - 6 + ((i * 37 + t * 90) % 12)), Math.round(yOf(me.a) + 2 + i * 6), 2, 3); }
    if (!(me.inv > 0 && S.boostT <= 0 && Math.floor(t * 12) % 2)) {
      const img = frames[me.va > 0 ? 5 : 4], w = 24 * k, h = 48 * k;
      const x = Math.round(me.x - w / 2), y = Math.round(yOf(me.a) - h);
      if (me.dir < 0) { g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(img, 0, 0, w, h); g.restore(); }
      else g.drawImage(img, x, y, w, h);
      if (me.lazyT > 0) { g.fillStyle = '#c4bce0'; g.fillRect(x + w - 2, y - 4 - Math.round((t * 8) % 4), 4, 1); }
    }
    ui.tag('me', me.lazyT > 0 ? '<b>ثقيل… كسلان!</b>' : '', 'foe lazy', me.x, yOf(me.a) - 48 * k - 4, me.lazyT > 0);
    g.restore();

    // القلوب وشريط الارتفاع
    for (let i = 0; i < 3; i++) { const hx = W - 10 - (i + 1) * 10; g.save(); g.translate(hx, 30); g.scale(1, 1); heart(g, 0, 0, i < me.hearts); g.restore(); }
    const bx = 5, by0 = Math.round(H * 0.22), by1 = Math.round(H * 0.78);
    g.fillStyle = 'rgba(42,31,51,.8)'; g.fillRect(bx - 2, by0 - 2, 7, by1 - by0 + 4);
    g.fillStyle = '#6b5578'; g.fillRect(bx + 1, by0, 1, by1 - by0);
    for (const c of [1 / 3, 2 / 3, 1]) { g.fillStyle = c === 1 ? '#f6c453' : '#c8453b'; g.fillRect(bx, Math.round(by1 - (by1 - by0) * c), 3, 2); }
    const py = Math.round(by1 - (by1 - by0) * Math.min(1, me.a / A));
    g.fillStyle = INK; g.fillRect(bx - 1, py - 2, 5, 5); g.fillStyle = '#f6c453'; g.fillRect(bx, py - 1, 3, 3);
  }

  return {
    update: step, draw,
    get done() { return S.done; },
    get won() { return S.won; },
    get score() { return S.score; },
    stop() {},
    debug: { me, ledges, enemies, A, S },
  };
}
