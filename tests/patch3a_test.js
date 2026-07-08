/* PR-1 (fixes-first) feature tests. Expects server on 8900.
 * Run: PW_CHROMIUM=/path node patch3a_test.js */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';
const WS = 'ws://127.0.0.1:8900';
const exe = process.env.PW_CHROMIUM || undefined;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('PASS: ' + m); }

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'ThisIsAVeryLongHeroName'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); game.players[0].level = 48; });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. HUD: class + level on one line; name has ellipsis + full-name title
  const classLine = await page.evaluate(() => {
    const el = document.getElementById('p1-name').parentElement;
    return el.textContent.replace(/\s+/g, ' ').trim();
  });
  assert(/Warrior Lv 48/.test(classLine), 'class + level share one line: "' + classLine + '"');
  const nameInfo = await page.evaluate(() => {
    const el = document.getElementById('p1-playername');
    return { title: el.title, clipped: el.scrollWidth > el.clientWidth + 1,
             overflow: getComputedStyle(el).textOverflow };
  });
  assert(nameInfo.title === 'ThisIsAVeryLongHeroName', 'full name in hover title');
  assert(nameInfo.overflow === 'ellipsis' && nameInfo.clipped, 'long name is clipped with ellipsis');

  // 2. Buff/debuff display: cast a buff and a debuff, expect chips with duration
  const buffState = await page.evaluate(() => {
    const p = game.players[0];
    p.addBuff({ tag: 'warcry', kind: 'dmgMul', v: 1.35, t: 8, icon: '💢', name: 'buff.warcry' });
    p.addBuff({ tag: 'slowtest', kind: 'spdMul', v: 0.5, t: 6, icon: '🐌', name: 'buff.swift', debuff: true });
    UI.update(game);
    const chips = [...document.querySelectorAll('#buffbar-p1 .buff-chip')];
    return {
      count: chips.length,
      hasDebuff: chips.some(c => c.classList.contains('debuff')),
      hasTime: chips.every(c => /\d+s/.test(c.querySelector('.bc-time').textContent)),
      title: chips[0] && chips[0].title,
    };
  });
  assert(buffState.count === 2, 'two status chips shown (buff + debuff)');
  assert(buffState.hasDebuff, 'debuff chip styled distinctly');
  assert(buffState.hasTime, 'each chip shows remaining seconds');
  assert(/War Cry/.test(buffState.title || ''), 'chip tooltip shows buff name');
  // re-applying same tag refreshes rather than stacks
  const noStack = await page.evaluate(() => {
    const p = game.players[0];
    p.addBuff({ tag: 'warcry', kind: 'dmgMul', v: 1.35, t: 8, icon: '💢', name: 'buff.warcry' });
    return p.buffs.filter(b => b.tag === 'warcry').length;
  });
  assert(noStack === 1, 're-applying a buff refreshes (no duplicate)');

  // 3. AFK focus menu: default both on; toggling persists
  await page.evaluate(() => document.getElementById('afk-cfg-p1').click());
  await page.waitForSelector('#afk-panel:not(.hidden)', { timeout: 3000 });
  let sel = await page.evaluate(() =>
    [...document.querySelectorAll('.afk-opt')].map(b => [b.dataset.focus, b.classList.contains('selected')]));
  assert(sel.every(([, on]) => on), 'both Boss and Monster selected by default');
  await page.click('.afk-opt[data-focus="boss"]');   // deselect boss
  const afkState = await page.evaluate(() => ({ focus: AFK_FOCUS, stored: JSON.parse(localStorage.getItem('pixelrealms_afk')) }));
  assert(afkState.focus.boss === false && afkState.stored.boss === false, 'deselecting Boss persists to localStorage');
  await page.click('.afk-opt[data-focus="boss"]');   // restore
  await page.click('#btn-afk-close');

  // 4. AFK boss priority: with a boss nearby and boss-focus on, bot targets the boss
  const bossPick = await page.evaluate(() => {
    AFK_FOCUS.boss = true; AFK_FOCUS.monster = true;
    const p = game.players[0]; p.level = 30; p.afk = true; p.bot = null;
    const sp = game.world.spawnPoints.find(s => s.boss);
    // spawn the boss and a plain monster right next to the player
    const boss = new Enemy(sp, game); boss.remote = false; boss.x = p.x + 120; boss.y = p.y; sp.enemy = boss;
    game.enemies.push(boss);
    const mob = new Enemy(game.world.spawnPoints.find(s => !s.boss && s.tier === 1), game);
    mob.x = p.x + 40; mob.y = p.y; game.enemies.push(mob);
    // capture what the bot faces
    const out = game.botInput(p, 0.05);
    // the bot should be engaging the boss: face roughly toward +x (boss side)
    return { faceX: out.face ? out.face.x : null, bossAlive: !boss.dead };
  });
  assert(bossPick.faceX !== null && bossPick.faceX > 0.5, 'AFK bot prioritizes the nearby boss (faces it)');

  // 5. AFK boss-avoidance: boss-focus off + boss near => flee (move away from boss)
  const flee = await page.evaluate(() => {
    AFK_FOCUS.boss = false;
    const p = game.players[0];
    const boss = game.enemies.find(e => e.type.boss);
    boss.x = p.x + 100; boss.y = p.y;              // boss to the right
    const out = game.botInput(p, 0.05);
    return { mx: out.mx };                          // should move left (away)
  });
  assert(flee.mx < -0.3, 'boss-focus off: bot flees away from the boss');
  await page.evaluate(() => { AFK_FOCUS.boss = true; });

  // 6. Retreat pathfinding: botSteer routes around a solid obstacle instead of into it
  const routed = await page.evaluate(() => {
    const p = game.players[0];
    // find a walkable tile with a solid neighbor to steer around
    const W = game.world;
    // place a virtual goal straight through a known solid: pick player pos and a solid dir
    // Use botPathClear + botSteer: aim at a goal behind a solid and confirm heading bends
    // Build a scenario: put player next to a solid tile column
    // find any solid object tile near center
    let solid = null;
    for (const [k, o] of W.objects) { solid = o; break; }
    if (!solid) return { ok: true, note: 'no objects' };
    // stand just to the left of the solid, aim straight at it (east)
    p.x = solid.tx * 32 - 20; p.y = solid.ty * 32 + 16;
    const bs = { checkT: 0, lastX: p.x, lastY: p.y, unstuckT: 0, detour: null, stuckN: 0, avoid: new Map() };
    const out = { mx: 0, my: 0, attack: false, skills: [], face: null };
    const gx = solid.tx * 32 + 80, gy = p.y;   // goal directly beyond the solid
    game.botSteer(out, p, gx, gy, bs, 0.05);
    const straightBlocked = !game.botPathClear(p, 1, 0, 60);
    const headingBent = Math.abs(out.my) > 0.1;   // steered off the pure-east line
    return { straightBlocked, headingBent, mx: out.mx, my: out.my };
  });
  assert(routed.ok || (routed.straightBlocked && routed.headingBent),
    'botSteer bends around a solid obstacle: ' + JSON.stringify(routed));

  // 7. Name uniqueness: server endpoint + join rejection
  const nameApi = await page.evaluate(async () => {
    const free = await (await fetch('/api/name-available?name=UniqueGuy123')).json();
    return free;
  });
  assert(nameApi.available === true, 'unused name reports available');

  // connect one client, then a second with the SAME name must be rejected
  await browser.close();
  const b2 = await chromium.launch({ executablePath: exe });
  const pa = await b2.newPage(), pb = await b2.newPage();
  for (const pg of [pa, pb]) { await pg.goto(URL); await pg.evaluate(() => startGame('mage', null)); }
  await pa.evaluate(ws => game.goOnline(ws, 'nameroom', 'DupName'), WS);
  await pa.waitForFunction(() => game.net.isOnline, null, { timeout: 5000 });
  const taken = await pa.evaluate(async () => (await (await fetch('/api/name-available?name=DupName')).json()).available);
  assert(taken === false, 'a connected name reports as taken');
  await pb.evaluate(ws => game.goOnline(ws, 'nameroom', 'DupName'), WS);
  await pb.waitForFunction(() => game.net.nameTaken === true || game.net.status === 'error', null, { timeout: 5000 });
  const rejected = await pb.evaluate(() => ({ taken: !!game.net.nameTaken, online: game.net.isOnline }));
  assert(rejected.taken && !rejected.online, 'second client with a duplicate name is rejected');
  // after the first leaves, the name frees up
  await pa.evaluate(() => game.goOffline());
  await pa.waitForTimeout(300);
  const freed = await pa.evaluate(async () => (await (await fetch('/api/name-available?name=DupName')).json()).available);
  assert(freed === true, 'name frees up after the owner disconnects');

  await b2.close();
  console.log('\nALL PATCH-3A TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
