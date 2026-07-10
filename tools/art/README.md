# tools/art — sprite pipeline

The repeatable way to make/animate the game's pixel art. Works from **any
session or PC** (same repo): the generator self-installs Pillow, writes
spritesheets to `assets/`, and the game loads them automatically.

## Regenerate all art

```bash
python3 tools/art/generate.py
```

- Auto-installs Pillow if missing (dev-time only — the running game never needs it).
- Writes `assets/<key>.png` (horizontal frame strip) + `assets/<key>.json`
  (`{frameW, frames, anims}`) + `assets/manifest.json` (the list the client loads).
- Commit the regenerated `assets/*` so they deploy and version-control.

## How the game uses it

`js/assets.js` reads `assets/manifest.json` at boot, slices each sheet into
frames, and `drawSprite(key, …)` draws the animated frame — **falling back to
the procedural sprite in `js/sprites.js`** for any key without a sheet. So art
upgrades one sprite at a time and the game never breaks if a sheet is missing.

Animations in the JSON: `idle` / `walk` frame-index lists for characters, or a
plain `loop` (e.g. the portal). The entity's rolling `animT` drives playback.

## Add or restyle a sprite

1. In `tools/art/generate.py`, add a `build_<name>()` that returns `Frame`s,
   and an `export("<key>", frames, {"idle":[…],"walk":[…]}, size)` in `main()`.
   `<key>` must match the sprite key the game draws (`hero_warrior`, `slime`,
   `orc`, `dragon`, `portal`, …).
2. Run the generator, eyeball `assets/<key>.png`, commit.

## Current coverage (batches 1–4 — all sprites done)

- **Heroes** `hero_warrior|mage|archer|cleric` — idle + 3-frame walk.
- **Base mobs** `slime, goblin, wolf, bat, skeleton, demon` — 2-frame idle/move.
- **Content creatures** `orc, ghost, ogre, dragon` — 2-frame (ready for the
  warp/miniboss/world-boss systems; not spawned yet).
- **Props** `tree, deadTree, rock` — static 32px.
- **Collectibles** `heart, orb, coin` — 16px, animated (pulse / spin).
- **Warp** `portal` — 4-frame pulse.

**Not yet done (next, larger batch):** map **tiles** (grass/water/sand/path/ash)
and multi-tile **village buildings** — these need a tilesheet blitter + a
structures layer in `js/world.js` (today tiles are flat colours baked to a
canvas), so it's a bigger render change than the sprite batches. Target spec
in `docs/ART_REDESIGN.md`.

## Note on fidelity

This generates **code-authored** pixel art (clean, animated, larger than the
old 16px sprites) — not hand-painted/AI-rendered detail. For that exact look,
drop real PNG spritesheets into `assets/` following the same
`<key>.png`/`.json` naming and add the key to `manifest.json`; the loader uses
them the same way.
