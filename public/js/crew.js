/* طاقم البوم: شخصيات مكعّبة أصلية بلباس كويتي (دشداشة، غترة أو شماغ مع عقال، طاقية)،
   ودفّة السفينة. الوجه نحو -z (مقدّمة السفينة). */
import * as THREE from 'three';

const tex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
};
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, emissive: color, emissiveIntensity: 0.22, ...extra });

function faceTexture(skin, mood = 'smile') {
  return tex(64, 64, (g, w) => {
    g.fillStyle = skin; g.fillRect(0, 0, w, w);
    g.fillStyle = '#1b1410';
    g.fillRect(15, 22, 9, 12); g.fillRect(40, 22, 9, 12);                   // العينان
    g.fillStyle = '#ffffff'; g.fillRect(17, 24, 3, 3); g.fillRect(42, 24, 3, 3);
    g.fillStyle = 'rgba(27,20,16,0.85)'; g.fillRect(13, 16, 13, 3); g.fillRect(38, 16, 13, 3);   // الحاجبان
    g.fillStyle = '#5a2a1c';
    if (mood === 'cheer') { g.fillRect(22, 42, 20, 10); g.fillStyle = '#ffffff'; g.fillRect(24, 42, 16, 3); }
    else { g.fillRect(22, 44, 20, 4); g.fillRect(20, 41, 4, 4); g.fillRect(40, 41, 4, 4); }   // ابتسامة مكعّبة
    g.fillStyle = 'rgba(214,110,90,0.35)'; g.fillRect(8, 38, 8, 5); g.fillRect(48, 38, 8, 5);
  });
}
function clothTexture(kind) {
  return tex(64, 64, (g, w) => {
    if (kind === 'shemagh') {
      g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, w, w);
      g.fillStyle = '#c0322a';
      for (let i = 0; i < w; i += 8) { g.fillRect(i, 0, 3, w); g.fillRect(0, i, w, 3); }
      g.fillStyle = '#f7f3ea'; for (let i = 0; i < w; i += 8) for (let j = 0; j < w; j += 8) g.fillRect(i + 1, j + 1, 1, 1);
    } else {
      g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, w);
      g.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < w; i += 6) g.fillRect(0, i, w, 1);
    }
  });
}

export const LOOKS = {
  gear: [['ghutra', 'غترة'], ['shemagh', 'شماغ'], ['taqiya', 'طاقية'], ['hair', 'شعر']],
  skin: ['#e9bf98', '#c99068', '#a06a45', '#6e4a30'],
  outfit: [['#f6f4ee', 'أبيض'], ['#d9c7a3', 'بيج'], ['#a9c3dc', 'سماوي'], ['#8a8f99', 'رمادي'], ['#2c4766', 'كحلي']],
};

