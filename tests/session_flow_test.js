/* Browser test: the renewed session model. Guests play locally with
 * sessionStorage (no persistence, no manual online UI); signing in
 * auto-joins the shared public World. Server on 8900.
 * Run: PW_CHROMIUM=/path node session_flow_test.js */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';
const exe = process.env.PW_CHROMIUM || undefined;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('PASS: ' + m); }
const USER = 'Auto' + Math.floor(1000 + Math.random() * 8999);

async function bootGuest(page, name) {
  await page.addInitScript(n => localStorage.setItem('pixelrealms_name', n), name);
  await page.goto(URL);
  await page.evaluate(() => startGame('warrior', null));
  await page.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });
}

(async () => {
  const browser = await chromium.launch({ executablePath: exe });

  // 1. the old manual online UI is gone entirely
  const A = await browser.newPage();
  await bootGuest(A, 'Alice');
  const gone = await A.evaluate(() => ({
    btn: !!document.getElementById('btn-online'),
    panel: !!document.getElementById('online-panel'),
  }));
  assert(!gone.btn && !gone.panel, 'online panel + 🌐 button removed');

  // 2. a guest is offline and never persists to localStorage
  const guest = await A.evaluate(() => {
    game.save(true);
    return {
      online: game.net.isOnline,
      session: !!sessionStorage.getItem('pixelrealms_save'),
      local: !!localStorage.getItem('pixelrealms_save'),
      badge: document.getElementById('online-text').textContent,
    };
  });
  assert(!guest.online, 'guest session is not online');
  assert(guest.session && !guest.local, 'guest save lives in sessionStorage, not localStorage');
  assert(/GUEST/i.test(guest.badge), 'HUD badge marks a guest session');

  // 3. reaching multiplayer always drops into the shared public World
  await A.evaluate(() => game.goOnline('Alice'));
  await A.waitForFunction(() => game.net.isOnline, null, { timeout: 5000 });
  const pub = await A.evaluate(() => ({ public: game.net.public, ch: game.net.channel, label: game.net.roomLabel }));
  assert(pub.public && pub.ch === 1 && /Ch 1/.test(pub.label), 'lands in the public World · Ch 1: ' + JSON.stringify(pub));

  // 4. signing in auto-joins the public World with no manual step
  const B = await browser.newPage();
  await B.goto(URL);
  await B.waitForFunction(() => typeof Account !== 'undefined');
  await B.evaluate(u => Account.register(u, 'secret123'), USER);
  await B.waitForFunction(() => Account.loggedIn, null, { timeout: 5000 });
  // claim a public hero name (separate from the private username)
  const HERO = 'Bob' + Math.floor(1000 + Math.random() * 8999);
  await B.evaluate(h => Account.claimHeroName(h), HERO);
  await B.waitForFunction(h => Account.heroName === h, HERO, { timeout: 5000 });
  await B.evaluate(() => startGame('mage', null));
  await B.waitForFunction(() => game && game.net && game.net.isOnline, null, { timeout: 6000 });
  const auto = await B.evaluate(u => ({ online: game.net.isOnline, name: game.net.name, ch: game.net.channel, using: u, hero: Account.heroName }), USER);
  assert(auto.online && auto.name === auto.hero && auto.name !== auto.using, 'login → auto-connects with the hero name, not the username');
  assert(auto.ch === 1, 'auto-join lands in the same public channel');

  // 5. guest and signed-in player share the world and see each other
  await A.waitForFunction(() => game.remotePlayers.size >= 1, null, { timeout: 5000 });
  await B.waitForFunction(() => game.remotePlayers.size >= 1, null, { timeout: 5000 });
  assert(true, 'guest and signed-in player are together in the public World');

  await browser.close();
  console.log('\nALL SESSION-FLOW TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
