/* Browser test: account panel + cloud character save/load. Server on 8900.
 * Run: PW_CHROMIUM=/path node account_ui_test.js */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';
const exe = process.env.PW_CHROMIUM || undefined;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('PASS: ' + m); }
const USER = 'Cloud' + Math.floor(1000 + Math.random() * 8999);

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 900, height: 680 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForFunction(() => typeof Account !== 'undefined');

  // 1. register through the account panel (title screen)
  await page.click('#btn-landing-login');
  await page.waitForSelector('#account-panel:not(.hidden)', { timeout: 3000 });
  await page.fill('#acct-user', USER);
  await page.fill('#acct-pass', 'secret123');
  await page.click('#account-content .pix-btn:has-text("Create account")');
  await page.waitForFunction(() => Account.loggedIn, null, { timeout: 5000 });
  assert(await page.evaluate(() => Account.loggedIn && Account.username), 'registered + signed in via the panel');
  const titleStatus = await page.textContent('#account-title-status');
  assert(/Signed in as/.test(titleStatus), 'title screen shows signed-in status');
  await page.click('#btn-account-close');

  // 2. start a game and progress it; cloud save should receive it
  await page.evaluate(() => startGame('mage', null));
  await page.waitForFunction(() => game && game.running, null, { timeout: 5000 });
  await page.waitForTimeout(2300);  // startGame auto-saves; wait past the 2s write rate-limit
  await page.evaluate(() => {
    const p = game.players[0];
    p.level = 8; p.gold = 777;
    p.addItem(rollItem({ kind: 'weapon', tier: 'legend', ilvl: 15 }));
    game.save(true);   // force a cloud push
  });
  await page.waitForTimeout(500);   // let the POST land
  const saved = await page.evaluate(async () => {
    const r = await fetch('/api/character', { headers: { Authorization: 'Bearer ' + Account.token } });
    return (await r.json()).character;
  });
  assert(saved && saved.players[0].level === 8 && saved.players[0].gold === 777, 'character synced to the server');

  // 3. log out, then reload — should be signed out and cloud char cleared locally
  await page.evaluate(() => Account.logout());
  await page.reload();
  await page.waitForFunction(() => typeof Account !== 'undefined');
  assert(await page.evaluate(() => !Account.loggedIn), 'logged out persists across reload');

  // 4. log back in → Continue should load the CLOUD character (level 22)
  await page.click('#btn-landing-login');
  await page.waitForSelector('#account-panel:not(.hidden)', { timeout: 3000 });
  await page.fill('#acct-user', USER);
  await page.fill('#acct-pass', 'secret123');
  await page.click('#account-content .pix-btn:has-text("Log in")');
  await page.waitForFunction(() => Account.loggedIn && Account.character, null, { timeout: 5000 });
  assert(await page.evaluate(() => Account.character.players[0].level === 8), 'login pulled the cloud character');
  await page.click('#btn-account-close');
  await page.waitForFunction(() => !document.getElementById('btn-continue').classList.contains('hidden'), null, { timeout: 3000 });
  assert(true, 'Continue button appears after cloud character loads');
  await page.click('#btn-continue');
  await page.waitForFunction(() => game && game.running, null, { timeout: 5000 });
  const loaded = await page.evaluate(() => ({ level: game.players[0].level, gold: game.players[0].gold, cls: game.players[0].clsId }));
  assert(loaded.level === 8 && loaded.gold === 777 && loaded.cls === 'mage', 'Continue restored the exact cloud character');

  // 5. wrong password rejected in the panel
  await page.evaluate(() => Account.logout());
  await page.reload();
  await page.waitForFunction(() => typeof Account !== 'undefined');
  await page.click('#btn-landing-login');
  await page.waitForSelector('#account-panel:not(.hidden)', { timeout: 3000 });
  await page.fill('#acct-user', USER);
  await page.fill('#acct-pass', 'WRONGpass');
  await page.click('#account-content .pix-btn:has-text("Log in")');
  await page.waitForFunction(() => /Wrong username or password/.test(document.getElementById('account-msg').textContent), null, { timeout: 5000 });
  assert(!(await page.evaluate(() => Account.loggedIn)), 'wrong password rejected in the UI');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL ACCOUNT-UI TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
