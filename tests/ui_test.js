/* Real-mouse-click tests: stat + buttons, recommend/reset, sound panel, trade text. */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const P = await browser.newPage();
  P.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await P.goto(URL);
  await P.evaluate(() => startGame('warrior', null));
  await P.evaluate(() => { game.players[0].gainXp(5000); });   // earn stat points

  // --- open stat panel via real click on the ＋Stats button ---
  await P.click('#btn-stats');
  await P.waitForSelector('#stat-panel:not(.hidden)');

  // --- REAL mouse click on a + button (fails if panel rebuilds per frame) ---
  const before = await P.evaluate(() => ({
    pts: game.players[0].statPoints, str: game.players[0].stats.str,
  }));
  await P.click('#sp-stats .sp-row:first-child .sp-plus');
  await P.waitForTimeout(200);
  const after = await P.evaluate(() => ({
    pts: game.players[0].statPoints, str: game.players[0].stats.str,
  }));
  if (after.pts !== before.pts - 1 || after.str !== before.str + 1) {
    throw new Error('FAIL + button real click: ' + JSON.stringify({ before, after }));
  }
  console.log('PASS + button works with a real mouse click');

  // click it 3 more times rapidly — every click must land
  const p0 = after.pts;
  for (let i = 0; i < 3; i++) await P.click('#sp-stats .sp-row:first-child .sp-plus');
  await P.waitForTimeout(200);
  const p3 = await P.evaluate(() => game.players[0].statPoints);
  if (p3 !== p0 - 3) throw new Error('FAIL rapid clicks: expected ' + (p0 - 3) + ' got ' + p3);
  console.log('PASS rapid + clicks all register');

  // --- recommend & reset via real clicks ---
  await P.click('#btn-sp-recommend');
  await P.waitForTimeout(100);
  const rec = await P.evaluate(() => game.players[0].statPoints);
  if (rec !== 0) throw new Error('FAIL recommend real click: ' + rec);
  await P.click('#btn-sp-reset');
  await P.waitForTimeout(100);
  const rst = await P.evaluate(() => ({
    pts: game.players[0].statPoints,
    base: JSON.stringify(game.players[0].stats) === JSON.stringify(game.players[0].cls.base),
  }));
  if (!rst.base || rst.pts !== (await P.evaluate(() => (game.players[0].level - 1) * 5))) {
    throw new Error('FAIL reset real click: ' + JSON.stringify(rst));
  }
  console.log('PASS recommend/reset buttons work with real clicks');
  await P.click('#btn-sp-close');

  // --- sound panel ---
  await P.click('#btn-sound');
  await P.waitForSelector('#sound-panel:not(.hidden)');
  // lower volume via keyboard on the range input (real interaction)
  await P.focus('#sound-vol');
  for (let i = 0; i < 4; i++) await P.keyboard.press('ArrowLeft');   // -20%
  const vol = await P.evaluate(() => ({
    v: SOUND.vol, label: document.getElementById('sound-vol-num').textContent,
    stored: JSON.parse(localStorage.getItem('pixelrealms_sound')).vol,
  }));
  if (Math.round(vol.v * 100) !== 80 || vol.label !== '80%' || vol.stored !== vol.v) {
    throw new Error('FAIL volume slider: ' + JSON.stringify(vol));
  }
  console.log('PASS volume slider updates SOUND, label, and localStorage');

  await P.click('#btn-sound-mute');
  const muted = await P.evaluate(() => ({
    m: SOUND.muted, icon: document.getElementById('btn-sound').textContent,
    stored: JSON.parse(localStorage.getItem('pixelrealms_sound')).muted,
  }));
  if (!muted.m || muted.icon !== '🔇' || !muted.stored) throw new Error('FAIL mute: ' + JSON.stringify(muted));
  // beep must be a no-op while muted (no exception, no oscillator)
  await P.evaluate(() => beep(440, 0.05));
  await P.click('#btn-sound-mute');
  const un = await P.evaluate(() => ({ m: SOUND.muted, icon: document.getElementById('btn-sound').textContent }));
  if (un.m || un.icon !== '🔊') throw new Error('FAIL unmute: ' + JSON.stringify(un));
  console.log('PASS mute toggle + persisted, HUD icon follows');
  await P.click('#btn-sound-close');

  // --- persistence across reload ---
  await P.evaluate(() => { SOUND.vol = 0.8; saveSound(); });
  await P.reload();
  const reloaded = await P.evaluate(() => SOUND.vol);
  if (reloaded !== 0.8) throw new Error('FAIL sound persistence: ' + reloaded);
  console.log('PASS sound settings survive reload');

  // --- trade button wording ---
  const words = await P.evaluate(() => ({ en: t('trade.lock'), locked: t('trade.locked') }));
  if (!words.en.includes('Confirm') || !words.locked.includes('Confirmed')) {
    throw new Error('FAIL trade wording: ' + JSON.stringify(words));
  }
  console.log('PASS trade button says Confirm trade / Confirmed — waiting');

  await browser.close();
  console.log('ALL UI TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
