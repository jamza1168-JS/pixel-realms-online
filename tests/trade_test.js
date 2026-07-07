/* E2E: two browser clients, real relay. Verifies the trade accept-reset fix
 * and a full legitimate trade. Run: node trade_test.js */
const { chromium } = require('playwright');

const URL = 'http://127.0.0.1:8900';
const WS = 'ws://127.0.0.1:8900';

async function boot(page, name) {
  await page.goto(URL);
  await page.evaluate(() => startGame('warrior', null));
  await page.evaluate(ws => game.goOnline(ws, 'trade-room', window.__name), WS);
  await page.waitForFunction(() => game.net.isOnline, null, { timeout: 5000 });
}

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const A = await browser.newPage();
  const B = await browser.newPage();
  await A.addInitScript(() => { window.__name = 'Alice'; });
  await B.addInitScript(() => { window.__name = 'Bob'; });
  await boot(A, 'Alice');
  await boot(B, 'Bob');

  // wait until each sees the other
  await A.waitForFunction(() => game.remotePlayers.size === 1, null, { timeout: 5000 });
  await B.waitForFunction(() => game.remotePlayers.size === 1, null, { timeout: 5000 });
  console.log('PASS both clients connected and see each other');

  // starting gold
  await A.evaluate(() => { game.players[0].gold = 100; });
  await B.evaluate(() => { game.players[0].gold = 10; });

  // A requests trade with B
  const idB = await B.evaluate(() => game.net.id);
  await A.evaluate(k => game.openTradeWith(game.players[0], k, 'Bob'), idB + ':0');
  await B.waitForFunction(() => !!game.pendingTrade, null, { timeout: 5000 });
  await B.evaluate(() => game.answerTradeRequest(true));
  await A.waitForFunction(() => game.trade && game.trade.stage === 'open', null, { timeout: 5000 });
  console.log('PASS trade opened on both sides');

  // A offers 50; B locks accept
  await A.evaluate(() => game.setTradeGold(50));
  await B.waitForFunction(() => game.trade.theirGold === 50, null, { timeout: 5000 });
  await B.evaluate(() => game.toggleTradeAccept());
  await B.waitForFunction(() => game.trade.myAccept === true, null, { timeout: 5000 });

  // THE EXPLOIT: A silently drops the offer to 0 after B accepted
  await A.evaluate(() => game.setTradeGold(0));
  await B.waitForFunction(() => game.trade && game.trade.theirGold === 0, null, { timeout: 5000 });
  const bAccept = await B.evaluate(() => game.trade.myAccept);
  const aSeesB = await A.evaluate(() => game.trade.theirAccept);
  if (bAccept !== false) throw new Error('FAIL: B accept survived an offer change (scam possible)');
  if (aSeesB !== false) throw new Error('FAIL: A still thinks B accepted');
  console.log('PASS offer change resets both accept flags (exploit fixed)');

  // legitimate trade: A offers 30, B offers 5, both accept
  await A.evaluate(() => game.setTradeGold(30));
  await B.waitForFunction(() => game.trade.theirGold === 30, null, { timeout: 5000 });
  await B.evaluate(() => { game.setTradeGold(5); game.toggleTradeAccept(); });
  await A.waitForFunction(() => game.trade && game.trade.theirAccept === true, null, { timeout: 5000 });
  await A.evaluate(() => game.toggleTradeAccept());
  await A.waitForFunction(() => game.trade === null, null, { timeout: 5000 });
  await B.waitForFunction(() => game.trade === null, null, { timeout: 5000 });
  const goldA = await A.evaluate(() => game.players[0].gold);
  const goldB = await B.evaluate(() => game.players[0].gold);
  if (goldA !== 75) throw new Error('FAIL: A gold ' + goldA + ' (expected 100-30+5=75)');
  if (goldB !== 35) throw new Error('FAIL: B gold ' + goldB + ' (expected 10+30-5=35)');
  console.log('PASS legitimate trade completed, gold 75/35 correct');

  await browser.close();
  console.log('ALL TRADE TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
