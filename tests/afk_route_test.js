/* AFK routing through biomes — the bot must weave through decor and make
 * real cross-map progress (not freeze on trees/rocks). Server on 8900.
 * Run: PW_CHROMIUM=/path node afk_route_test.js */
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

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Roamer'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. biome decor is thinner than the hub (hub has road corridors; biomes
  //    are a uniform scatter, so they must be sparser to stay walkable).
  const cov = await page.evaluate(() => {
    const objs = (id) => new World(id).objects.size;
    return { hub: objs('hub'), forest: objs('forest'), desert: objs('desert'), snow: objs('snow'), volcano: objs('volcano') };
  });
  assert(cov.forest < cov.hub, 'forest has fewer decor objects than the hub (' + cov.forest + ' < ' + cov.hub + ')');
  for (const b of ['forest', 'desert', 'snow', 'volcano']) {
    assert(cov[b] <= cov.hub, b + ' decor count is at/below the hub (' + cov[b] + ')');
  }

  // 2. Drive botSteer across each biome toward a far goal and confirm the bot
  //    covers real ground (deterministic: botSteer has no randomness).
  const run = await page.evaluate((mapId) => {
    game.warpTo(mapId);
    const w = game.world, p = game.players[0];
    p.afk = true;
    p.x = w.spawnX; p.y = w.spawnY;
    const start = { x: p.x, y: p.y };
    const gx = w.spawnX + 1500, gy = w.spawnY;   // far east, within the map
    const bs = p.bot = { phase: 'hunt', checkT: 0, lastX: p.x, lastY: p.y, unstuckT: 0, detour: null, stuckN: 0, avoid: new Map() };
    const dt = 0.05;
    let stalls = 0, prevX = p.x, prevY = p.y, maxStuckN = 0;
    for (let i = 0; i < 900; i++) {
      game.time += dt;
      const out = { mx: 0, my: 0, attack: false, skills: [false, false, false], face: null };
      game.botSteer(out, p, gx, gy, bs, dt);
      const spd = p.derived.speed;
      const nx = p.x + out.mx * spd * dt, ny = p.y + out.my * spd * dt;
      if (w.canStand(nx, p.y)) p.x = nx;
      if (w.canStand(p.x, ny)) p.y = ny;
      maxStuckN = Math.max(maxStuckN, bs.stuckN || 0);
      if (Math.hypot(p.x - prevX, p.y - prevY) < 0.5) stalls++;
      prevX = p.x; prevY = p.y;
      if (Math.hypot(p.x - gx, p.y - gy) < 48) break;
    }
    return { traveled: Math.round(Math.hypot(p.x - start.x, p.y - start.y)), stalls, maxStuckN, mapId };
  }, 'forest');
  assert(run.traveled > 700, 'the bot makes real cross-map progress through the forest (' + run.traveled + 'px net)');
  assert(run.stalls < 220, 'the bot is not stuck idling most of the run (' + run.stalls + '/900 frames stalled)');

  for (const map of ['desert', 'snow', 'volcano']) {
    const r = await page.evaluate((mapId) => {
      game.warpTo(mapId);
      const w = game.world, p = game.players[0];
      p.afk = true; p.x = w.spawnX; p.y = w.spawnY;
      const start = { x: p.x, y: p.y };
      const gx = w.spawnX + 1500, gy = w.spawnY;
      const bs = p.bot = { phase: 'hunt', checkT: 0, lastX: p.x, lastY: p.y, unstuckT: 0, detour: null, stuckN: 0, avoid: new Map() };
      const dt = 0.05;
      for (let i = 0; i < 900; i++) {
        game.time += dt;
        const out = { mx: 0, my: 0, attack: false, skills: [false, false, false], face: null };
        game.botSteer(out, p, gx, gy, bs, dt);
        const spd = p.derived.speed;
        const nx = p.x + out.mx * spd * dt, ny = p.y + out.my * spd * dt;
        if (w.canStand(nx, p.y)) p.x = nx;
        if (w.canStand(p.x, ny)) p.y = ny;
        if (Math.hypot(p.x - gx, p.y - gy) < 48) break;
      }
      return { traveled: Math.round(Math.hypot(p.x - start.x, p.y - start.y)) };
    }, map);
    assert(r.traveled > 700, map + ': the bot makes real cross-map progress (' + r.traveled + 'px net)');
  }

  // 3. the hub still routes fine (the steering change did not regress it)
  const hub = await page.evaluate(() => {
    game.warpTo('hub');
    const w = game.world, p = game.players[0];
    p.afk = true; p.x = w.spawnX; p.y = w.spawnY;
    const start = { x: p.x, y: p.y };
    const gx = w.spawnX + 1400, gy = w.spawnY - 600;
    const bs = p.bot = { phase: 'hunt', checkT: 0, lastX: p.x, lastY: p.y, unstuckT: 0, detour: null, stuckN: 0, avoid: new Map() };
    const dt = 0.05;
    for (let i = 0; i < 900; i++) {
      game.time += dt;
      const out = { mx: 0, my: 0, attack: false, skills: [false, false, false], face: null };
      game.botSteer(out, p, gx, gy, bs, dt);
      const spd = p.derived.speed;
      const nx = p.x + out.mx * spd * dt, ny = p.y + out.my * spd * dt;
      if (w.canStand(nx, p.y)) p.x = nx;
      if (w.canStand(p.x, ny)) p.y = ny;
      if (Math.hypot(p.x - gx, p.y - gy) < 48) break;
    }
    return { traveled: Math.round(Math.hypot(p.x - start.x, p.y - start.y)) };
  });
  assert(hub.traveled > 700, 'the hub still routes fine after the steering change (' + hub.traveled + 'px net)');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL AFK ROUTING TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
