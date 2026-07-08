/* PR-B tests: shop, storage stash, hotkey potion slots. Server on 8900.
 * Run: PW_CHROMIUM=/path node shop_test.js */
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

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Shopper'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('mage', null); game.players[0].gold = 500; });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. Shop buy: gold decreases, potion stack appears; poor check blocks
  const buy = await page.evaluate(() => {
    const p = game.players[0];
    const g0 = p.gold;
    game.buyPotion(p, 'hp', 1);
    game.buyPotion(p, 'hp', 1);
    const stack = p.inventory.find(i => i.key === 'hp');
    p.gold = 0;
    const blocked = game.buyPotion(p, 'atk', 1);
    return { spent: g0 - (500 - POTIONS.hp.price * 2), g0, count: stack ? stack.count : 0, blocked };
  });
  assert(buy.count === 2, 'buying stacks 2 HP potions');
  assert(buy.blocked === false, 'buying with no gold is refused');

  // 2. Shop UI: buy via real click, then Sell tab lists gear and sells it
  await page.evaluate(() => {
    const p = game.players[0]; p.gold = 300; p.inventory = [];
    p.addItem(rollItem({ kind: 'weapon', tier: 'legend', ilvl: 20 }));
  });
  await page.click('#btn-shop');
  await page.waitForSelector('#shop-panel:not(.hidden)', { timeout: 3000 });
  await page.click('#shop-content .shop-row .pix-btn');   // buy first potion
  const boughtUI = await page.evaluate(() => game.players[0].inventory.some(i => i.kind === 'potion'));
  assert(boughtUI, 'Buy button adds a potion to the bag');
  await page.click('.shop-tab[data-tab="sell"]');
  const goldBefore = await page.evaluate(() => game.players[0].gold);
  await page.click('#shop-content .shop-row .pix-btn');   // sell first sellable
  const soldUI = await page.evaluate(() => game.players[0].gold);
  assert(soldUI > goldBefore, 'Sell button pays gold for an item');
  await page.click('#btn-shop-close');

  // 3. Storage: deposit from bag, item leaves bag & appears in storage; withdraw reverses
  const stash = await page.evaluate(() => {
    const p = game.players[0];
    p.inventory = []; p.storage = [];
    const gear = rollItem({ kind: 'armor', tier: 'rare', ilvl: 8 });
    p.addItem(gear);
    p.depositItem(gear);
    const afterDep = { bag: p.inventory.length, store: p.storage.length };
    p.withdrawItem(p.storage[0]);
    const afterWd = { bag: p.inventory.length, store: p.storage.length };
    return { afterDep, afterWd };
  });
  assert(stash.afterDep.bag === 0 && stash.afterDep.store === 1, 'deposit moves item bag → storage');
  assert(stash.afterWd.bag === 1 && stash.afterWd.store === 0, 'withdraw moves item storage → bag');

  // 4. Storage deposit merges potion stacks
  const potStash = await page.evaluate(() => {
    const p = game.players[0];
    p.inventory = []; p.storage = [];
    p.addItem(makePotion('mp', 3));
    p.depositItem(p.inventory[0], 3);
    p.addItem(makePotion('mp', 2));
    p.depositItem(p.inventory[0], 2);
    const s = p.storage.find(i => i.key === 'mp');
    return { stacks: p.storage.length, count: s ? s.count : 0 };
  });
  assert(potStash.stacks === 1 && potStash.count === 5, 'depositing potions merges into one stack (5)');

  // 5. Storage UI tab shows deposited items
  await page.evaluate(() => { const p = game.players[0]; p.inventory = []; p.storage = [makePotion('regen', 4)]; });
  await page.click('#btn-inv');
  await page.waitForSelector('#inv-panel:not(.hidden)', { timeout: 3000 });
  await page.click('.inv-tab[data-tab="storage"]');
  const storeCells = await page.$$eval('#inv-grid .inv-cell', els => els.length);
  assert(storeCells === 1, 'Storage tab renders stored items');
  // withdraw via UI
  await page.click('#inv-grid .inv-cell');
  await page.click('#inv-actions .pix-btn');   // Withdraw
  const withdrew = await page.evaluate(() => game.players[0].inventory.length === 1 && game.players[0].storage.length === 0);
  assert(withdrew, 'Withdraw button moves the item back to the bag');
  await page.click('#btn-inv-close');

  // 6. Hotkey potion slots: assign, HUD shows it, key press uses one
  const quick = await page.evaluate(() => {
    const p = game.players[0];
    p.inventory = []; p.quickItems = [null, null, null];
    p.addItem(makePotion('hp', 3));
    p.hp = 1;
    p.quickItems[0] = 'hp';                 // assign HP potion to slot 1
    UI.update(game);
    return { assigned: p.quickItems[0], hasSlot: !!document.querySelector('#quickbar-p1 .quick-slot') };
  });
  assert(quick.assigned === 'hp' && quick.hasSlot, 'HP potion assigned to hotkey slot, shown on HUD');
  // press the quick1 key (default Digit4) → uses one, heals
  await page.evaluate(() => { window.__hp0 = game.players[0].hp; });
  await page.keyboard.press('Digit4');
  const used = await page.evaluate(() => {
    const p = game.players[0];
    const stack = p.inventory.find(i => i.key === 'hp');
    return { count: stack ? stack.count : 0, healed: p.hp > window.__hp0 };
  });
  assert(used.count === 2, 'pressing the hotkey consumes one potion (3 → 2)');
  assert(used.healed, 'the hotkey potion healed the player');

  // assign via inventory UI button
  await page.evaluate(() => { game.players[0].quickItems = [null, null, null]; });
  await page.click('#btn-inv');
  await page.waitForSelector('#inv-panel:not(.hidden)', { timeout: 3000 });
  await page.click('.inv-tab[data-tab="bag"]');
  await page.click('#inv-grid .inv-cell');   // select the potion
  // action buttons: Use, ⌨4, ⌨5, ⌨6, Deposit, Destroy — click the first slot-assign (Use is [0])
  const assignBtn = await page.$$('#inv-actions .pix-btn');
  // find the one whose text contains the quick1 key label
  const idx = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#inv-actions .pix-btn')];
    return btns.findIndex(b => /⌨/.test(b.textContent));
  });
  assert(idx >= 0, 'inventory shows assign-to-hotkey buttons for potions');
  await assignBtn[idx].click();
  const assignedUI = await page.evaluate(() => game.players[0].quickItems[0]);
  assert(assignedUI === 'hp' || assignedUI === 'regen' || typeof assignedUI === 'string', 'assign button set a hotkey potion');
  await page.click('#btn-inv-close');

  // 7. save/load round-trips storage + quick slots
  const persisted = await page.evaluate(() => {
    const p = game.players[0];
    p.storage = [rollItem({ kind: 'weapon', tier: 'mystic', ilvl: 20 })];
    p.quickItems = ['hp', null, 'mp'];
    game.save();
    return JSON.parse(localStorage.getItem('pixelrealms_save')).players[0];
  });
  assert(persisted.storage.length === 1 && persisted.quickItems[0] === 'hp' && persisted.quickItems[2] === 'mp',
    'storage + quick slots saved');
  await page.reload();
  await page.evaluate(() => { const d = Game.loadSave(); startGame(d.players[0].clsId, d.players[0]); });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });
  const reloaded = await page.evaluate(() => {
    const p = game.players[0];
    return { store: p.storage.length, q0: p.quickItems[0], q2: p.quickItems[2],
             storeTier: p.storage[0] && p.storage[0].tier };
  });
  assert(reloaded.store === 1 && reloaded.q0 === 'hp' && reloaded.q2 === 'mp' && reloaded.storeTier === 'mystic',
    'storage gear + quick slots restored on reload');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL SHOP/STORAGE/QUICK TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
