/* PR-A item system tests. Expects server on 8900.
 * Run: PW_CHROMIUM=/path node items_test.js */
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

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Looter'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. rollItem: 3 rolled stat rows, valid tier/slot, tier scales magnitude
  const roll = await page.evaluate(() => {
    const lo = rollItem({ kind: 'armor', tier: 'common', ilvl: 1 });
    const hi = rollItem({ kind: 'armor', key: lo.key, tier: 'mystic', ilvl: 1 });
    const sum = it => it.rows.reduce((a, r) => a + r.val, 0);
    return { rows: lo.rows.length, tiers: TIER_ORDER, loTier: lo.tier, hiTier: hi.tier,
             loSum: sum(lo), hiSum: sum(hi), slot: lo.slot,
             distinct: new Set(lo.rows.map(r => r.stat)).size };
  });
  assert(roll.rows === 3 && roll.distinct === 3, 'gear rolls exactly 3 distinct stat rows');
  assert(roll.tiers.join() === 'common,rare,unique,legend,mystic', 'five tiers Common→Mystic');
  assert(roll.hiSum > roll.loSum, 'higher tier rolls bigger stats (' + roll.loSum + ' → ' + roll.hiSum + ')');
  assert(['head', 'chest', 'hands', 'legs', 'boots'].includes(roll.slot), 'armor has a valid slot');

  // 2. equipping gear changes derived stats
  const equipEffect = await page.evaluate(() => {
    const p = game.players[0];
    const before = { hp: p.derived.maxHp, atk: p.derived.atk };
    const item = { uid: 'test1', key: 'chest', kind: 'armor', slot: 'chest', tier: 'legend', ilvl: 10,
                   rows: [{ stat: 'hp', val: 120 }, { stat: 'atk', val: 30 }, { stat: 'vit', val: 8 }] };
    p.addItem(item); p.equipItem(item);
    const after = { hp: p.derived.maxHp, atk: p.derived.atk };
    return { before, after, equippedSlot: !!p.equip.chest, bagHasIt: p.inventory.includes(item) };
  });
  assert(equipEffect.after.hp > equipEffect.before.hp + 100, 'equipping raises maxHp (+hp +vit)');
  assert(equipEffect.after.atk > equipEffect.before.atk + 20, 'equipping raises atk');
  assert(equipEffect.equippedSlot && !equipEffect.bagHasIt, 'item moved from bag into the slot');

  // 3. weapon dmgMul flows into computed damage
  const wpn = await page.evaluate(() => {
    const p = game.players[0];
    const base1 = game.computeBase(p, 1);
    const w = { uid: 'w1', key: 'sword2h', kind: 'weapon', slot: 'hands', tier: 'common', ilvl: 1,
               rows: [{ stat: 'str', val: 1 }, { stat: 'atk', val: 1 }, { stat: 'hp', val: 10 }] };
    p.addItem(w); p.equipItem(w);
    const base2 = game.computeBase(p, 1);
    return { base1, base2, dmgMul: p.derived.dmgMul };
  });
  assert(wpn.dmgMul > 1.5 && wpn.base2 > wpn.base1, 'two-hander dmgMul boosts computed damage');

  // 4. unequip returns the item to the bag and lowers stats back
  const uneq = await page.evaluate(() => {
    const p = game.players[0];
    const hpEquipped = p.derived.maxHp;
    p.unequipItem('chest');
    return { hpEquipped, hpBare: p.derived.maxHp, inBag: p.inventory.some(i => i.key === 'chest') };
  });
  assert(uneq.hpBare < uneq.hpEquipped && uneq.inBag, 'unequip lowers stats and returns item to bag');

  // 5. potion use: HP potion heals, buff potion adds a timed buff
  const pot = await page.evaluate(() => {
    const p = game.players[0];
    p.hp = 1;
    const hpPot = makePotion('hp', 2);
    p.addItem(hpPot);
    game.usePotion(p, hpPot);
    const healed = p.hp > 1;
    const stackLeft = p.inventory.find(i => i.key === 'hp');
    const atkPot = makePotion('atk', 1);
    p.addItem(atkPot);
    game.usePotion(p, atkPot);
    const buffed = p.buffs.some(b => b.tag === 'pot_atk');
    return { healed, count: stackLeft ? stackLeft.count : 0, buffed };
  });
  assert(pot.healed, 'HP potion restores health');
  assert(pot.count === 1, 'potion stack decrements on use (2 → 1)');
  assert(pot.buffed, 'Power potion applies a timed buff');

  // 6. drops: killing enemies yields gear pickups
  const drop = await page.evaluate(() => {
    const p = game.players[0]; p.level = 30;
    let gearDrops = 0;
    for (let i = 0; i < 40; i++) {
      const sp = game.world.spawnPoints.find(s => !s.boss && s.tier >= 3) || game.world.spawnPoints[0];
      game.handleEnemyDead(sp.idx, 50, p.x, p.y, 'local', false, p);
    }
    gearDrops = game.pickups.filter(pk => pk.kind === 'gear').length;
    // boss always drops
    const bsp = game.world.spawnPoints.find(s => s.boss);
    game.handleEnemyDead(bsp.idx, 900, p.x, p.y, 'local', true, p);
    const bossGear = game.pickups.filter(pk => pk.kind === 'gear').length - gearDrops;
    return { gearDrops, bossGear };
  });
  assert(drop.gearDrops > 0, 'tier-3 mobs drop gear over many kills (' + drop.gearDrops + ')');
  assert(drop.bossGear >= 1, 'boss always drops gear');

  // 7. collecting a gear pickup adds it to the inventory
  const collect = await page.evaluate(() => {
    const p = game.players[0];
    const before = p.inventory.length;
    const item = rollItem({ kind: 'weapon', tier: 'rare', ilvl: 5 });
    const pk = new Pickup('gear', p.x, p.y, item);
    game.collectPickup(pk, p);
    return { added: p.inventory.length === before + 1, hasIt: p.inventory.includes(item) };
  });
  assert(collect.added && collect.hasIt, 'collecting a gear pickup adds it to the bag');

  // 8. inventory UI: open, tooltip, equip via real click
  await page.evaluate(() => { game.players[0].inventory = []; game.players[0].equip = { head:null,chest:null,hands:null,legs:null,boots:null };
    const it = { uid:'ui1', key:'head', kind:'armor', slot:'head', tier:'unique', ilvl:8, rows:[{stat:'vit',val:9},{stat:'hp',val:40},{stat:'crit',val:4}] };
    game.players[0].addItem(it); });
  await page.click('#btn-inv');
  await page.waitForSelector('#inv-panel:not(.hidden)', { timeout: 3000 });
  await page.hover('#inv-grid .inv-cell');
  await page.waitForSelector('#skill-tooltip:not(.hidden)', { timeout: 3000 });
  const tip = await page.textContent('#skill-tooltip');
  assert(/Unique/.test(tip) && /VIT/.test(tip) && /Max HP/.test(tip), 'item tooltip shows tier + rolled stats: ' + JSON.stringify(tip));
  await page.click('#inv-grid .inv-cell');            // select
  await page.click('#inv-actions .pix-btn');          // Equip (first action button)
  const equipped = await page.evaluate(() => !!game.players[0].equip.head && game.players[0].inventory.length === 0);
  assert(equipped, 'clicking Equip in the UI moves the item to its slot');

  // 9. save/load round-trips inventory + equipment
  const persisted = await page.evaluate(() => {
    game.save();
    const raw = JSON.parse(localStorage.getItem('pixelrealms_save'));
    const pl = raw.players[0];
    return { equipHead: pl.equip.head && pl.equip.head.key, rows: pl.equip.head && pl.equip.head.rows.length };
  });
  assert(persisted.equipHead === 'head' && persisted.rows === 3, 'equipment saved with its rolled rows');
  await page.reload();
  await page.evaluate(() => {
    const data = Game.loadSave();
    startGame(data.players[0].clsId, data.players[0]);
  });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });
  const reloaded = await page.evaluate(() => {
    const p = game.players[0];
    return { headKey: p.equip.head && p.equip.head.key, rows: p.equip.head && p.equip.head.rows.length,
             maxHp: p.derived.maxHp };
  });
  assert(reloaded.headKey === 'head' && reloaded.rows === 3, 'equipment restored on reload with rolled stats');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL ITEM TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
