'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const QRCode = require('qrcode');
const { open } = require('./lib/store');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const ENV_PASSWORD = process.env.ADMIN_PASSWORD || '';

const store = open(DATA_DIR);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

// ---------- أدوات ----------
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}
function checkPassword(password) {
  if (ENV_PASSWORD) {
    const a = Buffer.from(sha(password)), b = Buffer.from(sha(ENV_PASSWORD));
    return crypto.timingSafeEqual(a, b);
  }
  const stored = store.getSetting('adminHash');
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 32);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}
const isSetup = () => !!ENV_PASSWORD || !!store.getSetting('adminHash');

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

function isAdmin(req) {
  const tok = cookies(req).sid;
  return !!tok && store.hasSession(sha(tok));
}
function startSession(req, res) {
  const tok = crypto.randomBytes(32).toString('hex');
  const week = 7 * 24 * 3600;
  store.addSession(sha(tok), Date.now() + week * 1000);
  setCookie(req, res, 'sid', tok, week);
}

// حماية بسيطة من تخمين كلمة المرور
const attempts = new Map();
function throttle(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  if (a.length >= 8) throw fail(429, 'محاولات كثيرة. حاول بعد عشر دقائق.');
  a.push(now); attempts.set(ip, a);
}

// ---------- المسارات ----------
const routes = {
  // ----- عام (الطلاب) -----
  'GET /api/state': (req) => {
    const device = cookies(req).vid;
    return { ...store.publicSettings(), voted: !!device && store.hasVoted(device) };
  },
  'GET /api/suggest': (req, res, url) => ({ items: store.suggest(url.searchParams.get('q') || '') }),
  'POST /api/vote': async (req, res) => {
    if (!store.publicSettings().open) throw fail(403, 'التصويت مغلق حالياً.');
    const body = await readBody(req);
    let device = cookies(req).vid;
    if (device && store.hasVoted(device)) throw fail(409, 'سبق أن سجّلت ترشيحك من هذا الجهاز.');
    if (!device || !/^[a-f0-9]{32}$/.test(device)) device = crypto.randomBytes(16).toString('hex');
    const name = String(body.name || '').trim();
    const teacherId = Number(body.teacherId) || null;
    if (!teacherId && name.replace(/\s/g, '').length < 2) throw fail(400, 'اكتب اسم المعلّم أولاً.');
    const result = store.castVote({ raw: name, teacherId, device, force: !!body.force });
    if (result.status !== 'choose') setCookie(req, res, 'vid', device, 400 * 24 * 3600);
    return result;
  },

  // ----- دخول المدير -----
  'GET /api/admin/status': (req) => ({ setup: isSetup(), authed: isAdmin(req) }),
  'POST /api/admin/setup': async (req, res) => {
    if (isSetup()) throw fail(403, 'تم إعداد كلمة المرور مسبقاً.');
    const { password } = await readBody(req);
    if (typeof password !== 'string' || password.length < 6) throw fail(400, 'كلمة المرور 6 أحرف على الأقل.');
    store.setSetting('adminHash', hashPassword(password));
    startSession(req, res);
    return { ok: true };
  },
  'POST /api/admin/login': async (req, res) => {
    throttle(req);
    const { password } = await readBody(req);
    if (typeof password !== 'string' || !isSetup() || !checkPassword(password)) throw fail(401, 'كلمة المرور غير صحيحة.');
    startSession(req, res);
    return { ok: true };
  },
  'POST /api/admin/logout': (req, res) => {
    const tok = cookies(req).sid;
    if (tok) store.dropSession(sha(tok));
    setCookie(req, res, 'sid', '', 0);
    return { ok: true };
  },
};

