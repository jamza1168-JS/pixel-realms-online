# Asset inventory — for redesign

**Important:** the game ships **no image or audio files**. All art is either a
**procedural pixel grid** (drawn to a canvas from a text template + palette),
an **emoji** (icons), a **flat colour** (tiles/UI), or **synthesised sound**
(WebAudio). So "redesign" = editing these definitions in code (or introducing a
real image/audio pipeline, which doesn't exist yet).

---

## 1. Character sprites (heroes) — `js/sprites.js`
Built by `makeSprite(rows, palette)`; `_f` = auto x-flipped. Cached as
`SPRITES.hero_<class>` / `hero_<class>_f`.
- **Templates:** `HERO_ARMORED` (warrior, archer) and `HERO_ROBED` (mage, cleric)
  — ASCII-ish `rows` grids (`sprites.js:37` / `:56`).
- **Palettes:** `HERO_PALETTES` per class (`sprites.js:75`) — letter→colour maps
  (`o` outfit, `a` accent, skin, etc.).
- 4 classes: **warrior, mage, archer, cleric** (`js/data.js:39` for colour/stats).

## 2. Enemy sprites — `js/sprites.js` (`SPRITE_DEFS`) + `js/data.js` (`ENEMY_TYPES`)
Each is a `{rows, palette}` grid. Keys:
**slime, goblin, wolf, bat, skeleton, demon** (demon = boss "Demon Lord").
Stats/scale/ranged live in `ENEMY_TYPES` (`data.js:186`).

## 3. World props (sprites) — `js/sprites.js` (`SPRITE_DEFS`)
**tree, deadTree, rock, heart** (HP pickup), **orb** (MP pickup), **coin** (gold).

## 4. World tiles & scenery — `js/world.js` (drawn as flat colours, not sprites)
- Tile types: **grass, water, sand, path, ash** — colour triads at `world.js:173`
  (baked map) and minimap colours at `:215`.
- **Flowers** on grass (`:199`), **village hut** marker drawn with rects (`:206`).
- Constants: `TILE=32`, `MAP_W/MAP_H`, `WORLD_SEED`; difficulty rings via
  `tierAt()` (`:47`).

## 5. Item icons — emoji, `js/items.js`
- **Armour:** head 🪖 · chest 🛡️ · legs 👖 · boots 🥾 (`items.js:27`)
- **Weapons:** sword1h 🗡️ · sword2h ⚔️ · staff 🪄 · bow 🏹 (`:40`)
- **Potions:** hp 🧪 · mp 🔷 · spd 👟 · atk 💥 · aspd ⚡ · regen 💚 (`:49`)
- **Rarity tiers + colours** (`ITEM_TIERS`, `:13`): common `#c2c8d6` · rare
  `#4a9eff` · unique `#b45eff` · legend `#ff9a30` · mystic `#ff4d6d`.

## 6. Skill icons — emoji, `js/data.js` (`SKILLS`)
- Warrior: heavyslash 🗡️ · whirlwind 🌀 · warcry 💢
- Mage: fireball 🔥 · frostnova ❄️ · thunder ⚡
- Archer: powershot 🏹 · multishot 🎯 · swift 💨
- Cleric: smite ✨ · heal 💚 · sanctuary 🕊️

## 7. Projectiles & effects — procedural (`js/data.js`, `js/main.js`, `js/entities.js`)
- Projectiles = coloured circles: per-class `projColor`/`projSize` (`data.js:48+`).
- Effects drawn on canvas: `ring`, `aura`, village **heal circle**, floating
  damage/heal text, chat bubbles (search `addEffect` / `draw()` in `main.js`).

## 8. UI / HUD icons — emoji, `index.html` + `js/i18n.js`
Menu buttons: 👤 account · 🎒 inventory · 🛒 shop · 🤝 trade · 🏆 leaderboard ·
📢 announcements · 🗺 minimap · 🔊 sound · ❓/? help · ⌨ keys · 🤖 AFK · 🪙 gold.
Toast/label glyphs: 🟢 🔴 🎉 ⚠️ 🔒 🌍 ★ (in i18n strings, both EN/TH).

## 9. Sound — synthesised, no files (`js/main.js`)
`beep(freq, dur, type, vol, endFreq)` (`main.js:107`) + the `SFX` table (`:121`):
**hit, swing, shoot, hurt, skill, pickup, gold, heal, buff, point, die,
levelup**, plus a Legend/Mystic **drop fanfare**. Volume/mute persisted under
`pixelrealms_sound`. Gate every new sound through `beep()`.

## 10. Theme / typography — `css/style.css`
CSS variables (`style.css:1`): `--bg #0d0f1a`, `--panel #1a1e2e`,
`--panel-border #3d4466`, `--gold #ffd75e`, `--hp #e8484f`, `--mp #3d8bff`,
`--xp #b45eff`, `--green #5ec96a`, `--text #e8e8f0`, `--muted #9aa0b8`.
Font: **Press Start 2P** (Google Fonts, loaded in `index.html`).

---

## How to redesign each type
| Asset type | Where | To change |
|---|---|---|
| Hero / enemy / prop pixel art | `js/sprites.js` | edit `rows` grid + `palette` colours; `_f` auto-flips |
| Tile / map colours | `js/world.js` | edit the colour triads + minimap colours |
| Item / skill / UI icons | `js/items.js`, `js/data.js`, `index.html` | swap the emoji (or replace with `<img>`/sprite if you add a pipeline) |
| Rarity / theme colours | `js/items.js`, `css/style.css` | edit the hex values / CSS vars |
| Sounds | `js/main.js` | tune `beep(...)` params in `SFX` |

**No build step, no dependencies** — edit a file, hard-refresh. If you want to
move to real PNG/aseprite sprites or audio files, that pipeline would be new
work (a loader + asset folder); say the word and I can scaffold it.
