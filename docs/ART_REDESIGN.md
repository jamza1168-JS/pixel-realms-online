# Art redesign plan — animated pixel art (reference-style)

Goal: move the game toward the look of the reference images (detailed top-down
RPG — forest/mountain/volcano/beach/village, framed buildings, animated
characters) like the two mockups shared.

> **STATUS (pipeline built):** Option A is live. `tools/art/generate.py`
> (Pillow) produces animated spritesheets → `assets/`; `js/assets.js` loads
> them via `assets/manifest.json` and `drawSprite()` animates with procedural
> fallback. Batch 1 = 4 animated heroes + the warp portal. See
> `tools/art/README.md` to regenerate/extend from any session or PC. Remaining
> sprites (mobs, bosses, tiles, buildings) are follow-up batches added the same
> way. Steps 1–2 below are now DONE.

## The honest constraint (read first)

The current game has **no art files** — every sprite is a small procedural
pixel grid (`js/sprites.js`) and tiles are flat colours (`js/world.js`). Code
**cannot synthesise** the hand-crafted detail in the reference images. To get
that look you need **real pixel-art files** (PNG spritesheets), produced by an
artist or an image tool, then loaded by the game.

So the redesign splits into two tracks:
1. **Art production** (make the PNGs to a fixed spec) — not a coding task.
2. **Engine work** (a loader + animation so those PNGs are used) — coding task,
   specced below and partly scaffolded.

## Target spec (produce art to THIS so it drops in cleanly)

- **Tile size:** 32×32 px (matches `TILE = 32`). Tilesheets as a grid of 32px cells.
- **Characters / mobs:** 32×32 px per frame (heroes/mobs render ~48px on-screen).
  Bosses 64×64, world boss 96×96.
- **Animation:** per entity, a horizontal strip of frames.
  - idle: 2 frames · walk: 4 frames · attack: 2–3 frames (optional) · death: 3 (optional)
  - One row per facing if you want 4-direction (down/up/left/right); the game
    currently only needs **side-facing + auto-flip**, so a single row is fine to start.
- **Format:** PNG, transparent background, no anti-aliasing (crisp pixels).
- **Palette:** warm, saturated, dark outlines — sample from the reference images.
- **Naming / folder:** put sheets in `assets/` as `assets/<name>.png` with a
  sibling `assets/<name>.json` `{frameW, frameH, anims:{idle:[0,1], walk:[2,3,4,5]}}`.
  Keys match sprite keys (`hero_warrior`, `slime`, `orc`, `dragon`, `portal`, tiles…).

## Engine work (the pipeline — to build)

1. **Asset loader** (`js/assets.js`, new): on boot, try to `Image()`-load each
   `assets/<key>.png`; if present, use its frames, else **fall back to the
   current procedural canvas**. Default (no PNGs) = today's game, unchanged.
2. **Animation:** replace the single `SPRITES[key]` draw with
   `spriteFrame(key, animState, animT)` that picks a frame; entities already
   track `animT` + `moving`, so walk/idle wiring is small (`entities.js` draw).
3. **Tiles:** swap the flat-colour baker in `world.js` for a tilesheet blitter
   (autotiling for grass/water/path edges) once a tilesheet exists.
4. **Scenery/buildings:** the reference villages use multi-tile buildings
   (church, houses, blacksmith, market stalls, well, bridge). Add a
   `structures` layer drawn from a building sheet.

None of step 1–4 changes gameplay — it's a rendering swap behind a fallback.

## Content added this session (procedural, ready to re-skin)

New sprites in `js/sprites.js` + stats in `js/data.js` `ENEMY_TYPES`
(defined but **not** in `TIER_ENEMIES`, so they don't spawn until wired):

| key | role | notes |
|---|---|---|
| `orc` | mob | tougher humanoid |
| `ghost` | mob | ranged, floats |
| `ogre` | **miniboss** | `miniboss:true` |
| `dragon` | **world boss** | `boss:true, worldboss:true` |
| `portal` | **warp** | tile/prop for map travel |

## Future systems these hook into

- **Warp mapping:** treat `portal` as a special tile/object; stepping on it
  teleports to a linked destination (village ⇄ dungeon ⇄ boss arena). Needs a
  `warps` list on the world (from/to) + a collision check in the player update.
- **Miniboss / world boss:** add a spawn rule (e.g. one `ogre` per high tier;
  a timed `dragon` world-boss event broadcast by the host) — wire into
  `TIER_ENEMIES` / a boss scheduler when ready.
- **More mobs:** add sprites + `ENEMY_TYPES` rows and drop into `TIER_ENEMIES`.

## Proposed order of work

1. Lock the spec above (sizes/frames/palette).
2. Produce a first spritesheet set (heroes + a few mobs + tiles).
3. Build the loader + animation (fallback-safe) — I can do this once art exists.
4. Tilesheet + buildings for the village/biomes.
5. Wire warp + boss systems using the new content.

Say the word and I'll build the loader/animation layer (step 3) so you can drop
`assets/*.png` in and see them animate — that's the concrete bridge to the
reference look.
