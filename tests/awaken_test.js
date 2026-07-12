/* P5a — Awakening Stone (adds a 4th affix row, once). Server on 8900.
 * Run: PW_CHROMIUM=/path node awaken_test.js */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';
const exe = process.env.PW_CHROMIUM || undefined;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('PASS: ' + m); }

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Sage'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. awakenItem adds a distinct 4th row, marks the item, and refuses twice
  const core = await page.evaluate(() => {
    const it = rollItem({ kind: 'armor', key: 'chest', tier: 'unique', ilvl: 12 });
    const before = it.rows.length, statsBefore = it.rows.map(r => r.stat);
    const canFirst = canAwaken(it);
    const row = awakenItem(it);
    const distinct = row && !statsBefore.includes(row.stat);
    const canSecond = canAwaken(it);            // already awakened → false
    const second = awakenItem(it);              // no-op
    return { before, after: it.rows.length, canFirst, distinct, awakened: !!it.awakened, canSecond, second };
  });
  assert(core.before === 3 && core.after === 4, 'awakening adds a 4th affix row (3 → 4)');
  assert(core.canFirst && core.distinct, 'the 4th row is a NEW stat the item lacked');
  assert(core.awakened && !core.canSecond && core.second === null, 'an item can be awakened only once');

  // 2. Game.awaken spends one stone (bag-only) and refuses with none
  const spend = await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0;
    const it = rollItem({ kind: 'weapon', key: 'sword1h', tier: 'rare', ilvl: 8 });
    p.addItem(it);
    const denied = game.awaken(p, it);           // no stone
    p.addItem(makeMaterial('stone', 2));
    const ok = game.awaken(p, it);
    return { denied, ok: !!ok, stonesLeft: game.matCount(p, 'stone'), rows: it.rows.length, awakened: !!it.awakened };
  });
  assert(spend.denied === null, 'awaken is refused without an Awakening Stone');
  assert(spend.ok && spend.stonesLeft === 1 && spend.rows === 4 && spend.awakened, 'awaken spends one stone and adds the 4th row');

  // 3. awakened flag + 4 rows survive the save round-trip; server keeps them
  const save = await page.evaluate(async () => {
    const it = rollItem({ kind: 'armor', key: 'boots', tier: 'legend', ilvl: 14 });
    awakenItem(it);
    const restored = itemFromSave(itemToSave(it));
    return { savedAwake: itemToSave(it).awakened, rows: restored.rows.length, awakened: restored.awakened };
  });
  assert(save.savedAwake === 1 && save.rows === 4 && save.awakened, 'awakened + 4 rows survive itemToSave/itemFromSave');

  // 4. a NON-awakened item is capped back to 3 rows on load (no free 4th row)
  const cap = await page.evaluate(() => {
    const fake = { uid: 'x', key: 'chest', kind: 'armor', slot: 'chest', tier: 'unique', ilvl: 10,
      rows: [{ stat: 'hp', val: 10 }, { stat: 'vit', val: 3 }, { stat: 'str', val: 3 }, { stat: 'atk', val: 5 }], awakened: 0 };
    const restored = itemFromSave(fake);
    return { rows: restored.rows.length };
  });
  assert(cap.rows === 3, 'a non-awakened item is clamped to 3 rows on load (no sneaked 4th row)');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL AWAKEN (P5a) TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