export function makeAvatar(look = {}) {
  const g = new THREE.Group();
  const robe = mat(0xffffff), skin = mat(0xffffff), shoe = mat(0x3a2a1c);
  const faceMat = new THREE.MeshStandardMaterial({ roughness: 0.8, emissiveIntensity: 0.25 });
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const hip = 0.92;
  const limb = (x, y, len, m, end, endMat) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const b = box(0.4, len, 0.42, m); b.position.y = -len / 2; pivot.add(b);
    if (end) { const e = box(end[0], end[1], end[2], endMat); e.position.set(0, -len - end[1] / 2 + 0.02, end[3] || 0); pivot.add(e); }
    g.add(pivot); return pivot;
  };
  const legL = limb(-0.24, hip, 0.86, robe, [0.44, 0.14, 0.56, -0.06], shoe);
  const legR = limb(0.24, hip, 0.86, robe, [0.44, 0.14, 0.56, -0.06], shoe);
  const torso = box(1.0, 1.02, 0.54, robe); torso.position.y = hip + 0.51; g.add(torso);
  // ياقة وأزرار الدشداشة
  const collar = box(0.46, 0.1, 0.02, mat(0xe8e2d4)); collar.position.set(0, hip + 0.96, -0.28); g.add(collar);
  const btn = box(0.05, 0.4, 0.02, mat(0xd8cfbd)); btn.position.set(0, hip + 0.72, -0.28); g.add(btn);
  const armL = limb(-0.71, hip + 0.96, 0.92, robe, [0.36, 0.24, 0.36], skin);
  const armR = limb(0.71, hip + 0.96, 0.92, robe, [0.36, 0.24, 0.36], skin);
  const head = new THREE.Group(); head.position.y = hip + 1.02 + 0.44; g.add(head);
  const headMesh = box(0.84, 0.84, 0.84, [skin, skin, skin, skin, skin, faceMat]);   // الوجه على -z
  head.add(headMesh);
  const gear = new THREE.Group(); head.add(gear);

  const api = {
    look: {},
    setLook(next = {}) {
      const L = api.look = { gear: 'ghutra', skin: LOOKS.skin[1], outfit: LOOKS.outfit[0][0], ...api.look, ...next };
      robe.color.set(L.outfit); robe.emissive.set(L.outfit);
      skin.color.set(L.skin); skin.emissive.set(L.skin);
      if (faceMat.map) faceMat.map.dispose();
      faceMat.map = faceTexture(L.skin, api.mood); faceMat.emissiveMap = faceMat.map; faceMat.emissive.set(0xffffff); faceMat.needsUpdate = true;
      gear.clear();
      const B = (w, h, d, m, x, y, z) => { const b = box(w, h, d, m); b.position.set(x, y, z); gear.add(b); return b; };
      if (L.gear === 'ghutra' || L.gear === 'shemagh') {
        const cloth = new THREE.MeshStandardMaterial({ map: clothTexture(L.gear), roughness: 0.85, flatShading: true, emissive: 0xffffff, emissiveIntensity: 0.18 });
        cloth.emissiveMap = cloth.map;
        B(0.92, 0.14, 0.92, cloth, 0, 0.47, 0);                         // أعلى الغترة
        B(0.92, 1.0, 0.07, cloth, 0, -0.02, 0.46);                       // تتدلّى من الخلف
        B(0.07, 0.86, 0.6, cloth, -0.46, 0.02, 0.16); B(0.07, 0.86, 0.6, cloth, 0.46, 0.02, 0.16);
        const agal = mat(0x141414);                                      // العقال: إطار أسود مربّع
        B(0.98, 0.08, 0.08, agal, 0, 0.56, -0.45); B(0.98, 0.08, 0.08, agal, 0, 0.56, 0.45);
        B(0.08, 0.08, 0.98, agal, -0.45, 0.56, 0); B(0.08, 0.08, 0.98, agal, 0.45, 0.56, 0);
      } else if (L.gear === 'taqiya') {
        const cap = new THREE.MeshStandardMaterial({ map: clothTexture('ghutra'), roughness: 0.8, flatShading: true, emissive: 0xffffff, emissiveIntensity: 0.2 });
        B(0.88, 0.22, 0.88, cap, 0, 0.5, 0);
      } else {
        const hair = mat(0x1d1612);
        B(0.88, 0.2, 0.88, hair, 0, 0.5, 0); B(0.88, 0.55, 0.1, hair, 0, 0.2, 0.44); B(0.88, 0.13, 0.08, hair, 0, 0.36, -0.43);
        B(0.08, 0.32, 0.6, hair, -0.44, 0.27, 0.12); B(0.08, 0.32, 0.6, hair, 0.44, 0.27, 0.12);
      }
      return api;
    },
    mood: 'smile',
    setMood(m) { if (m !== api.mood) { api.mood = m; api.setLook(); } },
    pose: 'idle',
    /** كل إطار: تنفّس، والتفاتة، وحركة الذراعين حسب الوضعية */
    update(t, steer = 0) {
      const s = Math.sin(t * 2.1 + g.id);
      torso.position.y = hip + 0.51 + s * 0.015; head.position.y = hip + 1.46 + s * 0.02;
      head.rotation.y = Math.sin(t * 0.6 + g.id) * 0.18;
      legL.rotation.x = legR.rotation.x = 0;
      if (api.pose === 'wheel') {
        armL.rotation.set(1.25 - steer * 0.25, 0, 0.15); armR.rotation.set(1.25 + steer * 0.25, 0, -0.15);
        head.rotation.y = -steer * 0.25;
      } else if (api.pose === 'wave') {
        armL.rotation.set(0, 0, 0.12);
        armR.rotation.set(0, 0, 2.6 + Math.sin(t * 9) * 0.35);
      } else if (api.pose === 'cheer') {
        armL.rotation.set(0, 0, -2.7 - Math.sin(t * 8) * 0.15); armR.rotation.set(0, 0, 2.7 + Math.sin(t * 8) * 0.15);
        g.position.y = (g.userData.baseY || 0) + Math.abs(Math.sin(t * 8)) * 0.18;
        return;
      } else if (api.pose === 'pull') {
        const p = Math.sin(t * 2.6);
        armL.rotation.set(2.5 + p * 0.35, 0, 0.1); armR.rotation.set(2.2 - p * 0.35, 0, -0.1);
      } else {
        armL.rotation.set(Math.sin(t * 1.3) * 0.08, 0, 0.1); armR.rotation.set(-Math.sin(t * 1.3) * 0.08, 0, -0.1);
      }
      g.position.y = g.userData.baseY || 0;
    },
  };
  g.userData.avatar = api;
  api.setLook(look);
  return g;
}

