/* P4b — accessory slots (x2, spice rolls) + crossbow. Server on 8900.
 * Run: PW_CHROMIUM=/path node accessory_test.js */
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

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Jeweler'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. two accessory slots exist; accessories roll SPICE-only rows
  const roll = await page.evaluate(() => {
    const twoSlots = EQUIP_SLOTS.includes('acc1') && EQUIP_SLOTS.includes('acc2');
    const banned = ['hp', 'mp', 'atk', 'matk'];
    let ok = true, sample = null;
    for (let i = 0; i < 300; i++) {
      const a = rollItem({ kind: 'accessory', tier: 'unique', ilvl: 10 });
      if (a.kind !== 'accessory' || a.slot !== 'acc' || a.rows.length !== 3) { ok = false; break; }
      if (a.rows.some(r => banned.includes(r.stat))) { ok = false; sample = a.rows; break; }
    }
    return { twoSlots, ok, sample };
  });
  assert(roll.twoSlots, 'acc1 and acc2 are both equip slots');
  assert(roll.ok, 'accessories roll kind/slot "accessory"/"acc" with 3 spice-only rows (no hp/mp/atk/matk): ' + JSON.stringify(roll.sample));

  // 2. two accessories fill acc1 then acc2; both apply to derived stats
  const equip = await page.evaluate(() => {
    const p = game.players[0]; for (const s of EQUIP_SLOTS) p.equip[s] = null; p.inventory.length = 0;
    const before = { str: p.derived.atk };
    const r1 = { uid: 'a1', key: 'ring',   kind: 'accessory', slot: 'acc', tier: 'unique', ilvl: 10, rows: [{ stat: 'str', val: 8 }, { stat: 'crit', val: 4 }, { stat: 'agi', val: 5 }], rr: 0, refine: 0 };
    const r2 = { uid: 'a2', key: 'amulet', kind: 'accessory', slot: 'acc', tier: 'unique', ilvl: 10, rows: [{ stat: 'str', val: 6 }, { stat: 'vit', val: 5 }, { stat: 'luk', val: 4 }], rr: 0, refine: 0 };
    p.addItem(r1); p.addItem(r2);
    p.equipItem(r1); const afterOne = p.equip.acc1 && p.equip.acc1.uid;
    p.equipItem(r2); const afterTwo = p.equip.acc2 && p.equip.acc2.uid;
    return { firstSlot: afterOne, secondSlot: afterTwo, atkUp: p.derived.atk > before.str };
  });
  assert(equip.firstSlot === 'a1' && equip.secondSlot === 'a2', 'accessories fill acc1 then acc2');
  assert(equip.atkUp, 'equipped accessories contribute stats (str → atk rose)');

  // 3. accessories survive the save round-trip into their slots
  const save = await page.evaluate(() => {
    const p = game.players[0];
    const blob = { clsId: p.clsId, level: p.level, xp: 0, statPoints: 0, gold: 0, kills: 0, bossKills: 0,
      stats: p.stats, inventory: [], storage: [],
      equip: Object.fromEntries(EQUIP_SLOTS.map(s => [s, p.equip[s] ? itemToSave(p.equip[s]) : null])), quickItems: [] };
    // simulate reload: build a fresh player from the blob
    const p2 = new Player(1, 'warrior', game);
    if (blob.equip) for (const slot of EQUIP_SLOTS) { const it = itemFromSave(blob.equip[slot]); if (it && slotAccepts(slot, it)) p2.equip[slot] = it; }
    return { a1: p2.equip.acc1 && p2.equip.acc1.kind, a2: p2.equip.acc2 && p2.equip.acc2.kind };
  });
  assert(save.a1 === 'accessory' && save.a2 === 'accessory', 'both accessories reload into acc1/acc2');

  // 4. crossbow: an archer-only 2h weapon that does NOT keep the quiver
  const xbow = await page.evaluate(() => {
    const p = game.players[0]; for (const s of EQUIP_SLOTS) p.equip[s] = null; p.inventory.length = 0;
    p.clsId = 'warrior';
    const xb = rollItem({ kind: 'weapon', key: 'crossbow', tier: 'rare', ilvl: 6 });
    p.addItem(xb);
    const warriorBlocked = !p.equipItem(xb) && p.equipError === 'wrongClass';
    p.clsId = 'archer';
    // equip bow + quiver, then swap to crossbow → quiver evicted
    const bow = rollItem({ kind: 'weapon', key: 'bow', tier: 'rare', ilvl: 6 });
    const quiver = rollItem({ kind: 'offhand', key: 'quiver', tier: 'rare', ilvl: 6 });
    p.addItem(bow); p.addItem(quiver); p.equipItem(bow); p.equipItem(quiver);
    const hadQuiver = !!p.equip.offhand;
    const xb2 = p.inventory.find(i => i.key === 'crossbow');
    p.equipItem(xb2);
    return { warriorBlocked, hadQuiver, archerEquipped: p.equip.hands && p.equip.hands.key === 'crossbow', quiverGone: !p.equip.offhand };
  });
  assert(xbow.warriorBlocked, 'a warrior cannot equip the archer crossbow (wrongClass)');
  assert(xbow.hadQuiver && xbow.archerEquipped && xbow.quiverGone, 'crossbow equips for an archer and evicts the quiver (2-hander)');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL ACCESSORY/CROSSBOW (P4b) TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
