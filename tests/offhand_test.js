/* P4a — off-hand slot (shield/book/quiver) + class tags + pairing + dmgRed.
 * Expects server on 8900. Run: PW_CHROMIUM=/path node offhand_test.js */
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

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Guard'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. off-hands roll as their own kind/slot, and 'offhand' is an equip slot
  const roll = await page.evaluate(() => {
    const s = rollItem({ kind: 'offhand', key: 'shield', tier: 'unique', ilvl: 10 });
    return { kind: s.kind, slot: s.slot, rows: s.rows.length, hasSlot: EQUIP_SLOTS.includes('offhand') };
  });
  assert(roll.kind === 'offhand' && roll.slot === 'offhand' && roll.rows === 3, 'off-hands roll as kind/slot "offhand" with 3 rows');
  assert(roll.hasSlot, '"offhand" is a registered equip slot');

  // 2. class tags: a warrior equips a shield; a mage cannot
  const cls = await page.evaluate(() => {
    const p = game.players[0]; for (const s of EQUIP_SLOTS) p.equip[s] = null; p.inventory.length = 0;
    const shield = rollItem({ kind: 'offhand', key: 'shield', tier: 'rare', ilvl: 6 });
    p.addItem(shield);
    p.clsId = 'warrior'; const wOk = p.equipItem(shield);
    // put it back, switch to mage, try again
    p.unequipItem('offhand'); const s2 = p.inventory.find(i => i.key === 'shield');
    p.clsId = 'mage'; const mOk = p.equipItem(s2); const mErr = p.equipError;
    p.clsId = 'warrior';
    return { wOk, mOk, mErr };
  });
  assert(cls.wOk, 'a warrior can equip a shield');
  assert(!cls.mOk && cls.mErr === 'wrongClass', 'a mage is refused a shield (wrongClass)');

  // 3. two-hand pairing: shield needs a one-hand weapon; a 2-hander evicts it
  const pair = await page.evaluate(() => {
    const p = game.players[0]; for (const s of EQUIP_SLOTS) p.equip[s] = null; p.inventory.length = 0;
    p.clsId = 'warrior';
    const sword2 = rollItem({ kind: 'weapon', key: 'sword2h', tier: 'rare', ilvl: 6 });
    const shield = rollItem({ kind: 'offhand', key: 'shield', tier: 'rare', ilvl: 6 });
    p.addItem(sword2); p.addItem(shield);
    p.equipItem(sword2);
    const blocked = !p.equipItem(shield) && p.equipError === 'needsOneHand';
    // now equip a one-hander → shield fits
    const sword1 = rollItem({ kind: 'weapon', key: 'sword1h', tier: 'rare', ilvl: 6 });
    p.addItem(sword1); p.equipItem(sword1);
    const shieldNow = p.inventory.find(i => i.key === 'shield');
    const fits = p.equipItem(shieldNow) && p.equip.offhand && p.equip.offhand.key === 'shield';
    // equipping a 2-hander again should evict the shield back to the bag
    const s2again = rollItem({ kind: 'weapon', key: 'sword2h', tier: 'rare', ilvl: 6 });
    p.addItem(s2again); p.equipItem(s2again);
    const evicted = !p.equip.offhand && p.inventory.some(i => i.key === 'shield');
    return { blocked, fits, evicted };
  });
  assert(pair.blocked, 'a shield is refused while a two-hander is equipped (needsOneHand)');
  assert(pair.fits, 'a shield equips once a one-hand weapon is on');
  assert(pair.evicted, 'equipping a two-hander evicts the shield back to the bag');

  // 4. quiver pairs specifically with the bow (archer)
  const quiv = await page.evaluate(() => {
    const p = game.players[0]; for (const s of EQUIP_SLOTS) p.equip[s] = null; p.inventory.length = 0;
    p.clsId = 'archer';
    const quiver = rollItem({ kind: 'offhand', key: 'quiver', tier: 'rare', ilvl: 6 });
    p.addItem(quiver);
    const noBow = !p.equipItem(quiver) && p.equipError === 'needsWeapon';
    const bow = rollItem({ kind: 'weapon', key: 'bow', tier: 'rare', ilvl: 6 });
    p.addItem(bow); p.equipItem(bow);
    const q2 = p.inventory.find(i => i.key === 'quiver');
    const withBow = p.equipItem(q2) && p.equip.offhand && p.equip.offhand.key === 'quiver';
    return { noBow, withBow };
  });
  assert(quiv.noBow, 'a quiver is refused without a bow (needsWeapon)');
  assert(quiv.withBow, 'a quiver equips together with the two-hand bow');

  // 5. a shield's damage reduction actually reduces damage taken
  const dr = await page.evaluate(() => {
    const p = game.players[0]; for (const s of EQUIP_SLOTS) p.equip[s] = null; p.inventory.length = 0;
    p.clsId = 'warrior';
    const before = p.derived.dmgRed;
    const shield = rollItem({ kind: 'offhand', key: 'shield', tier: 'rare', ilvl: 6 });
    p.addItem(shield); p.equipItem(shield);
    const withShield = p.derived.dmgRed;
    p.hp = 200; p.takeDamage(100);
    return { before, withShield, hpAfter: Math.round(p.hp) };
  });
  assert(dr.before === 0 && dr.withShield > 0, 'a shield grants damage reduction (' + dr.withShield + ')');
  assert(dr.hpAfter > 100, 'damage reduction lowers damage taken (200 - <100 dmg → hp ' + dr.hpAfter + ')');

  // 6. off-hand survives the item save round-trip
  const save = await page.evaluate(() => {
    const s = rollItem({ kind: 'offhand', key: 'book', tier: 'legend', ilvl: 12 });
    const r = itemFromSave(itemToSave(s));
    return { kind: r && r.kind, slot: r && r.slot };
  });
  assert(save.kind === 'offhand' && save.slot === 'offhand', 'off-hands survive the save round-trip');

  // 7. classHint biases drops to the player's usable weapons/off-hands
  const hint = await page.evaluate(() => {
    let good = 0;
    for (let i = 0; i < 200; i++) {
      const it = rollItem({ kind: 'offhand', classHint: 'archer' });
      if (it.key === 'quiver') good++;   // archer's only off-hand
    }
    return good;
  });
  assert(hint === 200, 'classHint makes an archer only roll quivers among off-hands (' + hint + '/200)');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL OFF-HAND (P4a) TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
