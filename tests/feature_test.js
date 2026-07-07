/* Feature tests: heal circle, AFK no-auto-spend, recommend + reset stat buttons. */
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8900';

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const P = await browser.newPage();
  P.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await P.goto(URL);
  await P.evaluate(() => startGame('warrior', null));

  // --- heal circle: hurt player standing at spawn must regain HP fast ---
  const healed = await P.evaluate(async () => {
    const p = game.players[0];
    p.x = game.world.spawnX; p.y = game.world.spawnY;   // inside circle
    p.hp = 10;
    const start = p.hp;
    await new Promise(r => setTimeout(r, 2000));
    return { start, end: p.hp, max: p.derived.maxHp };
  });
  // 10%/s for 2s ≈ 20% of maxHp (plus small natural regen)
  if (healed.end - healed.start < healed.max * 0.15) {
    throw new Error('FAIL heal circle: ' + JSON.stringify(healed));
  }
  console.log('PASS heal circle heals ~10%/s:', JSON.stringify(healed));

  // --- level up: gain stat points ---
  await P.evaluate(() => { game.players[0].gainXp(50000); });
  const lvl = await P.evaluate(() => ({ level: game.players[0].level, pts: game.players[0].statPoints }));
  if (lvl.pts !== (lvl.level - 1) * 5) throw new Error('FAIL points: ' + JSON.stringify(lvl));
  console.log('PASS leveled to', lvl.level, 'with', lvl.pts, 'points');

  // --- AFK must NOT auto-spend points ---
  const afk = await P.evaluate(async () => {
    const p = game.players[0];
    const before = p.statPoints;
    game.toggleAfk(p);
    await new Promise(r => setTimeout(r, 2000));
    game.toggleAfk(p);
    return { before, after: p.statPoints };
  });
  if (afk.after !== afk.before) throw new Error('FAIL AFK spent points: ' + JSON.stringify(afk));
  console.log('PASS AFK farming kept all', afk.after, 'stat points');

  // --- recommend button spends everything into class stats ---
  const rec = await P.evaluate(() => {
    const p = game.players[0];
    UI.openStatPanel(p);
    const baseSum = Object.values(p.cls.base).reduce((a, b) => a + b, 0);
    const pts = p.statPoints;
    document.getElementById('btn-sp-recommend').click();
    const sum = Object.values(p.stats).reduce((a, b) => a + b, 0);
    return { pts, baseSum, sum, left: p.statPoints,
             disabled: document.getElementById('btn-sp-recommend').disabled };
  });
  if (rec.left !== 0 || rec.sum !== rec.baseSum + rec.pts || !rec.disabled) {
    throw new Error('FAIL recommend: ' + JSON.stringify(rec));
  }
  console.log('PASS recommend button spent', rec.pts, 'points, button now disabled');

  // --- reset button refunds everything back to base ---
  const rst = await P.evaluate(() => {
    const p = game.players[0];
    document.getElementById('btn-sp-reset').click();
    return {
      statsMatchBase: JSON.stringify(p.stats) === JSON.stringify(p.cls.base),
      pts: p.statPoints, expected: (p.level - 1) * 5,
      hpOk: p.hp <= p.derived.maxHp, mpOk: p.mp <= p.derived.maxMp,
    };
  });
  if (!rst.statsMatchBase || rst.pts !== rst.expected || !rst.hpOk || !rst.mpOk) {
    throw new Error('FAIL reset: ' + JSON.stringify(rst));
  }
  console.log('PASS reset button refunded', rst.pts, 'points, stats back to base');

  // --- save/load roundtrip still works ---
  await P.evaluate(() => game.save());
  const saved = await P.evaluate(() => JSON.parse(localStorage.getItem('pixelrealms_save')).players[0]);
  if (saved.statPoints !== rst.pts) throw new Error('FAIL save: ' + JSON.stringify(saved));
  console.log('PASS save contains refunded points');

  await browser.close();
  console.log('ALL FEATURE TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
