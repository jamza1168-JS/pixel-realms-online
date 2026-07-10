/* Browser test: the account flow spec — new account = Start-only, returning
 * account = Continue-only (no class pick), in-game logout returns to the
 * first title screen, and a guest hero name can't duplicate a registered
 * username. Server on 8900. Run: PW_CHROMIUM=/path node account_flow_test.js */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';
const exe = process.env.PW_CHROMIUM || undefined;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('PASS: ' + m); }
const USER = 'Flow' + Math.floor(1000 + Math.random() * 8999);

async function openLoginPanel(p) {
  await p.click('#btn-landing-login');
  await p.waitForSelector('#account-panel:not(.hidden)', { timeout: 3000 });
}

(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(URL);
  await p.waitForFunction(() => typeof showTitleStep === 'function');

  // 1. register a NEW account → class step shows Start-only (no Continue)
  await openLoginPanel(p);
  await p.fill('#acct-user', USER);
  await p.fill('#acct-pass', 'secret123');
  await p.click('#account-content .pix-btn:has-text("Create account")');
  await p.waitForFunction(() => Account.loggedIn, null, { timeout: 5000 });
  await p.waitForFunction(() => document.getElementById('account-panel').classList.contains('hidden'), null, { timeout: 3000 });
  const s1 = await p.evaluate(() => ({
    newchar: !document.getElementById('title-newchar').classList.contains('hidden'),
    cont: !document.getElementById('btn-continue').classList.contains('hidden'),
  }));
  assert(s1.newchar && !s1.cont, 'new account: new-character UI shown, no Continue');

  // 2. start + save a cloud character (wait past the server's 2s write limit)
  await p.evaluate(() => startGame('warrior', null));
  await p.waitForFunction(() => game && game.running, null, { timeout: 5000 });
  await p.waitForTimeout(2300);
  await p.evaluate(() => { game.players[0].level = 6; game.players[0].gold = 321; game.save(true); });
  await p.waitForTimeout(700);

  // 3. in-game account icon → Logout → back to the FIRST title screen
  await p.click('#btn-account');
  await p.waitForSelector('#account-panel:not(.hidden)', { timeout: 3000 });
  await p.click('#account-content .pix-btn:has-text("Log out")');
  await p.waitForFunction(() => !document.getElementById('title-screen').classList.contains('hidden'), null, { timeout: 3000 });
  const s3 = await p.evaluate(() => ({
    landing: !document.getElementById('title-landing').classList.contains('hidden'),
    hudHidden: document.getElementById('hud').classList.contains('hidden'),
    loggedOut: !Account.loggedIn,
  }));
  assert(s3.landing && s3.hudHidden && s3.loggedOut, 'in-game logout returns to the first start screen, signed out');

  // 4. log back in → Continue-only (no class selection)
  await openLoginPanel(p);
  await p.fill('#acct-user', USER);
  await p.fill('#acct-pass', 'secret123');
  await p.click('#account-content .pix-btn:has-text("Log in")');
  await p.waitForFunction(() => Account.loggedIn && Account.character, null, { timeout: 5000 });
  await p.waitForFunction(() => !document.getElementById('btn-continue').classList.contains('hidden'), null, { timeout: 3000 });
  const s4 = await p.evaluate(() => ({
    newcharHidden: document.getElementById('title-newchar').classList.contains('hidden'),
    cont: !document.getElementById('btn-continue').classList.contains('hidden'),
  }));
  assert(s4.newcharHidden && s4.cont, 'returning account: Continue-only, class selection hidden');
  const restored = await p.evaluate(() => { document.getElementById('btn-continue').click(); return true; });
  await p.waitForFunction(() => game && game.running, null, { timeout: 5000 });
  assert(await p.evaluate(() => game.players[0].level === 6 && game.players[0].gold === 321), 'Continue restored the saved character');

  // 5. guest hero name can't duplicate a registered username
  const g = await b.newPage();
  g.on('pageerror', e => errors.push(String(e)));
  await g.goto(URL);
  await g.waitForFunction(() => typeof showTitleStep === 'function');
  await g.click('#btn-landing-guest');
  await g.click('#class-grid .class-card');
  await g.fill('#hero-name', USER);
  await g.waitForFunction(() => UI._heroNameOk === false, null, { timeout: 5000 });
  assert(await g.evaluate(() => document.getElementById('btn-start').disabled),
    'guest name matching a registered username is rejected + Start disabled');
  await g.fill('#hero-name', 'Freebie' + Date.now().toString(36).slice(-4));
  await g.waitForFunction(() => UI._heroNameOk === true, null, { timeout: 5000 });
  assert(await g.evaluate(() => !document.getElementById('btn-start').disabled), 'a free guest name enables Start');

  assert(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await b.close();
  console.log('\nALL ACCOUNT-FLOW TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
