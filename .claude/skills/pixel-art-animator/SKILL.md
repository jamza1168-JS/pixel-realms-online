---
name: pixel-art-animator
description: >-
  Add and manage multi-frame sprite animation in Pixel Realms Online's
  procedural canvas sprite system (js/sprites.js). Use when the user wants to
  animate a sprite, add movement, or mentions "animation", "animated",
  "frames", "keyframes", "frame rate", "FPS", "timing", "duration", "walk
  cycle", "run cycle", "idle animation", "attack animation", "jump", "bob",
  "flap", "loop", "ping-pong", or actions like walking/running/attacking/
  breathing/bouncing. This project does NOT use Aseprite — sprites are
  string-grid definitions rendered to offscreen canvases, so all animation is
  done in plain JS.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Pixel Art Animator (Pixel Realms adaptation)

The upstream skill (`willibrandon/pixel-plugin`) drives Aseprite through
`mcp__aseprite__*` MCP tools. **Those tools do not exist in this repo.** Pixel
Realms sprites are procedural: string grids → offscreen `<canvas>` via
`makeSprite(rows, palette)` in `js/sprites.js`, cached in the global `SPRITES`.
This skill keeps the animation *concepts* from the original and maps every step
onto this project's real APIs.

## How sprites work here (read first)

- `SPRITE_DEFS[key] = { rows: [...16 strings...], palette: {ch:'#hex'} }`
  (`js/sprites.js`). `'.'`/`' '` = transparent.
- `buildSprites()` builds `SPRITES[key]` and `SPRITES[key + '_f']` (x-flipped
  via `flipSprite`). Heroes use `HERO_TEMPLATES`/`HERO_PALETTES`.
- Entities draw ONE static sprite per frame in their `draw(g2d, cam)`
  (`js/entities.js`), and the only motion today is a sine **bob**:
  `Math.round(Math.sin(this.animT) * n)`. `this.animT` accumulates in `update`
  (`this.animT += dt * 10`).
- **There is no multi-frame system yet.** Adding one is the job of this skill.

## Animation concepts → this codebase

| Concept          | Aseprite original            | Pixel Realms equivalent                                   |
|------------------|------------------------------|-----------------------------------------------------------|
| Frame            | `add_frame`                  | Another `rows` grid in a frames array                     |
| Frame duration   | `set_frame_duration` (ms)    | Seconds-per-frame constant; advance index off `animT`     |
| Animation tag    | `create_tag` (named range)   | A named frames array (`SPRITE_ANIMS[key].walk = [...]`)   |
| Linked cel       | `link_cel`                   | Reuse the same grid object / `SPRITES[key]` in two slots  |
| Playback dir     | forward/reverse/ping-pong    | Index math (see helpers below)                            |
| FPS reference    | 100ms=10fps, 16ms≈60fps      | same: `frameDur = 1/fps` seconds                          |

## Recommended implementation pattern

Keep the string-grid authoring workflow; build an **array of canvases** per
animation instead of a single canvas, then pick the frame by time.

### 1. Define frames (in `js/sprites.js`)

```js
// Each animation is an array of row-grids sharing one palette.
const SPRITE_ANIMS = {
  slime: {
    palette: { b:'#1d4a24', g:'#5ec96a', a:'#2e7a3a', w:'#c8ffd0', '.':null },
    idle: [ SLIME_SQUASH, SLIME_TALL ],      // 2 frames, ping-pong
    // frameDur in seconds; 0.5 = 2 FPS (slow breathing)
    frameDur: 0.5,
    mode: 'pingpong',                         // 'forward' | 'reverse' | 'pingpong'
  },
};
```

### 2. Build them alongside static sprites (extend `buildSprites`)

```js
const SPRITE_FRAMES = {};   // SPRITE_FRAMES['slime'] = { idle:[canvas,...], idle_f:[...], frameDur, mode }
function buildAnims() {
  for (const key in SPRITE_ANIMS) {
    const a = SPRITE_ANIMS[key], out = { frameDur: a.frameDur, mode: a.mode };
    for (const tag in a) {
      if (tag === 'palette' || tag === 'frameDur' || tag === 'mode') continue;
      out[tag]        = a[tag].map(r => makeSprite(r, a.palette));
      out[tag + '_f'] = out[tag].map(flipSprite);   // flipped variants
    }
    SPRITE_FRAMES[key] = out;
  }
}
buildAnims();   // call after buildSprites()
```

### 3. Pick the frame by time (frame-index helper)

```js
// t seconds elapsed → frame index for an N-frame clip
function animFrame(frames, frameDur, mode, t) {
  const n = frames.length;
  if (n <= 1) return frames[0];
  let i = Math.floor(t / frameDur);
  if (mode === 'pingpong') {           // 0..n-1..1 then repeat, length 2n-2
    i %= (2 * n - 2);
    if (i >= n) i = 2 * n - 2 - i;
  } else if (mode === 'reverse') {
    i = (n - 1) - (i % n);
  } else {
    i %= n;                            // forward loop
  }
  return frames[i];
}
```

### 4. Use it in `draw()` (js/entities.js) — replace the single `SPRITES[...]`

```js
const clip = SPRITE_FRAMES[this.type.sprite];
const frames = clip[(this.face < 0 ? 'idle_f' : 'idle')];
const sprite = animFrame(frames, clip.frameDur, clip.mode, this.animT / 10);
// keep the existing bob if you like — sprite frames and bob compose fine
```

`this.animT` already accumulates (`+= dt * K`); divide back out to seconds, or
add a dedicated `this.clipT += dt`. **Do not** advance frame index off the
render loop's raw frame count — that ties animation speed to FPS.

## Frame-count & timing guidance (carried from upstream)

| Animation | Frames | Timing            | Mode      |
|-----------|--------|-------------------|-----------|
| Idle      | 2–4    | 400–500ms/frame   | pingpong  |
| Walk      | 4–8    | ~100ms (10 FPS)   | forward   |
| Run       | 6–8    | 60–80ms           | forward   |
| Attack    | 3–6    | variable*         | forward   |
| Jump      | 5–6    | variable**        | forward   |

\* Attack: slow windup (150ms) → fast strike (30ms) → medium recovery (100ms).
Per-frame durations need a `durations:[...]` array instead of one `frameDur`;
extend `animFrame` to accumulate variable durations if you need this.
\** Jump: crouch 100 → launch 50 → ascend 80 → **peak 200 (hang time)** →
descend 80 → land 100.

Walk pose cadence: `L-forward → contact → R-forward → contact`.

## Project invariants to respect

- **Keep the 16×16 grid** and palette-char convention; add sprites the same way
  existing ones are authored (`SPRITE_DEFS`).
- Every new `SPRITES`/`SPRITE_FRAMES` key needs its `_f` flipped variant — the
  draw code selects `_f` on `face < 0` (`js/entities.js:511`).
- Run `node --check js/*.js` after edits (syntax gate from CLAUDE.md), then
  verify in-browser with `python3 server.py 8900` — animation bugs (frame tied
  to FPS, wrong flip) only show up when the loop runs.
- No user-visible strings here, so no `i18n.js` changes needed for pure
  sprite work.

## Success indicators

- Frames cycle at the intended FPS independent of the render rate.
- Flipped (`_f`) frames animate identically to the facing-right set.
- `node --check` passes and the sprite animates when you drive the game.
