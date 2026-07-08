/* Browser test: public World + private-room password join flow. Server on 8900.
 * Run: PW_CHROMIUM=/path node rooms_ui_test.js */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';
const WS = 'ws://127.0.0.1:8900';
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

  // 1. Public world join → lands in "World · Ch 1"
  const A = await browser.newPage();
  await boot(A, 'Alice');
  await A.evaluate(ws => game.goOnline(ws, '', 'Alice', '', true), WS);
  await A.waitForFunction(() => game.net.isOnline, null, { timeout: 5000 });
  const pub = await A.evaluate(() => ({ public: game.net.public, ch: game.net.channel, label: game.net.roomLabel }));
  assert(pub.public && pub.ch === 1 && /Ch 1/.test(pub.label), 'public world join → World · Ch 1: ' + JSON.stringify(pub));
  await A.evaluate(() => game.goOffline());
  await A.waitForFunction(() => !game.net.isOnline, null, { timeout: 5000 });

  // 2. Private room: owner creates with password
  await A.evaluate(ws => game.goOnline(ws, 'clubhouse', 'Alice', 's3cret', false), WS);
  await A.waitForFunction(() => game.net.isOnline, null, { timeout: 5000 });
  const priv = await A.evaluate(() => ({ public: game.net.public, label: game.net.roomLabel }));
  assert(!priv.public && priv.label === 'clubhouse', 'private room join shows the room name');

  // 3. Second player with WRONG password is rejected
  const B = await browser.newPage();
  await boot(B, 'Bob');
  await B.evaluate(ws => game.goOnline(ws, 'clubhouse', 'Bob', 'wrong', false), WS);
  await B.waitForFunction(() => game.net.joinError === 'wrongPass' || game.net.status === 'error', null, { timeout: 5000 });
  const wrong = await B.evaluate(() => ({ err: game.net.joinError, online: game.net.isOnline }));
  assert(wrong.err === 'wrongPass' && !wrong.online, 'wrong password is rejected');

  // 4. Same player with the RIGHT password gets in
  await B.evaluate(ws => game.goOnline(ws, 'clubhouse', 'Bob', 's3cret', false), WS);
  await B.waitForFunction(() => game.net.isOnline, null, { timeout: 5000 });
  const ok = await B.evaluate(() => game.net.isOnline && game.net.roomLabel === 'clubhouse');
  assert(ok, 'correct password joins the private room');

  // 5. Both are in the same room and can see each other
  await A.waitForFunction(() => game.remotePlayers.size === 1, null, { timeout: 5000 });
  await B.waitForFunction(() => game.remotePlayers.size === 1, null, { timeout: 5000 });
  assert(true, 'both players are together in the private room');

  // 6. UI: the panel exposes public + private buttons, and hides them once connected
  const ui = await A.evaluate(() => {
    UI.openOnlinePanel();
    const hasPublic = !!document.getElementById('btn-online-public');
    const hasPrivate = !!document.getElementById('btn-online-private');
    const hasPass = !!document.getElementById('online-pass');
    const areaHidden = document.getElementById('online-connect-area').classList.contains('hidden');
    const discShown = !document.getElementById('btn-online-disconnect').classList.contains('hidden');
    return { hasPublic, hasPrivate, hasPass, areaHidden, discShown };
  });
  assert(ui.hasPublic && ui.hasPrivate && ui.hasPass, 'online panel has public + private + password controls');
  assert(ui.areaHidden && ui.discShown, 'join controls hidden and Disconnect shown while connected');

  await browser.close();
  console.log('\nALL ROOMS-UI TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
