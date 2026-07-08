/* Browser test: inventory category filter + tier sort, stat-panel gear
 * bonus (base + gear), equipped-compare tooltip, and item trading between
 * two clients. Server on 8900.
 * Run: PW_CHROMIUM=/path node inv_trade_test.js */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';
const exe = process.env.PW_CHROMIUM || undefined;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('PASS: ' + m); }

async function boot(page, name) {
  await page.addInitScript(n => localStorage.setItem('pixelrealms_name', n), name);
  await page.goto(URL);
  await page.evaluate(() => startGame('warrior', null));
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });
}

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const errors = [];
  const A = await browser.newPage();
  A.on('pageerror', e => errors.push(String(e)));
  await boot(A, 'Alice');

  // seed a varied bag: weapons of different tiers + armor + a potion stack
  await A.evaluate(() => {
    const p = game.players[0];
    p.inventory = [];
    p.addItem(rollItem({ kind: 'weapon', key: 'sword1h', tier: 'common', ilvl: 5 }));
    p.addItem(rollItem({ kind: 'weapon', key: 'sword2h', tier: 'mystic', ilvl: 10 }));
    p.addItem(rollItem({ kind: 'armor',  key: 'head',    tier: 'rare',   ilvl: 6 }));
    p.addItem(rollItem({ kind: 'armor',  key: 'boots',   tier: 'legend', ilvl: 8 }));
    p.addItem(makePotion('hp', 5));
  });

  // 1. Weapon filter shows only the two weapons
  await A.evaluate(() => UI.openInventory());
  await A.waitForSelector('#inv-panel:not(.hidden)', { timeout: 3000 });
  const weaponCount = await A.evaluate(() => {
    [...document.querySelectorAll('#inv-filter .filt')].find(b => b.textContent === t('slot.hands')).click();
    return document.querySelectorAll('#inv-grid .inv-cell').length;
  });
  assert(weaponCount === 2, 'Weapon filter shows only weapons (' + weaponCount + ')');

  // 2. All + tier sort: highest tier (mystic) comes first
  const firstColor = await A.evaluate(() => {
    [...document.querySelectorAll('#inv-filter .filt')].find(b => b.textContent === t('inv.filterAll')).click();
    return document.querySelector('#inv-grid .inv-cell').style.borderColor;
  });
  assert(/255,\s*77,\s*109/.test(firstColor), 'highest tier sorts first (' + firstColor + ')');

  // 3. Stat panel shows base + gear bonus on a primary stat
  const statBonus = await A.evaluate(() => {
    const p = game.players[0];
    const it = p.inventory.find(i => i.tier === 'mystic');
    if (!it.rows.some(r => r.stat === 'str')) it.rows[0] = { stat: 'str', val: 7 };
    p.equipItem(it);
    UI.openStatPanel(p);
    const rows = [...document.querySelectorAll('#sp-stats .sp-row')];
    const strRow = rows.find(r => /STR/.test(r.querySelector('.sr-name').textContent));
    const bonusEl = strRow.querySelector('.sr-bonus');
    return { bonusText: bonusEl ? bonusEl.textContent.trim() : null, agg: p.equipAgg().str };
  });
  assert(statBonus.agg > 0 && statBonus.bonusText === '+' + statBonus.agg,
    'stat panel shows +gear bonus (' + JSON.stringify(statBonus) + ')');
  await A.evaluate(() => UI.closeStatPanel());

  // 4. Hovering a bag weapon shows the equipped-compare block
  const cmp = await A.evaluate(() => {
    UI.openInventory();
    [...document.querySelectorAll('#inv-filter .filt')].find(b => b.textContent === t('inv.filterAll')).click();
    const bagWeapon = game.players[0].inventory.find(i => i.kind === 'weapon');
    UI.showItemTip(bagWeapon, { clientX: 200, clientY: 200 });
    return document.getElementById('skill-tooltip').innerHTML;
  });
  assert(/cmp-head/.test(cmp) && /(cmp-up|cmp-down)/.test(cmp), 'hover shows equipped-compare block with deltas');
  await A.evaluate(() => UI.closeInventory());

  // 5. Item trade: A gifts a gear item to B
  await A.evaluate(() => game.goOnline('Alice'));
  await A.waitForFunction(() => game.net.isOnline, null, { timeout: 5000 });
  const B = await browser.newPage();
  B.on('pageerror', e => errors.push(String(e)));
  await boot(B, 'Bob');
  await B.evaluate(() => game.goOnline('Bob'));
  await B.waitForFunction(() => game.net.isOnline, null, { timeout: 5000 });
  await A.waitForFunction(() => game.remotePlayers.size >= 1, null, { timeout: 5000 });
  await B.waitForFunction(() => game.remotePlayers.size >= 1, null, { timeout: 5000 });

  await A.evaluate(() => {
    const p = game.players[0];
    const gift = rollItem({ kind: 'armor', key: 'chest', tier: 'unique', ilvl: 9 });
    gift.rows = [{ stat: 'vit', val: 9 }]; gift.uid = 'GIFT-UID';
    p.inventory.push(gift);
    const [cid] = [...game.remotePlayers][0];
    game.openTradeWith(p, cid + ':0', 'Bob');
  });
  await B.waitForFunction(() => !!game.pendingTrade, null, { timeout: 5000 });
  await B.evaluate(() => game.answerTradeRequest(true));
  await A.waitForFunction(() => game.trade && game.trade.stage === 'open', null, { timeout: 5000 });

  await A.evaluate(() => game.addTradeItem(game.players[0].inventory.find(i => i.uid === 'GIFT-UID')));
  await A.waitForFunction(() => game.trade && game.trade.myItems.length === 1, null, { timeout: 3000 });
  const escrowed = await A.evaluate(() => game.players[0].inventory.some(i => i.uid === 'GIFT-UID'));
  assert(!escrowed, 'offered item is escrowed out of the sender bag');
  await B.waitForFunction(() => game.trade && game.trade.theirItems.length === 1, null, { timeout: 3000 });

  await A.evaluate(() => game.toggleTradeAccept());
  await B.evaluate(() => game.toggleTradeAccept());
  await B.waitForFunction(() => !game.trade, null, { timeout: 3000 });

  const gotIt = await B.evaluate(() => game.players[0].inventory.some(
    i => i.kind === 'armor' && i.slot === 'chest' && i.rows.some(r => r.stat === 'vit' && r.val === 9)));
  assert(gotIt, 'traded item received by the partner');
  const senderGone = await A.evaluate(() => !game.players[0].inventory.some(i => i.uid === 'GIFT-UID') && !game.trade);
  assert(senderGone, 'traded item stays gone from the sender');

  assert(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL INV/TRADE-ITEM TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
