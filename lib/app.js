'use strict';
/**
 * واجهة الموقع البرمجية (/api/*). تُستخدم في الخادم المحلي (server.js)
 * وفي دالة Vercel (api/index.js).
 */
const crypto = require('node:crypto');
const QRCode = require('qrcode');
const { open } = require('./store');

const ENV_PASSWORD = process.env.ADMIN_PASSWORD || '';
const MIME = { '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

// اتصال واحد بالقاعدة يُعاد استخدامه بين الطلبات
let storePromise = null;
function store() {
  if (!storePromise) {
    storePromise = open({ dataDir: process.env.DATA_DIR }).catch((err) => { storePromise = null; throw err; });
  }
  return storePromise;
}

// ---------- أدوات ----------
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}
async function checkPassword(password) {
  if (ENV_PASSWORD) {
    const a = Buffer.from(sha(password)), b = Buffer.from(sha(ENV_PASSWORD));
    return crypto.timingSafeEqual(a, b);
  }
  const stored = await (await store()).getSetting('adminHash');
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 32);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}
const isSetup = async () => !!ENV_PASSWORD || !!(await (await store()).getSetting('adminHash'));

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setCookie(req, res, name, value, maxAgeSec) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  const prev = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [...prev,
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`]);
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  // على Vercel قد يكون الجسم مقروءاً مسبقاً
  if (process.env.VERCEL && req.body !== undefined && req.body !== null) {
    const b = req.body;
    if (typeof b === 'object' && !Buffer.isBuffer(b)) return Promise.resolve(b);
    try { return Promise.resolve(JSON.parse(Buffer.isBuffer(b) ? b.toString('utf8') : String(b)) || {}); }
    catch { return Promise.reject(Object.assign(new Error('صيغة غير صحيحة'), { status: 400 })); }
  }
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 200_000) { reject(Object.assign(new Error('الطلب كبير جداً'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) || {}); }
      catch { reject(Object.assign(new Error('صيغة غير صحيحة'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
const fail = (status, message) => Object.assign(new Error(message), { status });

async function isAdmin(req) {
  const tok = cookies(req).sid;
  return !!tok && (await store()).hasSession(sha(tok));
}
async function startSession(req, res) {
  const tok = crypto.randomBytes(32).toString('hex');
  const week = 7 * 24 * 3600;
  await (await store()).addSession(sha(tok), Date.now() + week * 1000);
  setCookie(req, res, 'sid', tok, week);
}

// حماية من تخمين كلمة المرور: 8 محاولات كل 10 دقائق لكل عنوان
async function throttle(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '?';
  if (!(await (await store()).loginAttempt(ip, 10 * 60_000, 8))) throw fail(429, 'محاولات كثيرة. حاول بعد عشر دقائق.');
}

// ---------- المسارات ----------
const routes = {
  // ----- عام (الطلاب) -----
  'GET /api/state': async (req, res, url, store) => {
    const device = cookies(req).vid;
    return { ...(await store.publicSettings()), voted: !!device && await store.hasVoted(device) };
  },
  'GET /api/suggest': async (req, res, url, store) => ({ items: await store.suggest(url.searchParams.get('q') || '') }),
  'POST /api/vote': async (req, res, url, store) => {
    if (!(await store.publicSettings()).open) throw fail(403, 'التصويت مغلق حالياً.');
    const body = await readBody(req);
    let device = cookies(req).vid;
    if (device && await store.hasVoted(device)) throw fail(409, 'سبق أن سجّلت ترشيحك من هذا الجهاز.');
    if (!device || !/^[a-f0-9]{32}$/.test(device)) device = crypto.randomBytes(16).toString('hex');
    const name = String(body.name || '').trim();
    const teacherId = Number(body.teacherId) || null;
    if (!teacherId && name.replace(/\s/g, '').length < 2) throw fail(400, 'اكتب اسم المعلّم أولاً.');
    const pearls = await store.scorePearls(body.answers);
    const result = await store.castVote({
      raw: name, teacherId, device, force: !!body.force, reason: body.reason, subject: body.subject, pearls,
    });
    if (result.status !== 'choose') result.pearls = pearls;
    if (result.status !== 'choose') setCookie(req, res, 'vid', device, 400 * 24 * 3600);
    return result;
  },

  // ----- اللعبة -----
  'GET /api/game': async (req, res, url, store) => {
    const device = cookies(req).vid;
    const s = await store.publicSettings();
    return { ...s, voted: !!device && await store.hasVoted(device), ...(await store.game()) };
  },
  'POST /api/game/check': async (req, res, url, store) => {
    const { id, choice } = await readBody(req);
    return store.checkAnswer(id, choice);
  },
  'GET /api/game/questions': async (req, res, url, store) => ({ items: await store.diveQuestions(url.searchParams.get('subject') || '') }),

  // ----- دخول المدير -----
  'GET /api/admin/status': async (req, res, url, store) => ({ setup: await isSetup(), authed: await isAdmin(req) }),
  'POST /api/admin/setup': async (req, res, url, store) => {
    if (await isSetup()) throw fail(403, 'تم إعداد كلمة المرور مسبقاً.');
    const { password } = await readBody(req);
    if (typeof password !== 'string' || password.length < 6) throw fail(400, 'كلمة المرور 6 أحرف على الأقل.');
    await store.setSetting('adminHash', hashPassword(password));
    await startSession(req, res);
    return { ok: true };
  },
  'POST /api/admin/login': async (req, res) => {
    await throttle(req);
    const { password } = await readBody(req);
    if (typeof password !== 'string' || !(await isSetup()) || !(await checkPassword(password))) throw fail(401, 'كلمة المرور غير صحيحة.');
    await startSession(req, res);
    return { ok: true };
  },
  'POST /api/admin/logout': async (req, res, url, store) => {
    const tok = cookies(req).sid;
    if (tok) await store.dropSession(sha(tok));
    setCookie(req, res, 'sid', '', 0);
    return { ok: true };
  },
};

const adminRoutes = {
  'GET /api/admin/dashboard': (req, res, url, store) => store.dashboard(),
  'POST /api/admin/teachers': async (req, res, url, store) => {
    const { names } = await readBody(req);
    if (!Array.isArray(names)) throw fail(400, 'أرسل قائمة أسماء.');
    return store.addTeachers(names.slice(0, 500));
  },
  'POST /api/admin/teachers/subject': async (req, res, url, store) => {
    const { id, subject } = await readBody(req);
    await store.setSubject(Number(id), String(subject || ''));
    return { ok: true };
  },
  'GET /api/admin/questions': async (req, res, url, store) => ({ items: await store.listQuestions() }),
  'POST /api/admin/questions': async (req, res, url, store) => {
    await store.addQuestion(await readBody(req));
    return { ok: true };
  },
  'POST /api/admin/questions/delete': async (req, res, url, store) => {
    const { id } = await readBody(req);
    await store.deleteQuestion(Number(id));
    return { ok: true };
  },
  'POST /api/admin/teachers/rename': async (req, res, url, store) => {
    const { id, name } = await readBody(req);
    await store.renameTeacher(Number(id), name);
    return { ok: true };
  },
  'POST /api/admin/teachers/delete': async (req, res, url, store) => {
    const { id } = await readBody(req);
    await store.deleteTeacher(Number(id));
    return { ok: true };
  },
  'POST /api/admin/teachers/merge': async (req, res, url, store) => {
    const { fromId, intoId } = await readBody(req);
    await store.mergeTeachers(Number(fromId), Number(intoId));
    return { ok: true };
  },
  'POST /api/admin/pending/resolve': async (req, res, url, store) => {
    const b = await readBody(req);
    await store.resolvePending({
      norms: b.norms, teacherId: Number(b.teacherId) || null,
      newTeacherName: b.newTeacherName ? String(b.newTeacherName) : null, discard: !!b.discard,
    });
    return { ok: true };
  },
  'POST /api/admin/variants/detach': async (req, res, url, store) => {
    const { teacherId, norm } = await readBody(req);
    await store.detachVariant(Number(teacherId), String(norm));
    return { ok: true };
  },
  'POST /api/admin/reasons/delete': async (req, res, url, store) => {
    const { id } = await readBody(req);
    await store.clearReason(Number(id));
    return { ok: true };
  },
  'POST /api/admin/settings': async (req, res, url, store) => {
    const b = await readBody(req);
    if (typeof b.school === 'string') await store.setSetting('school', b.school.trim().slice(0, 80));
    if (typeof b.title === 'string' && b.title.trim()) await store.setSetting('title', b.title.trim().slice(0, 80));
    if (typeof b.open === 'boolean') await store.setSetting('open', b.open ? '1' : '0');
    if (typeof b.publicUrl === 'string') await store.setSetting('publicUrl', b.publicUrl.trim().slice(0, 200));
    return { ok: true };
  },
  'POST /api/admin/password': async (req, res, url, store) => {
    if (ENV_PASSWORD) throw fail(400, 'كلمة المرور مضبوطة من إعدادات الخادم (ADMIN_PASSWORD).');
    const { current, next } = await readBody(req);
    if (!(await checkPassword(String(current || '')))) throw fail(401, 'كلمة المرور الحالية غير صحيحة.');
    if (typeof next !== 'string' || next.length < 6) throw fail(400, 'كلمة المرور 6 أحرف على الأقل.');
    await store.setSetting('adminHash', hashPassword(next));
    return { ok: true };
  },
  'POST /api/admin/reset': async (req, res, url, store) => {
    const { confirm } = await readBody(req);
    if (confirm !== 'حذف') throw fail(400, 'اكتب كلمة "حذف" للتأكيد.');
    await store.resetVotes();
    return { ok: true };
  },
  'GET /api/admin/qr.svg': async (req, res, url) => {
    const target = url.searchParams.get('url') || '';
    if (!/^https?:\/\/.{3,300}$/.test(target)) throw fail(400, 'رابط غير صحيح.');
    const svg = await QRCode.toString(target, {
      type: 'svg', errorCorrectionLevel: 'M', margin: 0,
      color: { dark: '#1d1b18', light: '#0000' },
    });
    res.writeHead(200, { 'Content-Type': MIME['.svg'], 'Cache-Control': 'no-store' });
    res.end(svg);
    return undefined;
  },
  'GET /api/admin/export.csv': async (req, res, url, store) => {
    const label = { matched: 'محسوب', pending: 'بانتظار المراجعة', discarded: 'مستبعد' };
    const how = { picked: 'اختاره الطالب من القائمة', auto: 'مطابقة تلقائية', alias: 'قرار سابق للمدير', admin: 'ربطه المدير', none: '' };
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['الرقم', 'الاسم كما كُتب', 'المعلّم', 'المادة', 'الحالة', 'طريقة الربط', 'لماذا اختاره', 'اللؤلؤ', 'الوقت'].map(esc).join(',')];
    for (const r of await store.exportRows()) {
      lines.push([r.id, r.raw, r.teacher || '', r.subject, label[r.status], how[r.method], r.reason, r.pearls,
        new Date(r.created).toISOString()].map(esc).join(','));
    }
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="votes.csv"', 'Cache-Control': 'no-store',
    });
    res.end('﻿' + lines.join('\r\n'));
    return undefined;
  },
};


async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  // على Vercel يمرّ الطلب عبر إعادة توجيه داخلية؛ المسار الأصلي في __path
  const viaRewrite = url.searchParams.get('__path');
  url.searchParams.delete('__path');
  if (viaRewrite !== null && !/^\/api\/.+/.test(url.pathname) || url.pathname === '/api/index') {
    url.pathname = '/api/' + (viaRewrite || '');
  }
  const key = `${req.method} ${url.pathname}`;
  try {
    let handler = routes[key];
    if (!handler && adminRoutes[key]) {
      if (!(await isAdmin(req))) throw fail(401, 'سجّل الدخول أولاً.');
      // طلبات التعديل يجب أن تأتي من نفس الموقع
      if (req.method === 'POST' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
        throw fail(403, 'طلب غير مسموح.');
      }
      handler = adminRoutes[key];
    }
    if (!handler) throw fail(404, 'غير موجود.');
    const out = await handler(req, res, url, await store());
    if (out !== undefined) json(res, 200, out);
  } catch (err) {
    let status = err.status;
    let message = err.message;
    if (!status && err.code === '23505') { status = 409; message = 'سبق أن سجّلت ترشيحك من هذا الجهاز.'; }
    else if (!status && err.code === 'NO_DATABASE') { status = 503; }
    else if (!status && (err.code || /ECONN|ENOTFOUND|timeout|password authentication/i.test(String(message)))) {
      console.error(err);
      status = 503; message = 'تعذّر الاتصال بقاعدة البيانات. حاول بعد قليل.';
    } else if (!status) { status = 400; }
    if (!res.headersSent) json(res, status, { error: message });
  }
}

module.exports = { handle };
