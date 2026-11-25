'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { open } = require('../lib/store');

test('الفصول وأرقام الكشف: صوت واحد لكل رقم، والأرقام العربية مقبولة', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seats-'));
  const s = await open({ dataDir: dir });
  assert.deepEqual(await s.setClasses('١٠/١ | ٣٠\n11/2 28'), { count: 2 });
  assert.deepEqual((await s.classes()).map((c) => c.name), ['10/1', '11/2']);
  const seat = await s.checkSeat('10/1', '٧');
  assert.equal(seat.roll, 7); assert.equal(seat.used, false);
  assert.equal(await s.takeSeat('10/1', 7), true);
  assert.equal(await s.takeSeat('10/1', 7), false);
  assert.equal((await s.checkSeat('10/1', 7)).used, true);
  await assert.rejects(s.checkSeat('10/1', 31));
  await assert.rejects(s.checkSeat('9/9', 1));
  await assert.rejects(s.setClasses('10/1'));
  await s.freeSeat('10/1', 7);
  assert.equal((await s.checkSeat('10/1', 7)).used, false);
  fs.rmSync(dir, { recursive: true, force: true });
});
