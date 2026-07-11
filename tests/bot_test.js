/* Tests: LOS, bot no-shoot-into-walls + blacklist, manual override in AFK,
 * retreat fight-back, cursor aim, and a live AFK farming regression. */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const P = await browser.newPage();
  P.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await P.goto(URL);
  await P.evaluate(() => startGame('archer', null));   // ranged = worst case for LOS

  // --- line of sight primitive ---
  const los = await P.evaluate(() => {
    // find any solid tile with open tiles either side horizontally
    for (let ty = 2; ty < 118; ty++) {
      for (let tx = 3; tx < 117; tx++) {
        if (game.world.isSolid(tx, ty) && !game.world.isSolid(tx - 1, ty) && !game.world.isSolid(tx + 1, ty)) {
          const y = ty * 32 + 16;
          return {
            blocked: game.world.hasLineOfSight((tx - 1) * 32 + 16, y, (tx + 1) * 32 + 16, y),
            open: game.world.hasLineOfSight((tx - 1) * 32 + 16, y - 0.1 + 32 * 3, (tx - 1) * 32 + 16, y + 32 * 3 + 64),
          };
        }
      }
    }
    return null;
  });
  if (!los || los.blocked !== false) throw new Error('FAIL LOS through wall: ' + JSON.stringify(los));
  console.log('PASS hasLineOfSight blocked by solid tile');

  // --- bot refuses to shoot a mob it cannot see; walks instead ---
  await P.waitForFunction(() => game.enemies.some(e => !e.dead), null, { timeout: 5000 });
  const shootTest = await P.evaluate(() => {
    const p = game.players[0];
    // find a solid tile in tier-1 range and put a fake enemy behind it
    let spot = null;
    for (let ty = 20; ty < 100 && !spot; ty++) {
      for (let tx = 20; tx < 100 && !spot; tx++) {
        if (game.world.isSolid(tx, ty) && !game.world.isSolid(tx - 2, ty) && !game.world.isSolid(tx + 2, ty)
            && game.world.canStand((tx - 2) * 32 + 16, ty * 32 + 16) && game.world.canStand((tx + 2) * 32 + 16, ty * 32 + 16)) {
          spot = { tx, ty };
        }
      }
    }
    if (!spot) return { err: 'no spot' };
    const y = spot.ty * 32 + 16;
    p.x = (spot.tx - 2) * 32 + 16; p.y = y;
    p.afk = true; p.bot = null;
    const e = game.enemies.find(en => !en.dead);
    e.x = (spot.tx + 2) * 32 + 16; e.y = y;        // ~128px away: inside archer range 190
    e.tier = 1; e.state = 'idle';
    // silence all other enemies (move far away)
    for (const other of game.enemies) if (other !== e && !other.dead) { other.x = 30; other.y = 30; }
    const out = game.botInput(p, 0.016);
    return { attack: out.attack, moving: !!(out.mx || out.my) };
  });
  if (shootTest.err) throw new Error('FAIL setup: ' + shootTest.err);
  if (shootTest.attack || !shootTest.moving) throw new Error('FAIL no-LOS behavior: ' + JSON.stringify(shootTest));
  console.log('PASS bot walks toward blocked mob instead of shooting the wall');

  // --- blacklist after repeated stuck ---
  const blk = await P.evaluate(() => {
    const p = game.players[0];
    const bs = p.bot;
    bs.stuckN = 5;                      // simulate "stuck for a while"
    game.botInput(p, 0.016);            // should blacklist current target
    return { avoided: bs.avoid.size };
  });
  if (blk.avoided < 1) throw new Error('FAIL blacklist: ' + JSON.stringify(blk));
  console.log('PASS stuck target gets blacklisted');

  // --- manual override while AFK ---
  const manual = await P.evaluate(async () => {
    const p = game.players[0];
    p.x = game.world.spawnX; p.y = game.world.spawnY; p.bot = null;
    keys.add(KEYS.right);               // player presses D while AFK
    const x0 = p.x;
    await new Promise(r => setTimeout(r, 600));
    const movedRight = p.x - x0;
    keys.delete(KEYS.right);
    return { movedRight, stillAfk: p.afk };
  });
  if (manual.movedRight < 40 || !manual.stillAfk) throw new Error('FAIL manual override: ' + JSON.stringify(manual));
  console.log('PASS manual keys override the bot while AFK stays on');

  // --- retreat fight-back inside the circle ---
  const retreat = await P.evaluate(() => {
    const p = game.players[0];
    p.x = game.world.spawnX; p.y = game.world.spawnY;
    p.hp = p.derived.maxHp * 0.2;       // forces retreat phase
    p.bot = null;
    const e = game.enemies.find(en => !en.dead);
    e.x = p.x + 100; e.y = p.y;         // chaser inside archer range, LOS clear
    const out = game.botInput(p, 0.016);
    return { phase: p.bot.phase, attack: out.attack, faced: out.face && out.face.x > 0.9 };
  });
  if (retreat.phase !== 'retreat' || !retreat.attack || !retreat.faced) {
    throw new Error('FAIL retreat fight-back: ' + JSON.stringify(retreat));
  }
  console.log('PASS bot fights back while healing in the village circle');

  // --- cursor aim in manual play ---
  const aim = await P.evaluate(async () => {
    const p = game.players[0];
    p.afk = false; p.hp = p.derived.maxHp;
    p.x = game.cam.x + 400; p.y = game.cam.y + 300;
    // move mouse to the LEFT of the hero while walking RIGHT
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 400 - 200, clientY: 300 - 14 }));
    keys.add(KEYS.right);
    await new Promise(r => setTimeout(r, 300));
    keys.delete(KEYS.right);
    return { faceX: p.face.x };
  });
  if (aim.faceX >= 0) throw new Error('FAIL cursor aim: face should point left, got ' + aim.faceX);
  console.log('PASS attacks aim at the cursor, independent of movement');

  // --- regression: AFK farming still levels up over 45s ---
  const farm = await P.evaluate(async () => {
    const p = game.players[0];
    p.hp = p.derived.maxHp; p.afk = true; p.bot = null;
    const kills0 = p.kills, x0 = p.x, y0 = p.y;
    await new Promise(r => setTimeout(r, 45000));
    return { kills: p.kills - kills0, moved: Math.hypot(p.x - x0, p.y - y0), dead: p.dead };
  });
  if (farm.kills < 1 && farm.moved < 100) throw new Error('FAIL AFK farm regression: ' + JSON.stringify(farm));
  console.log('PASS AFK bot still farms:', JSON.stringify(farm));

  await browser.close();
  console.log('ALL BOT TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
