/* P3a — biome maps + warp portals. Expects server on 8900.
 * Run: PW_CHROMIUM=/path node map_test.js */
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

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Wanderer'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); });   // guest = offline/local
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. hub world is unchanged: same seed-derived spawn/chest counts as a fresh hub
  const hub = await page.evaluate(() => {
    const w = new World('hub');
    const w2 = new World();   // default = hub
    return {
      mapId: game.world.mapId,
      hasForestPortal: game.world.portals.some(p => p.to === 'forest'),
      spawnsSame: w.spawnPoints.length === w2.spawnPoints.length,
      eliteSame: JSON.stringify(w.spawnPoints.map(s => !!s.elite)) === JSON.stringify(w2.spawnPoints.map(s => !!s.elite)),
      bossPresent: !!w.worldBossSpawn,
    };
  });
  assert(hub.mapId === 'hub', 'game starts in the hub map');
  assert(hub.hasForestPortal, 'the hub has a warp portal to the forest');
  assert(hub.spawnsSame && hub.eliteSame, 'hub generation is deterministic (unchanged)');
  assert(hub.bossPresent, 'hub still has the world-boss lair');

  // 2. the forest map is a distinct, boss-free biome with a return portal
  const forest = await page.evaluate(() => {
    const f = new World('forest');
    return {
      mapId: f.mapId,
      hasReturn: f.portals.some(p => p.to === 'hub'),
      noBoss: !f.worldBossSpawn && !f.bossPos,
      spawns: f.spawnPoints.length,
      pool: [...new Set(f.spawnPoints.map(s => s.type))].sort().join(','),
      det: (() => { const g = new World('forest'); return f.spawnPoints.length === g.spawnPoints.length; })(),
    };
  });
  assert(forest.mapId === 'forest' && forest.hasReturn, 'forest is its own map with a return portal');
  assert(forest.noBoss, 'forest has no boss/world-boss (solo biome)');
  assert(forest.spawns > 40, 'forest is populated with enemies (' + forest.spawns + ')');
  assert(/wolf|bat|ghost|goblin/.test(forest.pool), 'forest spawns its themed mob pool: ' + forest.pool);
  assert(forest.det, 'forest generation is deterministic');

  // 3. warpTo swaps the world, repositions the player, and resets sim state
  const warp = await page.evaluate(() => {
    const p = game.players[0];
    game.warpTo('forest');
    const inForest = game.world.mapId === 'forest';
    const atEntry = Math.abs(p.x - game.world.entryX) < 2 && Math.abs(p.y - game.world.entryY) < 2;
    const clean = game.enemies.length === 0 && game.ghosts.size === 0;
    game._warpCd = 0;                 // skip the anti-bounce cooldown for the test
    game.warpTo('hub');
    const backHub = game.world.mapId === 'hub';
    return { inForest, atEntry, clean, backHub };
  });
  assert(warp.inForest && warp.atEntry, 'warping to the forest swaps the world and drops you at the entry');
  assert(warp.clean, 'warping clears enemies/ghosts from the previous map');
  assert(warp.backHub, 'the return portal warps back to the hub');

  // 4. stepping onto a portal triggers the warp (non-AFK), and the AFK bot does not
  const step = await page.evaluate(() => {
    const p = game.players[0];
    game._warpCd = 0; p.afk = true;
    const portal = game.world.portals.find(pt => pt.to === 'forest');
    p.x = portal.x; p.y = portal.y;
    game.updatePortals();
    const botStayed = game.world.mapId === 'hub';
    p.afk = false; game._warpCd = 0; p.x = portal.x; p.y = portal.y;
    game.updatePortals();
    return { botStayed, manualWarped: game.world.mapId === 'forest' };
  });
  assert(step.botStayed, 'the AFK bot never triggers a warp portal');
  assert(step.manualWarped, 'walking onto a portal (manual) warps you');

  // 5. signed-in (online) players are gated from biome portals for now (P3b)
  const gate = await page.evaluate(() => {
    game._warpCd = 0; game.warpTo('hub');       // back to hub
    const p = game.players[0]; p.afk = false;
    Account.token = 'test-token';                // simulate signed-in (loggedIn getter)
    const portal = game.world.portals.find(pt => pt.to === 'forest');
    p.x = portal.x; p.y = portal.y; game._warpCd = 0;
    game.updatePortals();
    const gated = game.world.mapId === 'hub';    // did NOT warp
    Account.token = null;
    return { gated, loggedIn: Account.loggedIn };
  });
  assert(gate.gated, 'signed-in players are gated from biome zones (solo-only for now)');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL MAP/PORTAL (P3a) TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
