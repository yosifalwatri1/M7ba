/* ملف PDF صغير بلا مكتبات: كل لوحة (canvas) صفحة، محفوظة صورة JPEG داخلها.
   عرض الصفحة A4 أفقي (842 نقطة) والارتفاع بنسبة الصورة. */
const toJpeg = (c) => new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));

export async function makePdf(canvases) {
  const enc = new TextEncoder(), chunks = [], offsets = [];
  let length = 0;
  const push = (d) => { const b = typeof d === 'string' ? enc.encode(d) : d; chunks.push(b); length += b.length; };
  const obj = (n, write) => { offsets[n] = length; push(`${n} 0 obj\n`); write(); push('\nendobj\n'); };
  push('%PDF-1.4\n%âãÏÓ\n');
  const n = canvases.length, PAGE_W = 842;
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${canvases.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`));
  for (let i = 0; i < n; i++) {
    const c = canvases[i], p = 3 + i * 3, h = ((PAGE_W * c.height) / c.width).toFixed(2);
    const jpg = new Uint8Array(await (await toJpeg(c)).arrayBuffer());
    const draw = `q ${PAGE_W} 0 0 ${h} 0 0 cm /Im${i} Do Q`;
    obj(p, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${h}] /Resources << /XObject << /Im${i} ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`));
    obj(p + 1, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
    obj(p + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
      push(jpg); push('\nendstream');
    });
  }
  const size = 3 + n * 3, xref = length;
  push(`xref\n0 ${size}\n0000000000 65535 f \n`);
  for (let k = 1; k < size; k++) push(`${String(offsets[k]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}
