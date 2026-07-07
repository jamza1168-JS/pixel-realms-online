/* ============================================================
 * sprites.js — Procedural pixel art
 * Sprites are defined as string grids; each char maps to a
 * palette color ('.' = transparent). Rendered once to offscreen
 * canvases, drawn scaled with crisp pixels.
 * ============================================================ */

function makeSprite(rows, palette) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = palette[ch] || '#f0f';
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

function flipSprite(sprite) {
  const c = document.createElement('canvas');
  c.width = sprite.width; c.height = sprite.height;
  const g = c.getContext('2d');
  g.translate(sprite.width, 0);
  g.scale(-1, 1);
  g.drawImage(sprite, 0, 0);
  return c;
}

/* ---------- Hero templates (16x16) ---------- */
/* o outline, h hair/hat, s skin, e eye, c cloth, d cloth dark, m metal/trim, w weapon */

const HERO_ARMORED = [
  '................',
  '.....oooo.......',
  '....ohhhho......',
  '....ohhhho......',
  '....osssso...w..',
  '....osesso...w..',
  '.....osso....w..',
  '....occcco..ww..',
  '...ocmccmco.w...',
  '...sccccccs.....',
  '...occddcco.....',
  '....ocddco......',
  '....occcco......',
  '....odooda......',
  '....od..do......',
  '....oo..oo......',
];

const HERO_ROBED = [
  '................',
  '......hh........',
  '....hhhhhh......',
  '...hhhhhhhh.....',
  '....osssso...w..',
  '....osesso...w..',
  '.....osso....w..',
  '....occcco..ww..',
  '...occmmcco.w...',
  '...sccmmccs.....',
  '...occccccco....',
  '...odcccccdo....',
  '...odcccccdo....',
  '...oddddddo.....',
  '....oddddo......',
  '....oooooo......',
];

const HERO_PALETTES = {
  warrior: { o:'#1a1210', h:'#8a4a2a', s:'#f0c090', e:'#201818', c:'#b03a3a', d:'#702020', m:'#d8d8e0', w:'#c0c8d8', a:'#1a1210' },
  mage:    { o:'#161226', h:'#4a3aa0', s:'#f0c090', e:'#201830', c:'#3a55b0', d:'#243070', m:'#ffd75e', w:'#8a5a2a' },
  archer:  { o:'#12180f', h:'#3a7a2a', s:'#e8b888', e:'#182010', c:'#4a8a3a', d:'#2a5520', m:'#8a5a2a', w:'#8a5a2a', a:'#12180f' },
  cleric:  { o:'#1c1a14', h:'#e8e2d0', s:'#f0c090', e:'#282018', c:'#e8e2d0', d:'#b0a888', m:'#ffd75e', w:'#ffd75e' },
};
HERO_PALETTES.warrior.a = HERO_PALETTES.warrior.o;
HERO_PALETTES.archer.a = HERO_PALETTES.archer.o;
HERO_PALETTES.mage.a = HERO_PALETTES.mage.o;
HERO_PALETTES.cleric.a = HERO_PALETTES.cleric.o;

const HERO_TEMPLATES = { warrior: HERO_ARMORED, archer: HERO_ARMORED, mage: HERO_ROBED, cleric: HERO_ROBED };

/* ---------- Enemies ---------- */

