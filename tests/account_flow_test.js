/* Browser test: the account flow — username stays private, the player
 * creates a separate globally-unique hero name shown in-game; new account =
 * name+class+Start, returning = Continue-only, in-game logout → first title
 * screen, and a hero name can't duplicate another player's.
 * Server on 8900. Run: PW_CHROMIUM=/path node account_flow_test.js */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';
const exe = process.env.PW_CHROMIUM || undefined;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('PASS: ' + m); }
const R = Math.floor(1000 + Math.random() * 8999);
const USER = 'Flow' + R;     // private username
const HERO = 'Hiro' + R;     // public player name

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

  // 1. register a NEW account → name field + class + Start, no Continue
  await openLoginPanel(p);
  await p.fill('#acct-user', USER);
  await p.fill('#acct-pass', 'secret123');
  await p.click('#account-content .pix-btn:has-text("Create account")');
  await p.waitForFunction(() => Account.loggedIn, null, { timeout: 5000 });
  await p.waitForFunction(() => document.getElementById('account-panel').classList.contains('hidden'), null, { timeout: 3000 });
  const s1 = await p.evaluate(() => ({
    nameField: !document.getElementById('hero-name-row').classList.contains('hidden'),
    cont: !document.getElementById('btn-continue').classList.contains('hidden'),
    heroNameYet: Account.heroName,
  }));
  assert(s1.nameField && !s1.cont && !s1.heroNameYet, 'new signed-in account: name field shown, no Continue, no name yet');

  // 2. claim a unique hero name via Start → it becomes the in-game name
  await p.fill('#hero-name', HERO);
  await p.waitForFunction(() => UI._heroNameOk === true, null, { timeout: 5000 });
  await p.click('#class-grid .class-card');
  await p.click('#btn-start');
  await p.waitForFunction(() => game && game.running, null, { timeout: 6000 });
  const s2 = await p.evaluate(u => ({ shown: game.players[0].name, hero: Account.heroName, user: u }), USER);
  assert(s2.shown === HERO && s2.hero === HERO, 'in-game name is the claimed hero name');
  assert(s2.shown !== s2.user, 'in-game name is NOT the private username');

  // save a cloud character (past the 2s write limit)
  await p.waitForTimeout(2300);
  await p.evaluate(() => { game.players[0].level = 7; game.players[0].gold = 654; game.save(true); });
  await p.waitForTimeout(700);

  // 3. in-game logout → back to the FIRST title screen, signed out
  await p.click('#btn-account');
  await p.waitForSelector('#account-panel:not(.hidden)', { timeout: 3000 });
  await p.click('#account-content .pix-btn:has-text("Log out")');
  await p.waitForFunction(() => !document.getElementById('title-screen').classList.contains('hidden'), null, { timeout: 3000 });
  const s3 = await p.evaluate(() => ({
    landing: !document.getElementById('title-landing').classList.contains('hidden'),
    hudHidden: document.getElementById('hud').classList.contains('hidden'),
    out: !Account.loggedIn,
  }));
  assert(s3.landing && s3.hudHidden && s3.out, 'in-game logout returns to the first start screen, signed out');

  // 4. log back in → Continue-only, hero name restored, character restored
  await openLoginPanel(p);
  await p.fill('#acct-user', USER);
  await p.fill('#acct-pass', 'secret123');
  await p.click('#account-content .pix-btn:has-text("Log in")');
  await p.waitForFunction(() => Account.loggedIn && Account.character, null, { timeout: 5000 });
  await p.waitForFunction(() => !document.getElementById('btn-continue').classList.contains('hidden'), null, { timeout: 3000 });
  const s4 = await p.evaluate(() => ({
    newcharHidden: document.getElementById('title-newchar').classList.contains('hidden'),
    hero: Account.heroName,
  }));
  assert(s4.newcharHidden && s4.hero === HERO, 'returning account: Continue-only, hero name restored');
  await p.evaluate(() => document.getElementById('btn-continue').click());
  await p.waitForFunction(() => game && game.running, null, { timeout: 5000 });
  assert(await p.evaluate(() => game.players[0].level === 7 && game.players[0].gold === 654), 'Continue restored the saved character');

  // 5. another player can't take an already-claimed hero name
  const g = await b.newPage();
  g.on('pageerror', e => errors.push(String(e)));
  await g.goto(URL);
  await g.waitForFunction(() => typeof showTitleStep === 'function');
  await g.click('#btn-landing-guest');
  await g.click('#class-grid .class-card');
  await g.fill('#hero-name', HERO);
  await g.waitForFunction(() => UI._heroNameOk === false, null, { timeout: 5000 });
  assert(await g.evaluate(() => document.getElementById('btn-start').disabled),
    'a hero name already claimed by another player is rejected');
  await g.fill('#hero-name', 'Free' + R);
  await g.waitForFunction(() => UI._heroNameOk === true, null, { timeout: 5000 });
  assert(await g.evaluate(() => !document.getElementById('btn-start').disabled), 'a free hero name enables Start');

  assert(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await b.close();
  console.log('\nALL ACCOUNT-FLOW TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
