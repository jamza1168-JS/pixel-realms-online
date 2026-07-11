/* Phase 2a — Reforge (reroll one affix row, gold sink). Expects server on 8900.
 * Run: PW_CHROMIUM=/path node reforge_test.js */
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

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Smith'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. reforgeCost escalates (doubles) with the per-item rr counter, and scales with tier
  const cost = await page.evaluate(() => {
    const it = rollItem({ kind: 'armor', key: 'chest', tier: 'rare', ilvl: 8 });
    const c0 = reforgeCost(it); it.rr = 1;
    const c1 = reforgeCost(it); it.rr = 2;
    const c2 = reforgeCost(it);
    const leg = reforgeCost(rollItem({ kind: 'armor', key: 'chest', tier: 'legend', ilvl: 8 }));
    return { c0, c1, c2, leg };
  });
  assert(cost.c1 === cost.c0 * 2 && cost.c2 === cost.c0 * 4, 'reforge cost doubles per reroll (' + cost.c0 + '→' + cost.c1 + '→' + cost.c2 + ')');
  assert(cost.leg > cost.c0, 'higher tier costs more to reforge (' + cost.leg + ' > ' + cost.c0 + ')');

  // 2. reforgeRow changes exactly the chosen row (same stat), bumps rr, stays within a legit range
  const reroll = await page.evaluate(() => {
    const it = rollItem({ kind: 'weapon', key: 'sword1h', tier: 'unique', ilvl: 10 });
    const idx = 0;
    const stat0 = it.rows[idx].stat;
    const otherBefore = it.rows.slice(1).map(r => r.val);
    let changed = false, maxSeen = 0;
    for (let n = 0; n < 60; n++) {   // many rerolls to sample the range
      const before = it.rows[idx].val;
      const nv = reforgeRow(it, idx);
      if (nv !== before) changed = true;
      maxSeen = Math.max(maxSeen, nv);
    }
    const otherAfter = it.rows.slice(1).map(r => r.val);
    // legit ceiling for this stat/tier/ilvl (mirror of items.js math + server row_cap tolerance)
    const aff = AFFIXES.find(a => a.stat === stat0);
    const tier = ITEM_TIERS[it.tier];
    const ilvlScale = 1 + (it.ilvl - 1) * 0.12;
    const ceiling = Math.round(aff.max * tier.mult * ilvlScale);
    return { statSame: it.rows[idx].stat === stat0, changed, rr: it.rr,
             othersUntouched: JSON.stringify(otherBefore) === JSON.stringify(otherAfter),
             withinCeiling: maxSeen <= ceiling, maxSeen, ceiling };
  });
  assert(reroll.statSame, 'reforge keeps the same stat, only rerolls the value');
  assert(reroll.changed, 'reforge actually changes the rolled value');
  assert(reroll.othersUntouched, 'reforge leaves the other rows untouched');
  assert(reroll.rr === 60, 'reforge increments rr each time (rr=' + reroll.rr + ')');
  assert(reroll.withinCeiling, 'reforged value stays within the legit ceiling (' + reroll.maxSeen + ' ≤ ' + reroll.ceiling + ')');

  // 3. Game.reforge spends gold and refuses when broke
  const spend = await page.evaluate(() => {
    const p = game.players[0];
    const it = rollItem({ kind: 'armor', key: 'boots', tier: 'rare', ilvl: 5 });
    p.addItem(it);
    p.gold = 100000;
    const cost = reforgeCost(it);
    const before = p.gold, v0 = it.rows[0].val;
    const ok = game.reforge(p, it, 0);
    const spent = before - p.gold;
    // now go broke
    p.gold = 0;
    const denied = game.reforge(p, it, 0);
    return { ok, spent, cost, denied, changedVal: it.rows[0].val !== v0 || it.rr === 1 };
  });
  assert(spend.ok && spend.spent === spend.cost, 'reforge spends exactly reforgeCost gold (' + spend.spent + ')');
  assert(spend.denied === false, 'reforge refused when the player cannot afford it');

  // 4. rr round-trips through the item save format
  const save = await page.evaluate(() => {
    const it = rollItem({ kind: 'weapon', key: 'sword2h', tier: 'legend', ilvl: 12 });
    it.rr = 3;
    const restored = itemFromSave(itemToSave(it));
    return { savedRr: itemToSave(it).rr, restoredRr: restored.rr };
  });
  assert(save.savedRr === 3 && save.restoredRr === 3, 'rr survives itemToSave/itemFromSave round-trip');

  // 5. REAL-mouse-click UI flow (guards the rebuilt-every-frame button bug):
  //    open bag → select gear → Reforge → pick a row → value/gold/rr update.
  await page.evaluate(() => {
    const p = game.players[0];
    p.inventory.length = 0; p.gold = 100000;
    const it = rollItem({ kind: 'armor', key: 'chest', tier: 'unique', ilvl: 10 });
    it.uid = 'reforge-ui';           // stable handle
    p.addItem(it);
    UI.openInventory();
  });
  // click the single gear cell in the grid
  await page.click('#inv-grid .inv-cell');
  // the Reforge button carries the cost + ⚒
  await page.waitForSelector('#inv-actions button:has-text("⚒")');
  const goldBefore = await page.evaluate(() => game.players[0].gold);
  await page.click('#inv-actions button:has-text("⚒")');
  // now in row-pick mode: buttons prefixed with ↻ — click the first
  await page.waitForSelector('#inv-actions button:has-text("↻")');
  const valBefore = await page.evaluate(() => game.players[0].inventory.find(i => i.uid === 'reforge-ui').rows[0].val);
  await page.click('#inv-actions button:has-text("↻")');
  const after = await page.evaluate(() => {
    const it = game.players[0].inventory.find(i => i.uid === 'reforge-ui');
    return { gold: game.players[0].gold, rr: it.rr, rows: it.rows.length };
  });
  assert(after.gold < goldBefore, 'clicking a reforge row spent gold via real UI click (' + goldBefore + '→' + after.gold + ')');
  assert(after.rr === 1, 'real UI reforge bumped rr to 1');
  assert(after.rows === 3, 'reforge did not add/remove rows (still 3)');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL REFORGE TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
