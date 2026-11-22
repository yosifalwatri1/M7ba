/* العالم ثلاثي الأبعاد: ليل الكويت، أبراج الكويت، برج التحرير، البحر، النجوم، البوم والجزر.
   يُستخدم في رحلة الطالب (/play) وفي سماء المدرسة (/sky). */
import * as THREE from 'three';

export const PALETTE = {
  zenith: 0x183a6a, horizon: 0x5a86ad, glow: 0xe9a54c,
  deep: 0x123563, shallow: 0x2b5d99, gold: 0xe9b44c, teal: 0x5cc0b5,
};

/* ---------- قوامات مرسومة بالكود ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function glowTexture(inner = 'rgba(255,240,200,1)', outer = 'rgba(233,180,76,0)') {
  return canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, inner); gr.addColorStop(0.18, inner.replace(/[\d.]+\)$/, '0.85)'));
    gr.addColorStop(0.45, outer.replace(/[\d.]+\)$/, '0.25)')); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}

// كرات أبراج الكويت: أقراص زرقاء وخضراء على سطح الكرة
function sequinTexture() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#0f3a52'; g.fillRect(0, 0, w, h);
    const cols = ['#2b8ea8', '#5cc0b5', '#1d6283', '#9fd6d8', '#3fa3b8', '#e8f4f4'];
    const s = 9;
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        const band = Math.floor((x + y * 1.6) / 40) % cols.length;         // خطوط حلزونية
        g.fillStyle = cols[(band + ((x / s + y / s) % 2)) % cols.length];
        g.beginPath(); g.arc(x + s / 2 + (y / s % 2) * s / 2, y + s / 2, s * 0.42, 0, Math.PI * 2); g.fill();
      }
    }
  });
}

/* ---------- السماء والنجوم ---------- */
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(PALETTE.zenith) },
      uHorizon: { value: new THREE.Color(PALETTE.horizon) },
      uGlow: { value: new THREE.Color(PALETTE.glow) },
      uGlowDir: { value: new THREE.Vector3(0, 0, 1) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uGlowDir; varying vec3 vDir;
      void main(){
        float h = max(vDir.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
        float g = pow(max(dot(normalize(vec3(vDir.x, 0.0, vDir.z)), uGlowDir), 0.0), 4.0) * exp(-h * 9.0);
        col += uGlow * g * 0.35;
        if (vDir.y < 0.0) col = uHorizon;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
}

function makeStars(count = 1400) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count), size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = Math.random(), v = 0.08 + Math.random() * 0.92;           // فوق الأفق فقط
    const th = u * Math.PI * 2, y = v, r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * r * 820, y * 820, Math.sin(th) * r * 820], i * 3);
    seed[i] = Math.random() * 100; size[i] = 1 + Math.random() * 2.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: `attribute float aSeed; attribute float aSize; uniform float uTime; uniform float uScale; varying float vA;
      void main(){ vA = 0.45 + 0.55 * sin(uTime * (0.8 + fract(aSeed) * 1.6) + aSeed);
        gl_PointSize = aSize * uScale; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.9), (1.0 - d * 2.0) * vA); }`,
  });
  return new THREE.Points(geo, mat);
}

