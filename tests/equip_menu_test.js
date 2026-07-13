/* Equipped-item upgrade menu, sticky selection, and the solo-zone badge.
 * Server on 8900. Run: PW_CHROMIUM=/path node equip_menu_test.js */
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

  await page.addInitScript(() => localStorage.setItem('pixelrealms_name', 'Smith'));
  await page.goto(URL);
  await page.evaluate(() => { startGame('warrior', null); });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });

  // 1. Clicking an EQUIPPED item shows the upgrade menu (Unequip + Reforge/
  //    Refine/Awaken) and the item is marked selected.
  const eq = await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0;
    for (const s of EQUIP_SLOTS) p.equip[s] = null;
    const chest = rollItem({ kind: 'armor', key: 'chest', tier: 'unique', ilvl: 8 });
    p.addItem(chest); p.equipItem(chest);
    UI.openInventory ? UI.openInventory() : UI.renderInventory();
    // click the equipped chest slot
    const chestIdx = EQUIP_SLOTS.indexOf('chest');
    const rows = document.querySelectorAll('#inv-slots .inv-slot');
    rows[chestIdx].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const labels = [...document.querySelectorAll('#inv-actions .pix-btn')].map(b => b.textContent);
    const selected = rows[chestIdx].classList.contains('selected');
    const hasReforge = labels.some(l => /Reforge|ตี/.test(l) || l.includes('⚒') || /⚒/.test(l));
    const hasRefine = labels.some(l => /Refine|ตีบวก|⚒ Refine/.test(l));
    const hasUnequip = labels.some(l => l === t('inv.unequip'));
    return { selected, labels, hasUnequip, hasReforgeOrRefine: labels.some(l => l.includes('⚒')) };
  });
  assert(eq.selected, 'clicking an equipped item marks its slot selected');
  assert(eq.hasUnequip, 'equipped item menu offers Unequip');
  assert(eq.hasReforgeOrRefine, 'equipped item menu offers upgrade actions (reforge/refine): ' + eq.labels.join(' | '));

  // 2. Refining an EQUIPPED weapon works in place and the stat sheet reflects it
  const upg = await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0;
    for (const s of EQUIP_SLOTS) p.equip[s] = null;
    const wpn = rollItem({ kind: 'weapon', key: 'sword1h', tier: 'rare', ilvl: 6 });
    p.addItem(wpn); p.equipItem(wpn);
    p.gold = 1e9; p.addItem(makeMaterial('ore', 99));
    const before = wpn.refine || 0;
    const res = game.refine(p, wpn);            // refine while equipped (+0 -> +1 is 100%)
    const stillEquipped = p.equip.hands === wpn;
    return { before, after: wpn.refine, ok: !!(res && res.success), stillEquipped };
  });
  assert(upg.ok && upg.after === upg.before + 1, 'refining an equipped weapon upgrades it in place');
  assert(upg.stillEquipped, 'the item stays equipped after refining');

  // 3. Selection is sticky: clicking the same item twice keeps it selected
  //    (no toggle-off) so the menu stays up.
  const sticky = await page.evaluate(() => {
    const p = game.players[0]; p.inventory.length = 0;
    for (const s of EQUIP_SLOTS) p.equip[s] = null;
    p.addItem(rollItem({ kind: 'armor', key: 'boots', tier: 'common', ilvl: 3 }));
    UI.invTab = 'bag'; UI.renderInventory();
    const cell = document.querySelector('#inv-grid .inv-cell');
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const sel1 = !!UI.invSel;
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // click again
    const sel2 = !!UI.invSel;
    const menuShown = document.querySelectorAll('#inv-actions .pix-btn').length > 0;
    return { sel1, sel2, menuShown };
  });
  assert(sticky.sel1 && sticky.sel2, 'clicking a selected item again keeps it selected (no toggle-off)');
  assert(sticky.menuShown, 'the action menu stays visible after re-clicking');

  // 4. Solo-zone badge: a signed-in player warped to a biome reads SOLO, not GUEST
  const badge = await page.evaluate(() => {
    Account.token = 'fake'; Account.heroName = 'Smith';
    game.goOffline && game.goOffline();
    game._warpCd = 0; game.warpTo('forest');
    UI.update(game);
    const txt = document.getElementById('online-text').textContent;
    // restore
    Account.token = null; game._warpCd = 0; game.warpTo('hub');
    return { txt };
  });
  assert(!/GUEST|ผู้เยี่ยมชม/.test(badge.txt) && /SOLO|โซนเดี่ยว/i.test(badge.txt),
    'a signed-in player in a biome shows the solo-zone badge, not GUEST (' + badge.txt + ')');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL EQUIP-MENU / SOLO-BADGE TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
