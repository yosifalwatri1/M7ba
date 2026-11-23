/* أصوات اللعبة بلا موسيقى:
   - عبارات بصوت بشري (بسم الله، ما شاء الله، الحمد لله…) من ملفات صغيرة في /sounds
   - مؤثرات مولّدة بالكود من الضجيج فقط، بلا نغمات: أمواج الكورنيش، المحرّك، الاصطدام، القفز، البطاقات
   يبدأ الصوت بعد أول لمسة من الطالب (سياسة المتصفحات)، ويمكن إطفاؤه من زر الصوت. */
const VOICES = ['start', 'correct', 'good', 'win', 'again', 'bless', 'open'];
let ctx = null, master = null, noise = null, on = true;
const buffers = new Map();
try { on = localStorage.getItem('px-sound') !== '0'; } catch {}

export const soundOn = () => on;
export function setSound(v) {
  on = !!v;
  try { localStorage.setItem('px-sound', on ? '1' : '0'); } catch {}
  if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
}

/** يُستدعى من أول لمسة: ينشئ سياق الصوت ويحمّل العبارات */
export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = on ? 1 : 0; master.connect(ctx.destination);
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noise = buf;
  for (const v of VOICES) {
    fetch(new URL(`../../sounds/${v}.mp3`, import.meta.url))
      .then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)).then((b) => buffers.set(v, b)).catch(() => {});
  }
}

/** عبارة بصوت بشري */
let lastVoice = null;
export function voice(name, vol = 0.95) {
  if (!ctx || !on) return;
  const b = buffers.get(name);
  if (!b) return;
  if (lastVoice) { try { lastVoice.stop(); } catch {} }
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = b; g.gain.value = vol;
  s.connect(g).connect(master); s.start();
  lastVoice = s;
}

/** دفعة ضجيج مُرشَّحة: أساس كل المؤثرات */
function burst({ dur = 0.2, type = 'lowpass', f0 = 800, f1 = f0, q = 0.8, vol = 0.4, at = 0 }) {
  if (!ctx || !on) return;
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
export const sfx = {
  whoosh: () => burst({ dur: 0.22, type: 'bandpass', f0: 500, f1: 2200, q: 0.9, vol: 0.22 }),
  jump: () => burst({ dur: 0.25, type: 'bandpass', f0: 350, f1: 1400, q: 1.2, vol: 0.25 }),
  hit: () => { burst({ dur: 0.35, type: 'lowpass', f0: 500, f1: 60, vol: 0.8 }); burst({ dur: 0.12, type: 'highpass', f0: 2500, f1: 1200, vol: 0.2 }); },
  pick: () => burst({ dur: 0.07, type: 'highpass', f0: 4000, f1: 6000, vol: 0.28 }),
  card: () => { burst({ dur: 0.08, type: 'bandpass', f0: 1800, f1: 1200, q: 2, vol: 0.3 }); burst({ dur: 0.08, type: 'bandpass', f0: 1500, f1: 900, q: 2, vol: 0.25, at: 0.07 }); },
  door: () => burst({ dur: 0.45, type: 'lowpass', f0: 900, f1: 150, vol: 0.45 }),
  step: () => burst({ dur: 0.05, type: 'lowpass', f0: 700, f1: 300, vol: 0.12 }),
  shutter: () => { for (let i = 0; i < 9; i++) burst({ dur: 0.06, type: 'bandpass', f0: 2200 - i * 120, f1: 1400, q: 3, vol: 0.18, at: i * 0.07 }); },
  gate: () => burst({ dur: 0.3, type: 'bandpass', f0: 900, f1: 3000, q: 0.7, vol: 0.3 }),
};

/** خلفية الكورنيش: أمواج من ضجيج يعلو وينخفض ببطء. level: 0 صامت، 1 كامل (داخل المدرسة أخفض) */
let waves = null;
export function ambience(level) {
  if (!ctx) return;
  if (!waves) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0;
    const swell = ctx.createGain(); swell.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;           // تموّج بطيء جداً، لا يُسمع نغمةً
    const depth = ctx.createGain(); depth.gain.value = 0.45;
    lfo.connect(depth).connect(swell.gain);
    s.connect(f).connect(swell).connect(g).connect(master);
    s.start(); lfo.start();
    waves = g;
  }
  waves.gain.setTargetAtTime(0.16 * level, ctx.currentTime, 0.6);
}

/** المحرّك في السباق: هدير من ضجيج يرتفع مع السرعة */
let motor = null;
export function engine(speed) {
  if (!ctx) return;
  if (!motor) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f).connect(g).connect(master); s.start();
    motor = { f, g };
  }
  const t = ctx.currentTime;
  motor.f.frequency.setTargetAtTime(90 + speed * 260, t, 0.08);
  motor.g.gain.setTargetAtTime(speed > 0 ? 0.08 + speed * 0.12 : 0, t, 0.15);
}
