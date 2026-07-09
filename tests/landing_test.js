/* Browser test: the two-step title screen (log-in / guest → class select),
 * language switching from the first page, and live account-username
 * availability checking. Server on 8900.
 * Run: PW_CHROMIUM=/path node landing_test.js */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';
const exe = process.env.PW_CHROMIUM || undefined;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('PASS: ' + m); }
const USER = 'Land' + Math.floor(1000 + Math.random() * 8999);

(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const p = await b.newPage({ viewport: { width: 1000, height: 720 } });
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(URL);
  await p.waitForFunction(() => typeof UI !== 'undefined' && typeof showTitleStep === 'function');

  // 1. landing (log in / guest) is shown before the class picker
  let s = await p.evaluate(() => ({
    landing: !document.getElementById('title-landing').classList.contains('hidden'),
    selectHidden: document.getElementById('title-select').classList.contains('hidden'),
    login: !!document.getElementById('btn-landing-login'),
    guest: !!document.getElementById('btn-landing-guest'),
  }));
  assert(s.landing && s.selectHidden && s.login && s.guest, 'landing (login/guest) shows before class select');

  // Account button is not on the first page (Log in / Register covers it)
  assert(await p.evaluate(() => document.getElementById('btn-account-title').classList.contains('hidden')),
    'Account button is hidden on the landing page');

  // 2. subtitle no longer says "co-op"
  const sub = await p.evaluate(() => document.querySelector('.subtitle').textContent);
  assert(!/co-?op/i.test(sub), 'subtitle drops co-op: "' + sub + '"');

  // 3. language switch is available from the first page
  await p.click('.lang-choice[data-lang="th"]');
  const thSub = await p.evaluate(() => document.querySelector('.subtitle').textContent);
  assert(/[฀-๿]/.test(thSub), 'language switches from the landing page');
  await p.click('.lang-choice[data-lang="en"]');

  // 4. Play as Guest reveals the class picker; Back returns to landing
  await p.click('#btn-landing-guest');
  s = await p.evaluate(() => ({
    landingHidden: document.getElementById('title-landing').classList.contains('hidden'),
    select: !document.getElementById('title-select').classList.contains('hidden'),
  }));
  assert(s.landingHidden && s.select, 'Play as Guest reveals the class picker');
  await p.click('#btn-title-back');
  assert(await p.evaluate(() => !document.getElementById('title-landing').classList.contains('hidden')),
    'Back returns to the landing step');

  // 5. guest can pick a class and start a local (offline) game
  await p.click('#btn-landing-guest');
  await p.click('#class-grid .class-card');
  await p.click('#btn-start');
  await p.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });
  assert(await p.evaluate(() => game.running && !game.net.isOnline), 'guest start runs a local game');

  // 6. live username check: register a name, then confirm it reads as taken
  await p.reload();
  await p.waitForFunction(() => typeof UI !== 'undefined' && typeof showTitleStep === 'function');
  await p.click('#btn-landing-login');
  await p.waitForSelector('#account-panel:not(.hidden)', { timeout: 3000 });
  await p.fill('#acct-user', USER);
  await p.fill('#acct-pass', 'secret123');
  await p.click('#account-content .pix-btn:has-text("Create account")');
  await p.waitForFunction(() => Account.loggedIn, null, { timeout: 5000 });
  assert(await p.evaluate(() => !document.getElementById('title-select').classList.contains('hidden')),
    'signing in advances to the class picker');
  await p.evaluate(() => Account.logout());
  await p.reload();
  await p.waitForFunction(() => typeof UI !== 'undefined');
  await p.click('#btn-landing-login');
  await p.waitForSelector('#account-panel:not(.hidden)', { timeout: 3000 });
  await p.fill('#acct-user', USER);
  await p.waitForFunction(() => UI._userOk === false, null, { timeout: 5000 });
  assert(await p.evaluate(() => /taken/i.test(document.getElementById('acct-user-check').textContent)),
    'live check flags a duplicate username as taken');
  await p.fill('#acct-user', 'Free' + Date.now().toString(36).slice(-6));
  await p.waitForFunction(() => UI._userOk === true, null, { timeout: 5000 });
  assert(true, 'live check reports a fresh username as available');

  assert(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await b.close();
  console.log('\nALL LANDING TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
