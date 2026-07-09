/* Browser test: landing legal notices (PDPA + dev-phase) and the in-game
 * announcements window (server-fed, scrollable, toggle open/hide). Server
 * on 8900. Run: PW_CHROMIUM=/path node news_test.js */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';
const exe = process.env.PW_CHROMIUM || undefined;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('PASS: ' + m); }

(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const p = await b.newPage({ viewport: { width: 1000, height: 720 } });
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(URL);
  await p.waitForFunction(() => typeof UI !== 'undefined' && typeof showTitleStep === 'function');

  // 1. landing shows the PDPA + dev-phase notices
  const notices = await p.evaluate(() => {
    const dev = document.querySelector('.title-notices .notice.dev');
    const pdpa = document.querySelector('.title-notices .notice:not(.dev)');
    return { dev: dev ? dev.textContent : '', pdpa: pdpa ? pdpa.textContent : '' };
  });
  assert(/reset|develop/i.test(notices.dev), 'dev-phase notice shown: "' + notices.dev + '"');
  assert(/third part|save your progress|improve the game/i.test(notices.pdpa), 'PDPA notice shown: "' + notices.pdpa + '"');

  // 2. announcements: open via the HUD button, content comes from the server
  await p.evaluate(() => startGame('warrior', null));
  await p.waitForFunction(() => typeof game !== 'undefined' && game.running, null, { timeout: 5000 });
  assert(await p.evaluate(() => document.getElementById('news-panel').classList.contains('hidden')),
    'announcements window starts hidden');
  await p.click('#btn-news');
  await p.waitForFunction(() => document.querySelectorAll('#news-content .news-item').length > 0, null, { timeout: 5000 });
  const info = await p.evaluate(() => {
    const items = [...document.querySelectorAll('#news-content .news-item')];
    const box = document.getElementById('news-content');
    return {
      count: items.length,
      hasTitle: !!items[0].querySelector('.news-item-title').textContent,
      hasDate: /\d{4}-\d{2}-\d{2}/.test(items[0].querySelector('.news-date').textContent),
      scrollable: getComputedStyle(box).overflowY === 'auto',
    };
  });
  assert(info.count >= 3 && info.hasTitle && info.hasDate, 'announcements render from the server (' + info.count + ' items)');
  assert(info.scrollable, 'announcements content is scrollable');

  // 3. the same button hides it again (toggle), and re-opens
  await p.click('#btn-news');
  assert(await p.evaluate(() => document.getElementById('news-panel').classList.contains('hidden')),
    'the button toggles the window hidden');
  await p.click('#btn-news');
  assert(await p.evaluate(() => !document.getElementById('news-panel').classList.contains('hidden')),
    'the button re-opens the window');
  // Close button also hides it
  await p.click('#btn-news-close');
  assert(await p.evaluate(() => document.getElementById('news-panel').classList.contains('hidden')),
    'Close hides the window');

  // 4. Thai localisation is used when the language is Thai
  await p.evaluate(() => setLang('th'));
  await p.click('#btn-news');
  await p.waitForFunction(() => document.querySelectorAll('#news-content .news-item').length > 0, null, { timeout: 5000 });
  const thTitle = await p.evaluate(() => document.querySelector('#news-content .news-item-title').textContent);
  assert(/[฀-๿]/.test(thTitle), 'announcements localise to Thai: "' + thTitle + '"');

  assert(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await b.close();
  console.log('\nALL NEWS/NOTICE TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