const adminRoutes = {
  'GET /api/admin/dashboard': () => store.dashboard(),
  'POST /api/admin/teachers': async (req) => {
    const { names } = await readBody(req);
    if (!Array.isArray(names)) throw fail(400, 'أرسل قائمة أسماء.');
    return store.addTeachers(names.slice(0, 500));
  },
  'POST /api/admin/teachers/rename': async (req) => {
    const { id, name } = await readBody(req);
    store.renameTeacher(Number(id), name);
    return { ok: true };
  },
  'POST /api/admin/teachers/delete': async (req) => {
    const { id } = await readBody(req);
    store.deleteTeacher(Number(id));
    return { ok: true };
  },
  'POST /api/admin/teachers/merge': async (req) => {
    const { fromId, intoId } = await readBody(req);
    store.mergeTeachers(Number(fromId), Number(intoId));
    return { ok: true };
  },
  'POST /api/admin/pending/resolve': async (req) => {
    const b = await readBody(req);
    store.resolvePending({
      norms: b.norms, teacherId: Number(b.teacherId) || null,
      newTeacherName: b.newTeacherName ? String(b.newTeacherName) : null, discard: !!b.discard,
    });
    return { ok: true };
  },
  'POST /api/admin/variants/detach': async (req) => {
    const { teacherId, norm } = await readBody(req);
    store.detachVariant(Number(teacherId), String(norm));
    return { ok: true };
  },
  'POST /api/admin/settings': async (req) => {
    const b = await readBody(req);
    if (typeof b.school === 'string') store.setSetting('school', b.school.trim().slice(0, 80));
    if (typeof b.title === 'string' && b.title.trim()) store.setSetting('title', b.title.trim().slice(0, 80));
    if (typeof b.open === 'boolean') store.setSetting('open', b.open ? '1' : '0');
    if (typeof b.publicUrl === 'string') store.setSetting('publicUrl', b.publicUrl.trim().slice(0, 200));
    return { ok: true };
  },
  'POST /api/admin/password': async (req) => {
    if (ENV_PASSWORD) throw fail(400, 'كلمة المرور مضبوطة من إعدادات الخادم (ADMIN_PASSWORD).');
    const { current, next } = await readBody(req);
    if (!checkPassword(String(current || ''))) throw fail(401, 'كلمة المرور الحالية غير صحيحة.');
    if (typeof next !== 'string' || next.length < 6) throw fail(400, 'كلمة المرور 6 أحرف على الأقل.');
    store.setSetting('adminHash', hashPassword(next));
    return { ok: true };
  },
  'POST /api/admin/reset': async (req) => {
    const { confirm } = await readBody(req);
    if (confirm !== 'حذف') throw fail(400, 'اكتب كلمة "حذف" للتأكيد.');
    store.resetVotes();
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
  'GET /api/admin/export.csv': (req, res) => {
    const label = { matched: 'محسوب', pending: 'بانتظار المراجعة', discarded: 'مستبعد' };
    const how = { picked: 'اختاره الطالب من القائمة', auto: 'مطابقة تلقائية', alias: 'قرار سابق للمدير', admin: 'ربطه المدير', none: '' };
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['الرقم', 'الاسم كما كُتب', 'المعلّم', 'الحالة', 'طريقة الربط', 'الوقت'].map(esc).join(',')];
    for (const r of store.exportRows()) {
      lines.push([r.id, r.raw, r.teacher || '', label[r.status], how[r.method], new Date(r.created).toISOString()].map(esc).join(','));
    }
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="votes.csv"', 'Cache-Control': 'no-store',
    });
    res.end('﻿' + lines.join('\r\n'));
    return undefined;
  },
};

function serveStatic(req, res, pathname) {
  let rel = pathname;
  if (rel === '/') rel = '/index.html';
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>غير موجود</title><p style="font-family:sans-serif;padding:2rem">الصفحة غير موجودة. <a href="/">العودة للتصويت</a></p>');
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const key = `${req.method} ${url.pathname}`;
  try {
    if (url.pathname.startsWith('/api/')) {
      let handler = routes[key];
      if (!handler && adminRoutes[key]) {
        if (!isAdmin(req)) throw fail(401, 'سجّل الدخول أولاً.');
        // طلبات التعديل يجب أن تأتي من نفس الموقع
        if (req.method === 'POST' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
          throw fail(403, 'طلب غير مسموح.');
        }
        handler = adminRoutes[key];
      }
      if (!handler) throw fail(404, 'غير موجود.');
      const out = await handler(req, res, url);
      if (out !== undefined) json(res, 200, out);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    serveStatic(req, res, decodeURIComponent(url.pathname));
  } catch (err) {
    const status = err.status || (/UNIQUE/.test(String(err.message)) ? 409 : 400);
    if (!err.status && status === 400) console.error(err);
    if (!res.headersSent) {
      json(res, status, { error: status === 409 && !err.status ? 'سبق أن سجّلت ترشيحك من هذا الجهاز.' : err.message });
    }
  }
});

server.listen(PORT, () => {
  console.log(`الموقع يعمل:   http://localhost:${PORT}`);
  console.log(`لوحة التحكم:  http://localhost:${PORT}/admin`);
});
