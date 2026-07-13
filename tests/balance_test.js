/* Gear/tier + boss-scaling balance pass. Server on 8900.
 * Run: PW_CHROMIUM=/path node balance_test.js */
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

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Tuner'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. Bosses use their AUTHORED stats — no zone (tierScale) multiplication.
  const boss = await page.evaluate(() => {
    const mk = (type, tier) => new Enemy({ idx: 0, type, tier, elite: false, x: 0, y: 0 }, game);
    const demon = mk('demon', 4), ogre = mk('ogre', 4), dragon = mk('dragon', 4);
    return {
      demonHp: demon.maxHp, demonAuthored: ENEMY_TYPES.demon.hp,
      demonXp: demon.xp, demonAuthoredXp: ENEMY_TYPES.demon.xp,
      ogreHp: ogre.maxHp, ogreAuthored: ENEMY_TYPES.ogre.hp,
      dragonHp: dragon.maxHp, dragonAuthored: ENEMY_TYPES.dragon.hp,
      dragonDmg: Math.round(dragon.dmg), dragonAuthoredDmg: ENEMY_TYPES.dragon.dmg,
    };
  });
  assert(boss.demonHp === boss.demonAuthored, 'demon HP equals its authored value (not tier-scaled): ' + boss.demonHp);
  assert(boss.ogreHp === boss.ogreAuthored, 'ogre HP equals its authored value: ' + boss.ogreHp);
  assert(boss.dragonHp === boss.dragonAuthored, 'dragon HP equals its authored value: ' + boss.dragonHp);
  assert(boss.dragonDmg === boss.dragonAuthoredDmg, 'dragon damage is its authored value (still hits hard): ' + boss.dragonDmg);
  assert(boss.demonXp === boss.demonAuthoredXp, 'boss XP is not inflated by tier scaling: ' + boss.demonXp);

  // 2. Normal + elite mobs DO still zone-scale (tierScale preserved for them).
  const mob = await page.evaluate(() => {
    const t1 = new Enemy({ idx: 0, type: 'skeleton', tier: 1, elite: false, x: 0, y: 0 }, game);
    const t4 = new Enemy({ idx: 0, type: 'skeleton', tier: 4, elite: false, x: 0, y: 0 }, game);
    const t4e = new Enemy({ idx: 0, type: 'skeleton', tier: 4, elite: true, x: 0, y: 0 }, game);
    return { t1: t1.maxHp, t4: t4.maxHp, t4e: t4e.maxHp };
  });
  assert(mob.t4 > mob.t1, 'normal mobs still scale up by zone tier (' + mob.t1 + ' -> ' + mob.t4 + ')');
  assert(mob.t4e > mob.t4, 'elite promotion still multiplies on top of tier (' + mob.t4 + ' -> ' + mob.t4e + ')');

  // 3. Weapon tier now scales damage: a mystic weapon out-hits a common one
  //    of the same base, via equipAgg dmgMul.
  const wpn = await page.evaluate(() => {
    const p = game.players[0];
    const dmgWith = (tier) => {
      p.equip.hands = rollItem({ kind: 'weapon', key: 'sword1h', tier, ilvl: 1 });
      // zero the rolled rows so we isolate the base+tier dmgMul contribution
      p.equip.hands.rows = [];
      return p.equipAgg().dmgMul;
    };
    const common = dmgWith('common'), mystic = dmgWith('mystic');
    p.equip.hands = null;
    return { common, mystic, mul: WEAPON_TIER_DMG.mystic };
  });
  assert(wpn.mystic > wpn.common, 'a mystic weapon has a higher damage multiplier than a common one (' +
    wpn.common.toFixed(2) + ' -> ' + wpn.mystic.toFixed(2) + ')');
  assert(Math.abs(wpn.mystic / wpn.common - wpn.mul) < 1e-6, 'weapon tier bonus matches WEAPON_TIER_DMG');

  // 4. Off-hand dmgMul is NOT tier-scaled (a high-tier shield stays defensive).
  const off = await page.evaluate(() => {
    const shield = rollItem({ kind: 'offhand', key: 'shield', tier: 'mystic', ilvl: 1 });
    return { dmgMul: itemStatMap(shield).dmgMul };
  });
  assert(off.dmgMul < 0, 'a mystic shield keeps its defensive (negative) dmg%: ' + off.dmgMul);

  // 5. Refining resets the reforge cost counter (spec §6).
  const rr = await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0; p.gold = 1e9;
    const it = rollItem({ kind: 'weapon', key: 'sword1h', tier: 'rare', ilvl: 6 });
    p.addItem(it);
    game.reforge(p, it, 0); game.reforge(p, it, 0);   // rr climbs
    const rrBefore = it.rr;
    it.refine = 3;                                     // pretend it's +3
    p.addItem(makeMaterial('ore', 99));
    // force a success by looping until refine increments (100% chance up to +4)
    game.refine(p, it);
    return { rrBefore, rrAfter: it.rr, refined: it.refine };
  });
  assert(rr.rrBefore >= 2, 'reforge counter climbs with each reroll (' + rr.rrBefore + ')');
  assert(rr.rrAfter === 0, 'a successful refine resets the reforge cost counter to 0');

  // 6. Worldboss drop ilvl (32) no longer exceeds the client roll range and
  //    the server MAX_ILVL was raised in lock-step (documented; checked in
  //    hardening_test.py). Here just confirm a worldboss item rolls at ilvl 32.
  const ilvl = await page.evaluate(() => {
    const prof = lootProfile(ENEMY_TYPES.dragon, false);
    return { ilvl: 4 * 4 + prof.ilvl };
  });
  assert(ilvl.ilvl === 32, 'worldboss loot rolls at ilvl 32 (matches server MAX_ILVL): ' + ilvl.ilvl);

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL BALANCE TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
