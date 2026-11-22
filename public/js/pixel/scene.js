/* مشهد الكورنيش: طبقات بعمق (parallax) فوق بعضها، ونهار يتحوّل إلى ليل */
import { PAL, canvas, drawSky, drawSun, cloud, kuwaitTowers, liberationTower, curvedTower, cityStrip, palm, hedgeStrip, sidewalk, rng } from './art.js';

export function createScene(W, H) {
  const [sky, sg] = canvas(W, H); drawSky(sg, W, H);
  const L = {
    groundY: Math.round(H * 0.77),
    towers: kuwaitTowers(H), liberation: liberationTower(H), curved: curvedTower(H),
    far: cityStrip(11, 640, Math.round(H * 0.2), 'far'),
    mid: cityStrip(23, 900, Math.round(H * 0.24), 'mid'),
    hedge: hedgeStrip(5, 600, Math.round(H * 0.11)),
    walk: sidewalk(192, H - Math.round(H * 0.77)),
    palms: Array.from({ length: 6 }, (_, i) => palm(100 + i * 7, H)),
    clouds: [[0.1, 0.12, 70, 0.6], [0.55, 0.2, 90, 0.4], [0.85, 0.08, 60, 0.8], [1.3, 0.16, 80, 0.5], [1.8, 0.1, 70, 0.7]].map(([x, y, w, s], i) => ({ img: cloud(31 + i, Math.round(w * H / 422)), x: x * W * 1.3, y: y * H, s })),
  };
  const r = rng(9);
  const palmSpots = Array.from({ length: 40 }, (_, i) => ({ x: i * 150 + r() * 80, k: Math.floor(r() * L.palms.length) }));
  const stars = Array.from({ length: 90 }, () => ({ x: r() * W, y: r() * H * 0.55, p: r() * 6, big: r() > 0.88 }));
  const [night, ng] = canvas(W, H);
  const sunR = Math.round(H * 0.09), [sun, sung] = canvas(sunR * 2 + 8, sunR * 2 + 8); drawSun(sung, sunR + 4, sunR + 4, sunR);

  const tile = (g, img, offset, y, gap = 0) => {
    const w = img.width + gap; let x = -(((offset % w) + w) % w);
    for (; x < W; x += w) g.drawImage(img, Math.round(x), Math.round(y));
  };

  return {
    W, H, L,
    /** camX: موضع الكاميرا في العالم. dusk: 0 غروب، 1 ليل */
    draw(g, camX, t, dusk = 0) {
      g.drawImage(sky, 0, 0);
      drawSunAt(g);
      for (const c of L.clouds) {
        const span = W + c.img.width * 2;
        const x = ((c.x - camX * 0.05 + t * c.s * 3) % span + span) % span - c.img.width;
        g.drawImage(c.img, Math.round(x), Math.round(c.y));
      }
      const base = L.groundY - Math.round(H * 0.06);
      tile(g, L.far, camX * 0.1, base - L.far.height + 4);
      // المعالم: أبراج الكويت، ثم البرج المائل، ثم برج التحرير
      const lx = (wx) => Math.round(wx - camX * 0.22);
      g.drawImage(L.liberation, lx(W * 0.5 + 520), base - L.liberation.height);
      g.drawImage(L.towers, lx(W * 0.5 - L.towers.width * 0.62 + 10), base - L.towers.height);
      g.drawImage(L.curved, lx(W * 0.5 + 70), base - L.curved.height);
      tile(g, L.mid, camX * 0.4, base - L.mid.height + Math.round(H * 0.06));
      for (const p of palmSpots) {
        const x = p.x - camX * 0.72, img = L.palms[p.k];
        if (x < -img.width || x > W + img.width) continue;
        g.drawImage(img, Math.round(x - img.width / 2), L.groundY - img.height + 4);
      }
      tile(g, L.hedge, camX * 0.82, L.groundY - L.hedge.height + 2);
      tile(g, L.walk, camX, L.groundY);
      if (dusk > 0) {
        ng.clearRect(0, 0, W, H);
        g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = dusk * 0.85; g.fillStyle = '#2c2a5e'; g.fillRect(0, 0, W, H); g.restore();
        g.save(); g.globalAlpha = dusk;
        for (const s of stars) { const a = 0.5 + 0.5 * Math.sin(t * 2 + s.p); g.fillStyle = `rgba(255,246,220,${a})`; g.fillRect(Math.round(s.x), Math.round(s.y), s.big ? 2 : 1, s.big ? 2 : 1); }
        g.restore();
      }
      function drawSunAt(gg) {
        gg.drawImage(sun, Math.round(W * 0.46 - camX * 0.04 - sun.width / 2), Math.round(L.groundY - H * 0.2 - sun.height / 2));
      }
    },
  };
}
export { PAL };