const SPRITE_DEFS = {
  slime: {
    rows: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '.....bbbbb......',
      '....bgggggb.....',
      '...bggggggga....',
      '..bgg.gg.ggga...',
      '..bgg.gg.ggga...',
      '..bggggggggga...',
      '..bggwwwwggga...',
      '..bggggggggga...',
      '...bggggggaa....',
      '....baaaaaa.....',
      '................',
    ],
    palette: { b:'#1d4a24', g:'#5ec96a', a:'#2e7a3a', w:'#c8ffd0', '.':null },
  },
  goblin: {
    rows: [
      '................',
      '................',
      '..o.........o...',
      '.ogo.......ogo..',
      '..ogggggggggo...',
      '..ogggggggggo...',
      '..og.ggggg.go...',
      '..ogggg.ggggo...',
      '...oggggggo.w...',
      '....occcco..w...',
      '...occcccco.w...',
      '...g.cccc.g.w...',
      '....occcco.ww...',
      '....og..go......',
      '....og..go......',
      '....oo..oo......',
    ],
    palette: { o:'#12180f', g:'#6a9a3a', c:'#7a5530', w:'#c0c8d8', '.':null },
  },
  wolf: {
    rows: [
      '................',
      '................',
      '................',
      '..oo............',
      '..ogo......oo...',
      '..oggo....ogo...',
      '..ogggooooggo...',
      '..oggggggggggo..',
      '...ow.gggggggo..',
      '...ogggggggggo..',
      '....ogggggggo...',
      '....og.ogg.go...',
      '....og.ogg.go...',
      '....oo.oo..oo...',
      '................',
      '................',
    ],
    palette: { o:'#16161c', g:'#8a8a9a', w:'#e04040', '.':null },
  },
  bat: {
    rows: [
      '................',
      '................',
      '................',
      '.pp..........pp.',
      '.ppp........ppp.',
      '.pppp..pp..pppp.',
      '.pppppppppppppp.',
      '..ppppddddpppp..',
      '...ppdddddddp...',
      '....dd.dd.dd....',
      '....ddddddd.....',
      '.....d...d......',
      '................',
      '................',
      '................',
      '................',
    ],
    palette: { p:'#5a3a8a', d:'#8a5ec9', '.':null },
  },
  skeleton: {
    rows: [
      '................',
      '.....oooo.......',
      '....owwwwo......',
      '....owwwwo......',
      '....ow.w.o......',
      '....owwwwo..w...',
      '.....o..o...w...',
      '....owwwwo..w...',
      '...owwwwwwo.w...',
      '...w.wwww.w.w...',
      '....owwwwo.ww...',
      '.....owwo.......',
      '....owwwwo......',
      '....ow..wo......',
      '....ow..wo......',
      '....oo..oo......',
    ],
    palette: { o:'#1a1a20', w:'#e8e8e0', '.':null },
  },
  demon: {
    rows: [
      '.h............h.',
      '.hh..........hh.',
      '.rhh........hhr.',
      '..rrhh....hhrr..',
      '...rrrrrrrrrr...',
      '...rrrrrrrrrr...',
      '...rr.rrrr.rr...',
      '...rryrrrryrr...',
      '...rrrrrrrrrr...',
      '....rrdddddr....',
      '...rrdddddddrr..',
      '..rr.ddddddd.rr.',
      '..r..ddddddd..r.',
      '.....dd..dd.....',
      '.....dd..dd.....',
      '.....hh..hh.....',
    ],
    palette: { r:'#b02030', d:'#701018', y:'#ffd75e', h:'#2a1a1a', '.':null },
  },
  /* ---------- World objects ---------- */
  tree: {
    rows: [
      '.....gggggg.....',
      '...gggggggggg...',
      '..gggGGggGGggg..',
      '.ggGGggggggGGgg.',
      '.gggggGGggggggg.',
      '.ggGGggggGGggg..',
      '..ggggGGgggggg..',
      '...gggggggggg...',
      '....gggggggg....',
      '......tttt......',
      '......tttt......',
      '......tTtt......',
      '.....ttttt......',
      '.....tttttt.....',
      '....tttttttt....',
      '................',
    ],
    palette: { g:'#1d5426', G:'#54b464', t:'#5a3a1e', T:'#7a5a30', '.':null },
  },
  deadTree: {
    rows: [
      '................',
      '..t.........t...',
      '..tt...t...tt...',
      '...tt..t..tt....',
      '....tt.t.tt.....',
      '.....ttttt......',
      '......ttt.......',
      '......ttt.......',
      '.....tttt.......',
      '......ttt.......',
      '......ttt.......',
      '.....ttttt......',
      '....ttt.ttt.....',
      '....tt...tt.....',
      '...ttt...ttt....',
      '................',
    ],
    palette: { t:'#4a3a30', '.':null },
  },
  rock: {
    rows: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '......rrrr......',
      '....rrRRRrrr....',
      '...rrRRRRRrrr...',
      '..rrRRRRRRrrrr..',
      '..rRRRRRRRRrrr..',
      '..rrrRRRRrrrrr..',
      '..rrrrrrrrrrrr..',
      '...dddddddddd...',
      '................',
      '................',
      '................',
    ],
    palette: { r:'#7a7a8a', R:'#9a9aac', d:'#4a4a58', '.':null },
  },
  heart: {
    rows: [
      '........',
      '.rr..rr.',
      'rrrrrrrr',
      'rrRrrrrr',
      'rrrrrrrr',
      '.rrrrrr.',
      '..rrrr..',
      '...rr...',
    ],
    palette: { r:'#e8484f', R:'#ff9aa0', '.':null },
  },
  orb: {
    rows: [
      '........',
      '..bbbb..',
      '.bbBBbb.',
      '.bBBBbb.',
      '.bbBbbb.',
      '.bbbbbb.',
      '..bbbb..',
      '........',
    ],
    palette: { b:'#3d8bff', B:'#a0ccff', '.':null },
  },
  coin: {
    rows: [
      '........',
      '..gggg..',
      '.gGGGGg.',
      '.gGggGg.',
      '.gGggGg.',
      '.gGGGGg.',
      '..gggg..',
      '........',
    ],
    palette: { g:'#b8862a', G:'#ffd75e', '.':null },
  },
};

/* Sprite cache: SPRITES.slime, SPRITES.slime_f (flipped), heroes per class */
const SPRITES = {};

function buildSprites() {
  for (const key in SPRITE_DEFS) {
    const d = SPRITE_DEFS[key];
    SPRITES[key] = makeSprite(d.rows, d.palette);
    SPRITES[key + '_f'] = flipSprite(SPRITES[key]);
  }
  for (const cls in HERO_PALETTES) {
    SPRITES['hero_' + cls] = makeSprite(HERO_TEMPLATES[cls], HERO_PALETTES[cls]);
    SPRITES['hero_' + cls + '_f'] = flipSprite(SPRITES['hero_' + cls]);
  }
}
buildSprites();