/* ---------- البحر ---------- */
function makeSea() {
  const geo = new THREE.PlaneGeometry(1800, 1800, 180, 180);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() },
      uDeep: { value: new THREE.Color(PALETTE.deep) }, uSky: { value: new THREE.Color(PALETTE.horizon) },
      uHorizon: { value: new THREE.Color(PALETTE.horizon) }, uGold: { value: new THREE.Color(0xf3c76c) },
    },
    vertexShader: `uniform float uTime; varying vec3 vWorld; varying vec3 vN;
      float wv(vec2 p){ return sin(p.x*0.09+uTime*0.9)*0.28 + sin(p.y*0.12+uTime*1.15)*0.22 + sin((p.x+p.y)*0.05+uTime*0.6)*0.35 + sin((p.x-p.y)*0.21+uTime*1.7)*0.06; }
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); float e = 0.5;
        float h = wv(w.xz); float hx = wv(w.xz + vec2(e,0.0)); float hz = wv(w.xz + vec2(0.0,e));
        w.y += h; vN = normalize(vec3(h - hx, e, h - hz)); vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uCam; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uGold; uniform float uTime;
      varying vec3 vWorld; varying vec3 vN;
      void main(){ vec3 V = normalize(uCam - vWorld); vec3 N = normalize(vN);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.25 + fres * 0.65);
        vec3 L = normalize(vec3(-0.25, 0.35, -1.0)); vec3 H = normalize(L + V);
        col += vec3(1.0, 0.93, 0.8) * pow(max(dot(N, H), 0.0), 320.0) * 0.55;
        vec3 L2 = normalize(vec3(0.0, 0.18, 1.0)); vec3 H2 = normalize(L2 + V);
        col += uGold * pow(max(dot(N, H2), 0.0), 90.0) * 0.9;
        float d = length(vWorld.xz - uCam.xz);
        col = mix(col, uHorizon, smoothstep(120.0, 760.0, d));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(geo, mat);
}
export function waveHeight(x, z, t) {
  return Math.sin(x * 0.09 + t * 0.9) * 0.28 + Math.sin(z * 0.12 + t * 1.15) * 0.22 + Math.sin((x + z) * 0.05 + t * 0.6) * 0.35;
}

/* ---------- أبراج الكويت (الوحدة = 4 أمتار) ---------- */
function makeKuwaitTowers() {
  const g = new THREE.Group();
  const seq = sequinTexture();
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.45, metalness: 0.1, emissive: 0x8fa6c0, emissiveIntensity: 0.35 });
  const sphMat = new THREE.MeshStandardMaterial({ map: seq, emissiveMap: seq, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.55 });
  const tower = (x, z, h, rb, rt, spire, spheres) => {
    const t = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 20), shaftMat);
    shaft.position.y = h / 2; t.add(shaft);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(rt * 0.9, spire, 16), shaftMat);
    sp.position.y = h + spire / 2; t.add(sp);
    for (const [y, r] of spheres) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 24), sphMat);
      s.position.y = y; s.rotation.z = 0.3; s.userData.sphere = true; t.add(s);
    }
    t.position.set(x, 0, z); g.add(t);
    return t;
  };
  tower(-6.5, 0.5, 24, 0.7, 0.18, 4, []);                       // الإبرة (113م)
  const main = tower(0, 0, 40, 1.25, 0.45, 7, [[20.5, 4.1], [30.8, 2.3]]); // الرئيسي (187م)
  tower(7.5, 1.2, 30, 1.05, 0.35, 6.7, [[21.5, 3.7]]);            // الثاني (147م)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(13, 15, 1.4, 24), new THREE.MeshStandardMaterial({ color: 0x244d80, roughness: 0.9 }));
  base.position.y = 0.3; g.add(base);
  // ضوء الطيران الأحمر
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,90,90,1)', 'rgba(255,60,60,0)'), blending: THREE.AdditiveBlending, depthWrite: false }));
  beacon.scale.setScalar(2.4); beacon.position.set(0, 47.3, 0); beacon.userData.beacon = true; main.parent.add(beacon);
  g.userData.beacons = [beacon];
  return g;
}

/* ---------- برج التحرير: مقطع مربّع (Lathe بأربعة أوجه) ---------- */
function makeLiberation() {
  const g = new THREE.Group();
  const prof = [[0, 0], [4.6, 0], [2.4, 55], [5.6, 58], [5.6, 63], [3.7, 66], [2.6, 68.5], [1.7, 74], [1.2, 78], [0, 78.5]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const mat = new THREE.MeshStandardMaterial({ color: 0x8fb2d8, roughness: 0.5, metalness: 0.3, emissive: 0x2c5a90, emissiveIntensity: 0.55, flatShading: true });
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 4), mat);
  body.rotation.y = Math.PI / 4; g.add(body);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 16, 6), mat);
  ant.position.y = 86.5; g.add(ant);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 5.7, 0.5, 4, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xf3c76c, side: THREE.DoubleSide }));
  band.rotation.y = Math.PI / 4; band.position.y = 60.5; g.add(band);
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,90,90,1)', 'rgba(255,60,60,0)'), blending: THREE.AdditiveBlending, depthWrite: false }));
  beacon.scale.setScalar(3); beacon.position.y = 95; beacon.userData.beacon = true; g.add(beacon);
  g.userData.beacons = [beacon];
  return g;
}

/* ---------- المدينة على الساحل ---------- */
function makeCity() {
  const g = new THREE.Group();
  const n = 190;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0x1d406e, emissive: 0x0b1f3a, emissiveIntensity: 0.5 }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const winPos = [];
  for (let i = 0; i < n; i++) {
    const x = -340 + Math.random() * 680, z = 190 + Math.random() * 120;
    const w = 5 + Math.random() * 10, d = 5 + Math.random() * 10;
    const h = 3 + Math.random() * (Math.abs(x + 40) < 140 ? 16 : 9) + (Math.random() > 0.94 ? 16 : 0);
    m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, d));
    mesh.setMatrixAt(i, m);
    for (let k = 0; k < h / 3; k++) if (Math.random() > 0.55) winPos.push(x - w / 2 + Math.random() * w, 1.5 + k * 3, z - d / 2 - 0.05);
  }
  g.add(mesh);
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(winPos, 3));
  g.add(new THREE.Points(wg, new THREE.PointsMaterial({ color: 0xf3c76c, size: 0.7, transparent: true, opacity: 0.85 })));
  return g;
}

/* ---------- البوم الكويتي ---------- */
export function makeDhow() {
  const g = new THREE.Group();
  const L = 9, B = 1.5, N = 18;
  const pts = [];
  const ring = (t) => {
    const w = B * Math.pow(Math.sin(Math.PI * (0.16 + 0.84 * t)), 0.72);
    const h = 1.0 + 0.7 * Math.pow(1 - t, 4) + 0.9 * Math.pow(t, 3);
    const k = -0.65 + 1.3 * Math.pow(t, 4);
    const yb = k + (h - k) * 0.35, z = L / 2 - t * L;
    return [[-w, h, z], [-0.82 * w, yb, z], [0, k, z], [0.82 * w, yb, z], [w, h, z]];
  };
  for (let i = 0; i <= N; i++) pts.push(ring(i / N));
  const hull = [], deck = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < 4; j++) {
      const a = pts[i][j], b = pts[i][j + 1], c = pts[i + 1][j + 1], d = pts[i + 1][j];
      hull.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    const a = pts[i][0], b = pts[i][4], c = pts[i + 1][4], d = pts[i + 1][0];
    deck.push(a[0], a[1] - 0.12, a[2], ...[b[0], b[1] - 0.12, b[2]], ...[c[0], c[1] - 0.12, c[2]],
      a[0], a[1] - 0.12, a[2], ...[c[0], c[1] - 0.12, c[2]], ...[d[0], d[1] - 0.12, d[2]]);
  }
  const s = pts[0];                                                  // مؤخّرة السفينة
  for (let j = 1; j < 4; j++) hull.push(...s[0], ...s[j + 1], ...s[j]);
  const mk = (arr, mat) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };
  g.add(mk(hull, new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.75, flatShading: true, side: THREE.DoubleSide, emissive: 0x3a2412, emissiveIntensity: 0.5 })));
  g.add(mk(deck, new THREE.MeshStandardMaterial({ color: 0xd2a56b, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x4a3015, emissiveIntensity: 0.4 })));
  // خط أبيض على جانب السفينة
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf3efe4 });
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3(pts.map((r) => new THREE.Vector3(r[side < 0 ? 0 : 4][0] * 1.005, r[0][1] - 0.18, r[0][2])));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.05, 4), stripeMat));
  }
  const wood = new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.8 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 7.5, 8), wood);
  mast.position.set(0, 4.4, -0.9); mast.rotation.x = 0.14; g.add(mast);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 11, 6), wood);
  // الشراع اللاتيني: رباعي مائل، أعلاه على العارضة
  const A = new THREE.Vector3(0, 1.9, -4.4), Bp = new THREE.Vector3(0, 8.6, 3.2), C = new THREE.Vector3(0, 3.1, 1.5), D = new THREE.Vector3(0, 1.7, -3.4);   // الشراع فوق رأس النوخذة
  yard.position.copy(A.clone().add(Bp).multiplyScalar(0.5));
  yard.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bp.clone().sub(A).normalize());
  yard.scale.y = A.distanceTo(Bp) / 11 * 1.08;
  g.add(yard);
  const sg = new THREE.PlaneGeometry(1, 1, 14, 14);
  const p = sg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5;
    const bot = D.clone().lerp(C, u), top = A.clone().lerp(Bp, u), q2 = bot.lerp(top, v);
    q2.x = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1)) * 0.9;   // انتفاخ الشراع
    p.setXYZ(i, q2.x, q2.y, q2.z);
  }
  sg.computeVertexNormals();
  const sail = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0.28 }));
  g.add(sail);
  g.userData.sail = sail;
  g.userData.mastTop = new THREE.Vector3(0, 8.2, -0.4);
  // فانوس على المؤخرة
  const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false }));
  lamp.material.opacity = 0.6; lamp.scale.setScalar(0.7); lamp.position.set(0, 2.1, 4.45); g.add(lamp);
  return g;
}

/** يرسم لون الشراع ونصّ الطالب عليه */
export function paintSail(dhow, color, text = '') {
  const tex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 2;
    for (let x = 32; x < w; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    if (!text) return;
    g.save(); g.translate(w, 0); g.scale(-1, 1);                      // الشراع يُرى من جانب السفينة
    g.fillStyle = luminance(color) > 0.4 ? '#14335f' : '#ffffff';
    g.direction = 'rtl'; g.textAlign = 'center'; g.font = '600 46px Kufi, "Plex Arabic", sans-serif';
    const lines = wrap(g, text, w * 0.62).slice(0, 5);
    lines.forEach((ln, i) => g.fillText(ln, w * 0.5, h * 0.45 + (i - (lines.length - 1) / 2) * 60));
    g.restore();
  });
  const m = dhow.userData.sail.material;
  if (m.map) m.map.dispose();
  m.map = tex; m.emissiveMap = tex; m.needsUpdate = true;
}
function wrap(g, text, max) {
  const words = text.split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function luminance(hex) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/* ---------- جزيرة مادة ---------- */
export function makeIsland(special = false) {
  const g = new THREE.Group();
  const r = special ? 9 : 7;
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 3, 2.4, 11), new THREE.MeshStandardMaterial({ color: 0xe8d3a2, roughness: 1, flatShading: true, emissive: 0x6a5a3a, emissiveIntensity: 0.35 }));
  sand.position.y = 0.1; g.add(sand);
  const palmTrunk = new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.9, flatShading: true });
  const palmLeaf = new THREE.MeshStandardMaterial({ color: 0x3f9d6a, roughness: 0.8, flatShading: true, emissive: 0x0f3a24, emissiveIntensity: 0.5 });
  const palms = special ? 4 : 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < palms; i++) {
    const p = new THREE.Group();
    const h = 4 + Math.random() * 2.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, h, 6), palmTrunk);
    trunk.position.y = h / 2; p.add(trunk);
    for (let k = 0; k < 7; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3.2, 4), palmLeaf);
      leaf.position.y = h; leaf.rotation.set(1.95, (k / 7) * Math.PI * 2, 0, 'YXZ');
      leaf.translateY(1.4); p.add(leaf);
    }
    const a = Math.random() * Math.PI * 2, d = 2 + Math.random() * (r - 4);
    p.position.set(Math.cos(a) * d, 1.2, Math.sin(a) * d); p.rotation.z = (Math.random() - 0.5) * 0.25;
    g.add(p);
  }
  // منارة صغيرة تضيء بالذهبي
  const lh = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.6, emissive: 0x8796a8, emissiveIntensity: 0.4 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, special ? 8 : 6, 10), white);
  tower.position.y = (special ? 8 : 6) / 2 + 1.2; lh.add(tower);
  const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false }));
  light.scale.setScalar(special ? 7 : 5.5); light.position.y = (special ? 8 : 6) + 1.8; lh.add(light);
  lh.position.set(-r * 0.35, 0, -r * 0.2); g.add(lh);
  g.userData.light = light;
  g.userData.top = new THREE.Vector3(-r * 0.35, (special ? 8 : 6) + 4.5, -r * 0.2);
  return g;
}

/* ---------- نجم معلّم ---------- */
const starTex = { t: null };
export function makeTeacherStar() {
  if (!starTex.t) starTex.t = glowTexture('rgba(255,248,225,1)', 'rgba(243,199,108,0)');
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex.t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.setScalar(14);
  return s;
}

/* ---------- العالم ---------- */
export function createWorld(canvas, { quality = 'auto' } = {}) {
  const lowEnd = quality === 'low' || (quality === 'auto' && (navigator.hardwareConcurrency || 4) <= 4 && Math.min(screen.width, screen.height) < 500);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowEnd, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.horizon, 160, 620);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 2000);

  const sky = makeSky(); scene.add(sky);
  const stars = makeStars(lowEnd ? 700 : 1400); scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), new THREE.MeshBasicMaterial({ color: 0xf6ecd2, fog: false }));
  moon.position.set(-300, 260, -560); scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,245,215,0.7)', 'rgba(255,245,215,0)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  moonGlow.scale.setScalar(90); moonGlow.position.copy(moon.position); scene.add(moonGlow);
  const sea = makeSea(); scene.add(sea);

  scene.add(new THREE.HemisphereLight(0x9fc3ec, 0x123563, 1.35));
  const moonLight = new THREE.DirectionalLight(0xdfe8ff, 1.2); moonLight.position.set(-0.4, 0.6, -1); scene.add(moonLight);
  const cityLight = new THREE.DirectionalLight(0xffd59a, 0.7); cityLight.position.set(0.2, 0.3, 1); scene.add(cityLight);

  const towers = makeKuwaitTowers(); towers.position.set(26, 0, 78); scene.add(towers);
  const liberation = makeLiberation(); liberation.position.set(-50, 0, 175); liberation.scale.setScalar(0.8); scene.add(liberation);
  const city = makeCity(); scene.add(city);
  const beacons = [...towers.userData.beacons, ...liberation.userData.beacons];

  const world = {
    THREE, renderer, scene, camera, sky, stars, sea, towers, liberation, beacons, lowEnd, time: 0,
    onFrame: new Set(),
    resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 0.8 ? 68 : 55;                               // الجوال العمودي يحتاج زاوية أوسع
      camera.updateProjectionMatrix();
      stars.material.uniforms.uScale.value = renderer.getPixelRatio();
    },
    start() {
      const clock = new THREE.Clock();
      const loop = () => {
        const dt = Math.min(clock.getDelta(), 0.05);
        world.time += dt;
        stars.material.uniforms.uTime.value = world.time;
        sea.material.uniforms.uTime.value = world.time;
        sea.material.uniforms.uCam.value.copy(camera.position);
        sky.position.copy(camera.position); stars.position.copy(camera.position);
        const blink = Math.sin(world.time * 2.6) > 0.2 ? 1 : 0.15;
        for (const b of beacons) b.material.opacity = blink;
        for (const fn of world.onFrame) fn(dt, world.time);
        renderer.render(scene, camera);
        world.raf = requestAnimationFrame(loop);
      };
      loop();
    },
  };
  world.resize();
  addEventListener('resize', world.resize);
  return world;
}

/* ---------- حركة ناعمة ---------- */
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export function tween(world, ms, step) {
  return new Promise((resolve) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) ms = Math.min(ms, 250);
    let t = 0;
    const fn = (dt) => {
      t = Math.min(1, t + (dt * 1000) / ms);
      step(ease(t), t);
      if (t >= 1) { world.onFrame.delete(fn); resolve(); }
    };
    world.onFrame.add(fn);
  });
}

export function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}
