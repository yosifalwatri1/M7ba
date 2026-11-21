/* مشهد ليل الكويت: أبراج الكويت وبرج التحرير فوق مياه الخليج.
   يُرسم كـ SVG داخل أي عنصر عليه data-skyline:
     data-skyline="hero"  المشهد الكامل (سماء، نجوم، بحر، انعكاس)
     data-skyline="ink"   ظلّ مسطّح بلون واحد للطباعة
   مساحة الرسم 3200×520 والمحتوى في المنتصف، فيبقى ظاهراً من الجوال إلى الشاشات العريضة. */
(() => {
  'use strict';
  const W = 3200, H = 520, SEA = 440;

  // عشوائية ثابتة: المشهد نفسه في كل مرة
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const f = (n) => Math.round(n * 10) / 10;

  // برج التحرير: نصف العرض عند كل ارتفاع (من القاعدة إلى القمة)
  function liberation(cx) {
    const prof = [[SEA, 18], [222, 8.5], [210, 23], [190, 23], [180, 15], [172, 11], [150, 7], [134, 5]];
    const left = prof.map(([y, hw]) => `${f(cx - hw)},${y}`);
    const right = prof.slice().reverse().map(([y, hw]) => `${f(cx + hw)},${y}`);
    return `<polygon class="lib" points="${left.join(' ')} ${right.join(' ')}"/>
      <rect class="lib" x="${cx - 1.6}" y="66" width="3.2" height="70"/>
      <rect class="lib" x="${cx - 0.8}" y="50" width="1.6" height="18"/>
      <line class="pod-light" x1="${cx - 20}" y1="200" x2="${cx + 20}" y2="200"/>
      <line class="pod-light dim" x1="${cx - 13}" y1="184" x2="${cx + 13}" y2="184"/>`;
  }

  function shaft(cx, baseHw, topY, topHw, spireY) {
    return `<polygon class="shaft" points="${f(cx - baseHw)},${SEA} ${f(cx - topHw)},${topY} ${f(cx + topHw)},${topY} ${f(cx + baseHw)},${SEA}"/>
      <polygon class="shaft" points="${f(cx - topHw * 0.7)},${topY} ${cx},${spireY} ${f(cx + topHw * 0.7)},${topY}"/>`;
  }
  function sphere(id, cx, cy, r) {
    return `<g class="sphere"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-seq)"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-shade)"/>
      <circle class="sheen" cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-sheen)"/></g>`;
  }

  // أبراج الكويت: البرج الرئيسي بكرتين، الثاني بكرة واحدة، الثالث إبرة
  function kuwaitTowers(id) {
    return `<path class="plinth" d="M1598 ${SEA} L1612 431 L1788 431 L1802 ${SEA} Z"/>
      ${shaft(1630, 4, 250, 1.1, 226)}
      ${shaft(1760, 5.5, 214, 2, 176)}
      ${shaft(1690, 6.5, 160, 2.4, 102)}
      ${sphere(id, 1760, 266, 27)}
      ${sphere(id, 1690, 300, 31)}
      ${sphere(id, 1690, 223, 17)}`;
  }

  function city(rand, ink) {
    let out = '', win = '', x = 0;
    while (x < W) {
      const w = 16 + rand() * 46;
      const nearLib = x > 1240 && x < 1560, nearKt = x > 1580 && x < 1820;
      const far = Math.abs(x + w / 2 - 1600) / 1600;               // 0 في المنتصف، 1 على الأطراف
      let h = 10 + rand() * (nearLib ? 110 : 70) * (1 - far * 0.55);
      if (nearKt) h = Math.min(h, 22);                              // الأبراج على الساحل: لا مبانٍ عالية أمامها
      if (!nearKt && rand() > 0.93) h += 60 + rand() * 50;          // أبراج سكنية متفرّقة
      out += `<rect x="${f(x)}" y="${f(SEA - h)}" width="${f(w - 2)}" height="${f(h)}"/>`;
      if (!ink && h > 24) {
        const n = Math.floor(h / 16);
        for (let i = 0; i < n; i++) {
          if (rand() > 0.42) continue;
          const wx = x + 4 + rand() * (w - 12), wy = SEA - h + 6 + i * 14;
          win += `<rect class="win${rand() > 0.85 ? ' tw' : ''}" style="--d:${f(rand() * 6)}s" x="${f(wx)}" y="${f(wy)}" width="2.4" height="3.4"/>`;
        }
      }
      x += w;
    }
    return `<g class="city">${out}</g>${win ? `<g class="wins">${win}</g>` : ''}`;
  }

  function scene(kind, id) {
    const ink = kind === 'ink';
    const rand = rng(1961);                                         // سنة الاستقلال
    const land = `${city(rand, ink)}${liberation(1480)}${kuwaitTowers(id)}`;
    if (ink) {
      return `<svg class="sky-svg ink" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        <defs>${defs(id)}</defs><g class="land">${land}</g><rect class="sea-line" x="0" y="${SEA}" width="${W}" height="3"/></svg>`;
    }
    let stars = '';
    for (let i = 0; i < 110; i++) {
      const x = rand() * W, y = rand() * 300, r = 0.5 + rand() * 1.3;
      stars += `<circle class="star" style="--d:${f(rand() * 5)}s;--o:${f(0.35 + rand() * 0.6)}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
    }
    let ripples = '';
    for (let i = 0; i < 46; i++) {
      const cx = 1580 + rand() * 240, y = SEA + 6 + rand() * 70, w = 8 + rand() * 46;
      const c = rand() > 0.5 ? 'rg' : 'rt';
      ripples += `<rect class="ripple ${c}" style="--d:${f(rand() * 4)}s" x="${f(cx - w / 2)}" y="${f(y)}" width="${f(w)}" height="1.6" rx="0.8"/>`;
    }
    for (let i = 0; i < 18; i++) {
      const cx = 1450 + rand() * 60, y = SEA + 6 + rand() * 60, w = 6 + rand() * 26;
      ripples += `<rect class="ripple rg" style="--d:${f(rand() * 4)}s" x="${f(cx - w / 2)}" y="${f(y)}" width="${f(w)}" height="1.4" rx="0.7"/>`;
    }
    return `<svg class="sky-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>${defs(id)}</defs>
      <rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>
      <ellipse cx="1600" cy="${SEA}" rx="1500" ry="150" fill="url(#${id}-glow)"/>
      <g class="stars">${stars}</g>
      <g class="moon" transform="translate(2080 96)">
        <circle r="19" fill="#f4ead0"/><circle cx="8" cy="-5" r="17" fill="#1c4276"/>
      </g>
      <rect x="0" y="${SEA}" width="${W}" height="${H - SEA}" fill="url(#${id}-sea)"/>
      <g class="reflect" mask="url(#${id}-fade)"><g transform="translate(0 ${SEA * 2}) scale(1 -1)">${land}</g></g>
      <g class="ripples">${ripples}</g>
      <g class="land">${land}
        <circle class="beacon" cx="1480" cy="50" r="3.2"/>
        <circle class="beacon" style="--d:0.8s" cx="1690" cy="102" r="2.6"/>
      </g>
      <rect class="sea-line" x="0" y="${SEA}" width="${W}" height="1.2"/>
    </svg>`;
  }

  function defs(id) {
    return `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#183a6a"/><stop offset=".5" stop-color="#25528e"/>
        <stop offset=".78" stop-color="#3a70a8"/><stop offset=".85" stop-color="#5a86ad"/></linearGradient>
      <radialGradient id="${id}-glow" cx=".5" cy="1" r=".5">
        <stop offset="0" stop-color="#e9a54c" stop-opacity=".6"/><stop offset=".45" stop-color="#c47e45" stop-opacity=".2"/>
        <stop offset="1" stop-color="#c47e45" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}-sea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2b5d99"/><stop offset="1" stop-color="#1d4577"/></linearGradient>
      <linearGradient id="${id}-fadeg" x1="0" y1="${SEA}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="${id}-fade" maskUnits="userSpaceOnUse" x="0" y="${SEA}" width="${W}" height="${H - SEA}">
        <rect x="0" y="${SEA}" width="${W}" height="${H - SEA}" fill="url(#${id}-fadeg)"/></mask>
      <pattern id="${id}-seq" width="6.4" height="6.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
        <rect width="6.4" height="6.4" fill="#0f3a52"/>
        <circle cx="1.6" cy="1.6" r="1.35" fill="#2b8ea8"/><circle cx="4.8" cy="1.6" r="1.35" fill="#5cc0b5"/>
        <circle cx="1.6" cy="4.8" r="1.35" fill="#1d6283"/><circle cx="4.8" cy="4.8" r="1.35" fill="#9fd6d8"/></pattern>
      <radialGradient id="${id}-shade" cx=".66" cy=".3" r=".85">
        <stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#020814" stop-opacity=".7"/></radialGradient>
      <linearGradient id="${id}-sheen" x1="0" y1="0" x2="1" y2="0">
        <stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/>
        <stop offset=".65" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  }

  let n = 0;
  function mount(node) {
    if (node.dataset.mounted) return;
    node.dataset.mounted = '1';
    node.insertAdjacentHTML('afterbegin', scene(node.dataset.skyline || 'hero', 'sk' + (++n)));
  }
  window.Skyline = { mount, light(on = true) { document.querySelectorAll('.sky-svg').forEach((s) => s.classList.toggle('lit', on)); } };
  const run = () => document.querySelectorAll('[data-skyline]').forEach(mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
