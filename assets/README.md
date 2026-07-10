# assets/ — drop-in pixel art (spritesheets)

This folder is where reference-style **PNG spritesheets** go. It is empty of art
today: the game runs entirely on procedural sprites (`js/sprites.js`) and will
**fall back to those** until real art is added here.

## How it will work (see `docs/ART_REDESIGN.md`)

- One PNG per sprite key: `assets/<key>.png` (e.g. `hero_warrior.png`,
  `slime.png`, `orc.png`, `dragon.png`, `portal.png`, tilesheets…).
- An optional sibling `assets/<key>.json` describing frames/animations:
  ```json
  { "frameW": 32, "frameH": 32, "anims": { "idle": [0, 1], "walk": [2, 3, 4, 5] } }
  ```
- On boot, the (planned) loader tries each PNG; if missing, it uses the
  procedural sprite. So partial art sets are fine — skin one sprite at a time.

## Spec (summary)

- Tiles 32×32; characters/mobs 32×32 per frame; bosses 64×64; world boss 96×96.
- Transparent background, crisp pixels (no anti-aliasing).
- idle 2f · walk 4f · attack 2–3f (optional). Side-facing + auto-flip to start.

The loader + animation code is not built yet — ask and it'll be added so these
files light up in-game.
