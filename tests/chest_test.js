/* Phase 2c — Teleport scroll + Keys + Treasure chests. Server on 8900.
 * Run: PW_CHROMIUM=/path node chest_test.js */
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

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Delver'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. Teleport scroll warps the player back to the village
  const warp = await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0;
    p.x = game.world.spawnX + 1200; p.y = game.world.spawnY + 800;
    const scroll = makePotion('tele', 2);
    p.addItem(scroll);
    const used = game.usePotion(p, scroll);
    const dist = Math.hypot(p.x - game.world.spawnX, p.y - game.world.spawnY);
    return { used, dist, left: game.matCount ? scroll.count : scroll.count };
  });
  assert(warp.used && warp.dist < 2, 'teleport scroll warps to the village');
  assert(warp.left === 1, 'teleport scroll is consumed (2 → 1)');

  // 2. World has seed-placed chests, all outside the safe village
  const world = await page.evaluate(() => {
    const cs = game.world.chests;
    const inVillage = cs.filter(c => game.world.tierAt(c.x, c.y) < 1).length;
    return { count: cs.length, inVillage };
  });
  assert(world.count > 0, 'world seeds treasure chests (' + world.count + ')');
  assert(world.inVillage === 0, 'no chest spawns inside the safe village');

  // 3. Opening a chest needs a key; with a key it yields loot and consumes the key
  const open = await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0; p.afk = false; p.gold = 0;
    game.enemies = [];
    const c = game.world.chests[0]; c.openT = 0;
    p.x = c.x; p.y = c.y;
    // no key first
    game.updateChests();
    const openedNoKey = c.openT > game.time;
    const bagNoKey = p.inventory.length;
    // give a key, then open
    p.addItem(makeMaterial('key', 1));
    const goldBefore = p.gold;
    game.updateChests();
    const gotGear = p.inventory.some(i => i.kind === 'weapon' || i.kind === 'armor');
    return { openedNoKey, bagNoKey, keysLeft: game.matCount(p, 'key'),
             opened: c.openT > game.time, gold: p.gold - goldBefore, gotGear };
  });
  assert(!open.openedNoKey && open.bagNoKey === 0, 'a chest will not open without a key');
  assert(open.opened && open.keysLeft === 0, 'opening a chest consumes one key');
  assert(open.gold > 0 && open.gotGear, 'an opened chest yields gold + a gear reward');

  // 4. The AFK bot never opens chests (active-play only)
  const botSkips = await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0;
    p.addItem(makeMaterial('key', 3));
    p.afk = true;                                  // AFK mode on
    const c = game.world.chests.find(ch => ch.openT <= game.time) || game.world.chests[1];
    c.openT = 0; p.x = c.x; p.y = c.y;
    game.updateChests();
    return { opened: c.openT > game.time, keysLeft: game.matCount(p, 'key') };
  });
  assert(!botSkips.opened && botSkips.keysLeft === 3, 'the AFK bot walks over chests without opening them');

  // 5. Keys drop from elites; the chest sprite exists
  const drops = await page.evaluate(() => {
    // elite key chance lives in handleEnemyDead — verify the sprite + material wiring instead
    const hasChestSprite = !!(SPRITES.chest);
    const keyItem = makeMaterial('key', 1);
    const teleBuyable = Object.keys(POTIONS).includes('tele');
    return { hasChestSprite, keyName: itemName(keyItem), keyStacks: isStackable(keyItem), teleBuyable };
  });
  assert(drops.hasChestSprite, 'the chest sprite is registered');
  assert(drops.keyStacks && drops.keyName.length > 0, 'chest keys are a named stackable material');
  assert(drops.teleBuyable, 'the teleport scroll is a shop-buyable consumable');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL CHEST/SCROLL/KEY TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
