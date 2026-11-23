'use strict';
/** خادم التشغيل المحلي (أو أي استضافة Node عادية). على Vercel لا يُستخدم هذا الملف. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { handle } = require('./lib/app');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

const gzCache = new Map();
function serveStatic(req, res, pathname) {
  let rel = pathname;
  if (rel === '/') rel = '/index.html';
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  if (rel === '/about' || rel === '/about/') rel = '/about.html';
  if (rel === '/play' || rel === '/play/') rel = '/play.html';
  if (rel === '/play3d' || rel === '/play3d/') rel = '/play3d.html';
  if (rel === '/sky' || rel === '/sky/') rel = '/sky.html';
  if (rel === '/photo' || rel === '/photo/') rel = '/photo.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>غير موجود</title><p style="font-family:sans-serif;padding:2rem">الصفحة غير موجودة. <a href="/">العودة للتصويت</a></p>');
      return;
    }
    const ext = path.extname(file);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.woff2' ? 'public, max-age=31536000, immutable'
        : rel.startsWith('/vendor/') ? 'public, max-age=604800' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    };
    // ضغط الملفات النصية (مهم لشبكات الجوال)
    if (/\.(js|css|svg|html)$/.test(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      const stamp = fs.statSync(file).mtimeMs;
      let hit = gzCache.get(file);
      if (!hit || hit.stamp !== stamp) { hit = { stamp, body: zlib.gzipSync(data) }; gzCache.set(file, hit); }
      headers['Content-Encoding'] = 'gzip';
      headers.Vary = 'Accept-Encoding';
      data = hit.body;
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}


const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return handle(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end(); return; }
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`الموقع يعمل:   http://localhost:${PORT}`);
  console.log(`لوحة التحكم:  http://localhost:${PORT}/admin`);
});
