/* Fixes: item tooltip above the inventory window + legendary drop SFX.
 * Server on 8900. Run: PW_CHROMIUM=/path node tooltip_test.js */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';
const exe = process.env.PW_CHROMIUM || undefined;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('PASS: ' + m); }

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(URL);
  await page.evaluate(() => {
    startGame('warrior', null);
    const p = game.players[0];
    p.addItem(rollItem({ kind: 'weapon', tier: 'legend', ilvl: 20 }));
  });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. tooltip element is top-level (not trapped inside #hud)
  const placement = await page.evaluate(() => {
    const tip = document.getElementById('skill-tooltip');
    return { parent: tip.parentElement.id, insideHud: !!tip.closest('#hud'),
             z: getComputedStyle(tip).zIndex };
  });
  assert(!placement.insideHud, 'tooltip is not inside #hud (parent: ' + placement.parent + ')');
  assert(parseInt(placement.z, 10) > 50, 'tooltip z-index is above the overlay layer (' + placement.z + ')');

  // 2. open inventory, hover the item, tooltip must be ON TOP (not occluded by the panel)
  await page.click('#btn-inv');
  await page.waitForSelector('#inv-panel:not(.hidden)', { timeout: 3000 });
  await page.hover('#inv-grid .inv-cell');
  await page.waitForSelector('#skill-tooltip:not(.hidden)', { timeout: 3000 });
  const onTop = await page.evaluate(() => {
    // effective stacking z of an element within its top-level context
    const stackZ = el => {
      let n = el, z = 0;
      while (n && n !== document.body) {
        const s = getComputedStyle(n);
        const v = parseInt(s.zIndex, 10);
        if (!isNaN(v) && s.position !== 'static') { z = v; break; }
        n = n.parentElement;
      }
      return z;
    };
    const tip = document.getElementById('skill-tooltip');
    const panel = document.getElementById('inv-panel');
    const tr = tip.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    const overlap = !(tr.right < pr.left || tr.left > pr.right || tr.bottom < pr.top || tr.top > pr.bottom);
    // both are children of #game-wrap → compare their stacking z directly
    return { tipZ: stackZ(tip), panelZ: stackZ(panel), overlap,
             siblings: tip.parentElement === panel.parentElement, hasText: tip.textContent.length > 0 };
  });
  assert(onTop.hasText, 'tooltip is rendered with content while inventory is open');
  assert(onTop.overlap, 'tooltip is positioned over the inventory panel area');
  assert(onTop.siblings && onTop.tipZ > onTop.panelZ,
    'tooltip out-stacks the panel (tip z=' + onTop.tipZ + ' > panel z=' + onTop.panelZ + '), so it paints on top');
  await page.screenshot({ path: 'tooltip_over_inv.png' });
  await page.click('#btn-inv-close');

  // 3. legendary/mystic drops play the fanfare; common/rare do not
  const sfx = await page.evaluate(() => {
    const p = game.players[0];
    const calls = [];
    const orig = game.sfx.bind(game);
    game.sfx = (n) => { calls.push(n); };
    // force a mystic drop
    const realRoll = window.rollItem;
    window.rollItem = () => ({ uid: 'x', key: 'sword2h', kind: 'weapon', slot: 'hands', tier: 'mystic', ilvl: 10,
                               rows: [{ stat: 'str', val: 5 }, { stat: 'atk', val: 5 }, { stat: 'hp', val: 20 }] });
    const bsp = game.world.spawnPoints.find(s => s.boss);
    game.handleEnemyDead(bsp.idx, 900, p.x, p.y, 'local', true, p);
    const mysticPlayed = calls.includes('legendary');
    // force a common drop — no fanfare
    calls.length = 0;
    window.rollItem = () => ({ uid: 'y', key: 'head', kind: 'armor', slot: 'head', tier: 'common', ilvl: 2,
                               rows: [{ stat: 'vit', val: 1 }, { stat: 'hp', val: 12 }, { stat: 'agi', val: 1 }] });
    // ensure a drop happens: boss always drops
    game.handleEnemyDead(bsp.idx, 900, p.x, p.y, 'local', true, p);
    const commonPlayed = calls.includes('legendary');
    window.rollItem = realRoll; game.sfx = orig;
    return { mysticPlayed, commonPlayed };
  });
  assert(sfx.mysticPlayed, 'mystic drop plays the legendary fanfare');
  assert(!sfx.commonPlayed, 'common drop does NOT play the fanfare');
  assert(await page.evaluate(() => typeof SFX.legendary === 'function'), 'SFX.legendary sound is defined');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL TOOLTIP/SFX TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
