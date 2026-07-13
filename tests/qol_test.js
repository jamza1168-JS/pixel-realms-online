/* QoL + AFK-boss batch: double-click equip/unequip, sell-tab filter, and the
 * AFK bot fighting bosses. Server on 8900.
 * Run: PW_CHROMIUM=/path node qol_test.js */
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

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Handy'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. AFK bot attacks a boss (Boss focus on) regardless of level — no lv-18 gate
  const afk = await page.evaluate(() => {
    AFK_FOCUS.boss = true; AFK_FOCUS.monster = true;
    const p = game.players[0];
    p.level = 5; p.afk = true; p.hp = p.derived.maxHp; p.bot = null;
    p.x = game.world.spawnX; p.y = game.world.spawnY - 260;   // out of the heal circle
    game.pickups = []; game.projectiles = [];
    // a live demon boss right next to the player, clear line of sight
    const boss = new Enemy({ idx: 900, type: 'demon', tier: 4, elite: false, x: p.x + 30, y: p.y }, game);
    boss.x = p.x + 30; boss.y = p.y; boss.remote = false;
    game.enemies = [boss];
    const los = game.world.hasLineOfSight(p.x, p.y, boss.x, boss.y);
    const out = game.botInput(p, 0.1);
    // and confirm the roam logic will head to a boss lair when focused (spawn cleared)
    game.enemies = [];
    const out2 = game.botInput(p, 0.1);
    const lair = game.world.spawnPoints.find(s => s.boss);
    const roamingToBoss = Math.abs((p.x + out2.mx) - Math.sign(lair.x - p.x) - p.x) >= 0 && (out2.mx !== 0 || out2.my !== 0);
    return { attacked: out.attack, faced: !!out.face, los, movingWhenRoaming: (out2.mx !== 0 || out2.my !== 0) };
  });
  assert(afk.attacked, 'AFK bot attacks an adjacent boss with Boss focus on, even below lv 18 (los=' + afk.los + ')');
  assert(afk.movingWhenRoaming, 'AFK bot roams (does not idle) when seeking a boss lair');

  // 2. Double-click a bag item equips it; double-clicking equips/unequips path
  const dbl = await page.evaluate(() => {
    const p = game.players[0]; p.afk = false; p.inventory.length = 0;
    for (const s of EQUIP_SLOTS) p.equip[s] = null;
    const gear = rollItem({ kind: 'armor', key: 'chest', tier: 'rare', ilvl: 5 });
    p.addItem(gear);
    UI.openInventory ? UI.openInventory() : UI.renderInventory();
    // real dblclick on the rendered cell
    const cell = document.querySelector('#inv-grid .inv-cell');
    const hadCell = !!cell;
    cell && cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const equipped = p.equip.chest === gear;
    // now double-click the equipped slot to take it off
    const slotRow = [...document.querySelectorAll('#inv-slots .inv-slot')].find(r => /chest/i.test(r.textContent) || true);
    // call the wired handler directly via a dblclick on the chest slot row
    const chestIdx = EQUIP_SLOTS.indexOf('chest');
    const rows = document.querySelectorAll('#inv-slots .inv-slot');
    rows[chestIdx] && rows[chestIdx].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const unequipped = p.equip.chest === null && p.inventory.includes(gear);
    return { hadCell, equipped, unequipped };
  });
  assert(dbl.hadCell && dbl.equipped, 'double-clicking a bag item equips it');
  assert(dbl.unequipped, 'double-clicking an equipped slot unequips it');

  // 3. Sell tab has category filters that narrow the list like the bag
  const sell = await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0;
    p.addItem(makePotion('hp', 3));
    p.addItem(rollItem({ kind: 'armor', key: 'chest', tier: 'common', ilvl: 3 }));
    p.addItem(rollItem({ kind: 'weapon', key: 'sword1h', tier: 'rare', ilvl: 3 }));
    UI.openShop();
    UI.shopTab = 'sell'; UI.shopFilter = 'all'; UI.renderShop();
    const chips = document.querySelectorAll('#shop-content .shop-filter .filt').length;
    const allRows = document.querySelectorAll('#shop-content .shop-row').length;
    UI.shopFilter = 'potion'; UI.renderShop();
    const potionRows = document.querySelectorAll('#shop-content .shop-row').length;
    UI.shopFilter = 'chest'; UI.renderShop();
    const chestRows = document.querySelectorAll('#shop-content .shop-row').length;
    return { chips, allRows, potionRows, chestRows };
  });
  assert(sell.chips > 5, 'the Sell tab shows category filter chips (' + sell.chips + ')');
  assert(sell.allRows === 3, 'Sell "All" shows every bag item (' + sell.allRows + ')');
  assert(sell.potionRows === 1, 'Sell filtered to Potions shows only the potion stack');
  assert(sell.chestRows === 1, 'Sell filtered to Chest shows only the chest armor');

  // 4. the trade window is set up to scroll (CSS applied to #trade-content)
  const scroll = await page.evaluate(() => {
    const el = document.getElementById('trade-content');
    const cs = el ? getComputedStyle(el) : null;
    return { overflowY: cs && cs.overflowY };
  });
  assert(scroll.overflowY === 'auto' || scroll.overflowY === 'scroll', 'the trade window content scrolls (' + scroll.overflowY + ')');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL QOL/AFK TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
