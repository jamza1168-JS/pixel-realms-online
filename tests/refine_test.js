/* Phase 2b — Ore + Refine (+ rock mining). Expects server on 8900.
 * Run: PW_CHROMIUM=/path node refine_test.js */
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

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Smelter'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. Ore is a stackable material
  const stack = await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0;
    p.addItem(makeMaterial('ore', 3));
    p.addItem(makeMaterial('ore', 2));
    const oreStacks = p.inventory.filter(i => i.kind === 'material' && i.key === 'ore');
    return { stacks: oreStacks.length, count: game.matCount(p, 'ore') };
  });
  assert(stack.stacks === 1 && stack.count === 5, 'ore stacks by key (1 stack, count 5)');

  // 2. refine cost (gold+ore) and odds (100% to +4, then declining)
  const rules = await page.evaluate(() => {
    const it = rollItem({ kind: 'armor', key: 'chest', tier: 'rare', ilvl: 8 });
    const costs = [], odds = [];
    for (let r = 0; r <= 9; r++) { it.refine = r; costs.push(refineCost(it)); odds.push(refineChance(it)); }
    return { costs, odds };
  });
  assert(rules.odds.slice(0, 4).every(o => o === 1), 'refine is guaranteed (100%) up to +4');
  assert(rules.odds[4] === 0.8 && rules.odds[8] === 0.4 && rules.odds[9] === 0, 'refine odds decline past +4, 0 at max');
  assert(rules.costs[1].gold > rules.costs[0].gold && rules.costs[1].ore === 2, 'refine cost rises with level (gold + ore)');

  // 3. refine bonus actually raises equipped stats (armor rows scale)
  const bonus = await page.evaluate(() => {
    const p = game.players[0];
    for (const s of EQUIP_SLOTS) p.equip[s] = null;
    const it = { uid: 'ref-armor', key: 'chest', kind: 'armor', slot: 'chest', tier: 'unique', ilvl: 10,
                 rows: [{ stat: 'hp', val: 100 }, { stat: 'vit', val: 5 }, { stat: 'atk', val: 10 }], rr: 0, refine: 0 };
    p.equip.chest = it;
    const hp0 = p.derived.maxHp;
    it.refine = 5;                        // +15% to armor rows
    const hp5 = p.derived.maxHp;
    return { hp0, hp5 };
  });
  assert(bonus.hp5 > bonus.hp0, 'refine raises equipped armor stats (' + bonus.hp0 + ' → ' + bonus.hp5 + ')');

  // 4. Game.refine: success raises +1 and spends gold+ore; forced fail drops a step (never breaks)
  const attempt = await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0; p.gold = 100000;
    p.addItem(makeMaterial('ore', 20));
    const it = rollItem({ kind: 'weapon', key: 'sword1h', tier: 'rare', ilvl: 6 });
    it.refine = 0; p.addItem(it);
    const orig = Math.random;
    Math.random = () => 0;                // force success (0 < chance)
    const goldB = p.gold, oreB = game.matCount(p, 'ore');
    const r1 = game.refine(p, it);
    const spentGold = goldB - p.gold, spentOre = oreB - game.matCount(p, 'ore');
    // now force a failure at +5 (past the guaranteed band)
    it.refine = 5;
    Math.random = () => 0.999;            // force fail (>= chance)
    const r2 = game.refine(p, it);
    Math.random = orig;
    return { r1ok: r1 && r1.success, refAfter1: it.refine >= 1 ? 1 : it.refine,
             spentGold, spentOre, failDroppedTo: (r2 && r2.refine), failSuccess: r2 && r2.success };
  });
  assert(attempt.r1ok && attempt.spentGold > 0 && attempt.spentOre > 0, 'refine success spends gold + ore and raises the level');
  assert(attempt.failSuccess === false && attempt.failDroppedTo === 4, 'a failed refine past +4 drops one step (5 → 4), never breaks');

  // 5. refine round-trips through the item save format
  const save = await page.evaluate(() => {
    const it = rollItem({ kind: 'armor', key: 'boots', tier: 'legend', ilvl: 12 }); it.refine = 7;
    const restored = itemFromSave(itemToSave(it));
    return { savedRef: itemToSave(it).refine, restoredRef: restored.refine, restoredKind: restored.kind };
  });
  assert(save.savedRef === 7 && save.restoredRef === 7, 'refine survives itemToSave/itemFromSave round-trip');

  // 6. rock mining: swinging beside a rock yields ore, then that rock is on cooldown
  const mine = await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0; game.enemies = [];
    // find any rock and stand on a walkable neighbour tile
    let rock = null;
    for (const o of game.world.objects.values()) { if (o.type === 'rock') { rock = o; break; } }
    let placed = false;
    for (let oy = -1; oy <= 1 && !placed; oy++) for (let ox = -1; ox <= 1 && !placed; ox++) {
      if (!ox && !oy) continue;
      const tx = rock.tx + ox, ty = rock.ty + oy;
      if (!game.world.isSolid(tx, ty)) { p.x = tx * TILE + TILE / 2; p.y = ty * TILE + TILE / 2; placed = true; }
    }
    const first = game.tryMineNear(p);
    const oreAfter = game.matCount(p, 'ore');
    const second = game.tryMineNear(p);     // same rock still cooling down
    return { placed, first, oreAfter, second, cooling: (rock.mineT || 0) > game.time };
  });
  assert(mine.placed && mine.first === true, 'swinging beside a rock mines it');
  assert(mine.oreAfter >= 1, 'mining a rock yields ore');
  assert(mine.second === false && mine.cooling, 'a mined rock goes on cooldown (no instant re-mine)');

  // 7. REAL-click UI: refine button attempts a refine (spends resources)
  await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0; p.gold = 100000;
    p.addItem(makeMaterial('ore', 20));
    const it = rollItem({ kind: 'armor', key: 'head', tier: 'rare', ilvl: 6 });
    it.uid = 'refine-ui'; it.refine = 0; p.addItem(it);
    window.__rnd = Math.random; Math.random = () => 0;   // deterministic success
    UI.openInventory();
    UI.invSel = it; UI.renderInventory();
  });
  await page.waitForSelector('#inv-actions button:has-text("Refine")');
  const goldBefore = await page.evaluate(() => game.players[0].gold);
  await page.click('#inv-actions button:has-text("Refine")');
  const after = await page.evaluate(() => {
    Math.random = window.__rnd;
    const it = game.players[0].inventory.find(i => i.uid === 'refine-ui');
    return { refine: it.refine, gold: game.players[0].gold, ore: game.matCount(game.players[0], 'ore') };
  });
  assert(after.refine === 1 && after.gold < goldBefore && after.ore < 20, 'real UI Refine click raised +1 and spent gold + ore');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL REFINE/ORE TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