/** دفّة السفينة: عجلة خشبية بثمانية مقابض، تدور مع التوجيه */
export function makeWheel() {
  const g = new THREE.Group();
  const wood = mat(0x7a4b25), brass = mat(0xd2a14a, { metalness: 0.5 });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.05, 0.22), wood); post.position.y = 0.52; g.add(post);
  const wheel = new THREE.Group(); wheel.position.y = 1.15; g.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 16), wood));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 8), brass); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.78, 0.05), wood);
    sp.rotation.z = a; sp.position.set(Math.sin(-a) * 0.27, Math.cos(a) * 0.27, 0); wheel.add(sp);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.07), wood);
    h.rotation.z = a; h.position.set(Math.sin(-a) * 0.62, Math.cos(a) * 0.62, 0); wheel.add(h);
  }
  g.userData.wheel = wheel;
  return g;
}

/** ارتفاع سطح البوم عند موضع z (يطابق شكل البدن في world.js) */
export function deckAt(z, L = 9) {
  const t = Math.min(1, Math.max(0, (L / 2 - z) / L));
  return 1.0 + 0.7 * Math.pow(1 - t, 4) + 0.9 * Math.pow(t, 3) - 0.12;
}

/** يضع النوخذة (الطالب) خلف الدفّة، وبحّارين معه */
export function crewTheDhow(dhow, look) {
  const S = 0.62;
  const captain = makeAvatar(look); captain.scale.setScalar(S);
  captain.position.set(0, deckAt(2.75), 2.75); captain.userData.baseY = captain.position.y;
  captain.userData.avatar.pose = 'wheel';
  const wheel = makeWheel(); wheel.scale.setScalar(0.8);
  wheel.position.set(0, deckAt(1.98), 1.98);
  const sailor1 = makeAvatar({ gear: 'taqiya', skin: LOOKS.skin[2], outfit: '#3f6b94' }); sailor1.scale.setScalar(S);
  sailor1.position.set(-0.42, deckAt(-2.6), -2.6); sailor1.rotation.y = Math.PI * 0.85; sailor1.userData.baseY = sailor1.position.y;
  sailor1.userData.avatar.pose = 'pull';
  const sailor2 = makeAvatar({ gear: 'shemagh', skin: LOOKS.skin[3], outfit: '#8a6a45' }); sailor2.scale.setScalar(S);
  sailor2.position.set(-0.55, deckAt(0.4), 0.4); sailor2.rotation.y = -0.4; sailor2.userData.baseY = sailor2.position.y;
  dhow.add(captain, wheel, sailor1, sailor2);
  return { captain, wheel, sailors: [sailor1, sailor2] };
}
