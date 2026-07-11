/* M0 — tip jar + server-cost meter (docs/MONETIZATION.md). Server on 8900.
 * Run: PW_CHROMIUM=/path node support_test.js */
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

  await page.goto(URL);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.supportHtml);

  // 1. /api/support returns the published fields with numeric coercion
  const api = await page.evaluate(async () => {
    const r = await fetch('/api/support'); return r.json();
  });
  assert(typeof api.billUsd === 'number' && 'link' in api && 'raisedUsd' in api,
    'GET /api/support returns link + numeric bill/raised');

  // 2. supportHtml renders the free message + a meter when a bill is set;
  //    a real https link becomes a button, an empty/js link does not
  const render = await page.evaluate(() => {
    const withLink = UI.supportHtml({ link: 'https://ko-fi.com/example', linkLabel: 'Tip', month: 'July 2026', billUsd: 20, raisedUsd: 5 });
    const noLink   = UI.supportHtml({ link: '', month: 'July 2026', billUsd: 20, raisedUsd: 5 });
    const evil     = UI.supportHtml({ link: 'javascript:alert(1)', billUsd: 0, raisedUsd: 0 });
    return { withLink, noLink, evil };
  });
  assert(/support-msg/.test(render.withLink) && /support-fill/.test(render.withLink), 'renders the free message + cost meter');
  assert(/25%/.test(render.withLink) || /width:25%/.test(render.withLink), 'meter reflects covered % (5/20 = 25%)');
  assert(/href="https:\/\/ko-fi\.com\/example"/.test(render.withLink) && /rel="noopener/.test(render.withLink), 'a real https link becomes a safe support button');
  assert(!/<a /.test(render.noLink), 'no button when the link is empty (just the transparent message + meter)');
  assert(!/javascript:/.test(render.evil) && !/<a /.test(render.evil), 'a non-http link is refused (no button, no js: URL)');

  // 3. the title landing has a support slot that gets populated
  const onTitle = await page.evaluate(() => {
    UI._support = { link: '', month: 'July 2026', billUsd: 14, raisedUsd: 0 };
    UI.renderSupport();
    const el = document.getElementById('title-support');
    return { present: !!el, filled: el && /support-box/.test(el.innerHTML) };
  });
  assert(onTitle.present && onTitle.filled, 'the title landing shows the support block');

  assert(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('\nALL SUPPORT (M0) TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
