# Pixel Realms Online — notes for Claude

Browser pixel-art MMO RPG (vanilla JS, no build step, no dependencies) with a
pure-stdlib Python server that both serves the client and relays multiplayer.
UI and docs are bilingual English/Thai — every user-visible string goes
through `t('key')` in `js/i18n.js` and must be added to BOTH languages.

## Run & verify

```bash
python3 server.py            # game + relay at http://localhost:8765
python3 server.py 8900       # custom port (tests expect 8900)
node --check js/*.js         # syntax gate
```

End-to-end tests live in `tests/` (see tests/README.md). Run them against a
local server before pushing — the browser tests catch real regressions
(clicks, bot behavior, trade protocol). Use REAL mouse clicks
(`page.click`) when testing DOM buttons: `element.click()` in evaluate
masked a rebuilt-every-frame bug once already.

## Architecture (load order matters, all globals)

```
js/i18n.js      t(), setLang, I18N string tables (EN/TH)
js/sprites.js   SPRITES: procedural canvases, *_f = x-flipped
js/data.js      CLASSES, SKILLS, ENEMY_TYPES, BOT_STAT_PRIORITY, deriveStats
js/items.js     ITEM_TIERS, EQUIP_SLOTS, WEAPONS/ARMOR/POTIONS, AFFIXES,
                rollItem/rollTier, item helpers (name/icon/color/save)
js/world.js     World: seeded gen (WORLD_SEED), tiles, solid, spawnPoints,
                hasLineOfSight, canStand; TILE/MAP_W/MAP_H consts
js/net.js       LocalNet (offline) / WSNet (relay); protocol doc in header
js/account.js   Account: register/login/logout, cloud character save/load
                (Stage 1a; server accounts over same-origin /api/*)
js/entities.js  Player, RemotePlayer (net mirror), Enemy (sim or ghost),
                Projectile, Pickup
js/ui.js        UI singleton: HUD, panels, minimap, trade/board rendering
js/main.js      Game class: loop, input, AFK bot, combat, trade state,
                save (server if signed in, else sessionStorage), leaderboard
                posts; bootstrap listeners
server.py       HTTP static + /api/score + /api/leaderboard + WS relay
```

## Multiplayer model (host-authoritative over a dumb relay)

- Server relays JSON to everyone else in the room and stamps `from`; the
  first client in a room is host, promoted on leave (`host` message).
- Rooms are capped at `ROOM_CAP = 20`. `{t:'join', public:true}` drops the
  client into the first public channel (`@world-N`) with a free slot,
  auto-opening the next channel when full. `{t:'join', room, password}`
  is a private room: the creator sets the password; wrong password →
  `wrong_password`, full → `room_full`. `welcome` carries
  `{room, channel, public}` (via `room_display`); the client shows
  `net.roomLabel` ("World · Ch N" or the room name).
- **Client entry (renewed):** the manual online panel is gone. Only
  **signed-in** players go online, and `startGame` auto-joins the public
  World (`game.goOnline(name)` → `{join, public:true}`; name = account
  username). Guests never connect — they play a local `LocalNet` session.
  The server still supports private rooms / channels (kept for the relay
  and its tests), but no client UI reaches them any more.
- Host simulates enemies and broadcasts snapshots ~10 Hz keyed by
  **spawn-point index** (`e.idx`); worlds are identical via `WORLD_SEED`,
  so only entity state syncs. Clients keep `ghosts` (Enemy with
  `remote=true`) interpolating toward snapshot positions.
- Clients send `hit`; host applies damage authoritatively and broadcasts
  `edead`. Enemy→player damage routes via `pdmg` to the owner's machine;
  each machine also collects its own loot drops locally.
- `server.py` reassembles fragmented WS messages (`read_message`) — proxies
  like Render's split large frames; do NOT regress this, it's why clients
  used to see no mobs while still taking damage.

## Gotchas & invariants

- Stat panel re-renders ONLY when `UI.spSig(player)` changes — rebuilding
  per frame destroys buttons mid-click. Keep the signature in sync when
  adding fields the panel displays.
- `healEntity` must apply sub-1HP ticks (heal circle/auras heal per frame);
  suppress the float text, not the heal.
- Trade: any `trade_set` resets BOTH accept flags (anti-scam). Trade
  messages route by `to`/`fromKey` = `clientId:slot`. Offers carry gold
  **and items**: `trade_set` sends `{gold, items:[itemToSave]}`. Offered
  items are **escrowed** — pulled out of the bag when added (`addTradeItem`,
  one potion per click) so they can't be used/duped mid-trade, and returned
  via `returnTradeEscrow` on any abort (cancel/decline/peer-left/disconnect/
  unload). Completion (`checkTradeDone`) keeps my escrowed items gone and
  `addItem`s the partner's `theirItems` + the gold delta.
- AFK bot (`Game.botInput`): never auto-spends stat points; checks
  `world.hasLineOfSight` before attacking; blacklists unreachable targets
  in `bot.avoid`; yields to any manual key press (see `Game.update`).
  Manual play aims at `game.mouse` cursor; the bot sets `out.face` itself.
  `AFK_FOCUS {boss,monster}` (persisted `pixelrealms_afk`) gates targeting:
  boss off = flee bosses, monster off = walk past mobs; a nearby boss
  (focus on, level ≥ 18) outranks mobs. `botSteer` probes `botPathClear`
  and bends the heading around solids before the sidestep fallback.
- Buffs/debuffs: `player.addBuff({tag,kind,v,t,icon,name,debuff})` — same
  `tag` refreshes (no stack); `UI.renderBuffs` shows an icon+timer chip
  (green buff / red debuff) keyed by a tag signature.
- Names are unique among connected clients: `server.py` holds
  `active_names` (freed on leave), rejects dupes at join with
  `{t:'name_taken'}`, and answers `GET /api/name-available?name=`.
- Items: gear carries a `tier` + 3 rolled `rows:[{stat,val}]`; equipped
  gear feeds `deriveStats` via `player.equipAgg()` (str/agi/int/vit/luk
  add to base stats; hp/mp/atk/matk/crit/spd add to outputs; weapon
  `dmgMul`/`aspdMul`/`spd` too). `computeBase` multiplies by `d.dmgMul`.
  Potions stack; `game.usePotion` heals and/or `addBuff`s. Drops are the
  `'gear'` Pickup kind (carries the item; collect → `addItem`). Save via
  `itemToSave`/`itemFromSave`. UI reuses `#skill-tooltip` for item tips —
  hovering gear also appends an equipped-slot comparison (`equipCompareHtml`
  via `itemStatMap`). Inventory/storage render a **filtered + tier-sorted
  copy** (`UI.invFilter`, `tierRank`); the real `inventory`/`storage` arrays
  are never reordered. Stat panel shows base **+gear bonus** per primary
  stat (from `equipAgg()`); `UI.spSig` includes equipped-item uids so it
  re-renders when gear changes.
- Bag vs stash: `player.inventory` and `player.storage` share `_addTo`/
  `_removeFrom` (potions stack per list); `depositItem`/`withdrawItem`
  move between them. Shop: `buyPotion`/`sellItem` (sell price `sellValue`).
  Hotkey potions: `player.quickItems` holds potion KEYS (not objects);
  `useQuickItem(i)` is edge-triggered from keydown (`quick1/2/3`, default
  4/5/6); the HUD quick bar re-renders off a count signature.
- Global keydown must not `preventDefault` arrows/space while an
  INPUT/TEXTAREA is focused (chat cursor, volume slider).
- Sound: gate every new SFX through `beep()` so `SOUND.vol/muted`
  (persisted under `pixelrealms_sound`) applies.
- `server.py` stays pure stdlib — no pip dependencies, Render free tier
  runs it as-is (`render.yaml`); disk is ephemeral (leaderboard resets).
- Accounts (Stage 1a): `sqlite3` (`accounts.db`, gitignored) with pbkdf2
  passwords; `POST /api/register|login|logout`, auth-guarded
  `GET/POST /api/character` (Bearer token; sessions in-memory, cleared on
  restart). Client `Account` cloud-saves on `game.save()` (throttled; forced
  on unload); `Continue` prefers the cloud character.
- **Username vs player name (decoupled):** the **username is private** (login
  only, never shown to others). The **hero name** is the public, **globally
  unique** in-game name: stored on `accounts.hero_name` (+ `hero_name_lc`
  UNIQUE index), claimed once at character creation via `POST /api/hero-name`,
  checked with `GET /api/hero-name-available?name=`. `Account.heroName` drives
  `game.heroName()` (HUD/head/online identity); guests keep a local name that
  is also validated against the hero-name registry. New account/guest =
  name+class+Start; a saved character = Continue-only; in-game Logout
  (`returnToTitle`) returns to the first title screen to switch accounts.
  Covered by `tests/account_flow_test.js`.
- **Save routing (renewed):** login is the gate for persistence. Signed-in
  players are the server's responsibility (cloud character is the source of
  truth). Guests get **no** durable save — `game.save()` writes the blob to
  `sessionStorage` only (survives a refresh, wiped when the tab/browser
  closes), and any legacy `localStorage` `pixelrealms_save` is cleared at
  startup. Signing in mid-session promotes the guest to online + cloud save;
  logging out drops back to a local guest session.
- Anti-tamper on save (Stage 1b, server-only): `sanitize_character` clamps
  absolute bounds AND (a) clamps gear rows to `row_cap(stat,tier,ilvl)` +
  `MAX_ILVL=28` so crafted gear can't beat a real drop; (b)
  `enforce_player_invariants` forces the base-stat point budget
  (`used+statPoints == 5*(level-1)`, stats ≥ class base) so stat inflation is
  neutralised; `apply_save_caps` caps per-save gold (`+100k`) and level
  (`+10`) gain vs the previous save; `xp` clamped below the next threshold.
  Char writes rate-limited to 1/2s per account; failed logins to 10/min per
  username. **Not full anti-cheat** — the server still can't verify kills
  happened (no combat sim); closing that is Stage 2 (`docs/SCALING.md`).
  Constants (`CLASS_BASE`, `TIER_MULT`, `AFFIX_MAX`, `xp_to_next`) mirror
  `data.js`/`items.js` — keep them in sync if the client formulas change.

## Deploy

Render auto-deploys `main` (blueprint in `render.yaml`). Flow used so far:
feature branch → PR → merge to main → Render redeploys. Server-side fixes
only take effect after a redeploy; remind players to hard-refresh for
client changes.

## Roadmap — where we left off (resume here)

Everything below is on `main` and live-deployable. Continued from any
machine: `git pull`, then pick up the queue.

**Recently shipped (PRs #4–#9):** skill tooltips; boss leaderboard; player
names in HUD/head/toasts; new default hotkeys (Space/1-3, potions 4-6);
buff/debuff chips; server-side name uniqueness; the full item system
(tiers, random 3-stat gear, weapons/armor/potions, drops, inventory,
storage stash, merchant shop, hotkey potions); Legend/Mystic drop fanfare;
tooltip-above-overlay fix; and public World channels (cap 20) +
password-protected private rooms.

**Renewed session model (latest):** removed the manual online panel (server
address, Join Public World, private room + password). Multiplayer is now
login-gated and automatic — signing in auto-joins the shared public World;
guests play a local session that lives only in `sessionStorage` (wiped on
browser close, so guest progress never persists). See the "Client entry"
and "Save routing" notes above. Server-side rooms/channels stay intact for
the relay + `ws_test.py`/`shard_test.py`; the client just no longer exposes
them.

**Title + accounts UX (latest):** the title screen is now **two steps** —
step 1 is Log in / Register **or** Play as Guest, step 2 is class select
(`showTitleStep()` in `main.js` toggles `#title-landing`/`#title-select`;
`guestChosen` remembers the guest path; language buttons sit in the header so
they work on both steps). Subtitle dropped "co-op". Live **account-username
availability** check: `GET /api/username-available?username=` (checks the
`accounts` table) + `UI.checkUsernameAvailable()` shows ✓/✗ and blocks a taken
name before submit (register already rejected dupes via the `uname_lc` UNIQUE
constraint). Cross-machine resume notes live in `docs/HANDOFF.md`. Covered by
`tests/landing_test.js`. The class step also has a **Hero name** field
(`#hero-name`): required for a first-time **guest** before START (`heroNameNeeded`
/ `updateStartBtn` gate the button; name saved to `localStorage
pixelrealms_name`), hidden for signed-in players (their username is the name)
and skipped on CONTINUE (the saved character carries its name). The title
Account button now shows only when signed in.

**Landing notices + announcements (latest):** the login/landing page carries a
PDPA-style privacy notice (`title.pdpa`) and an "early development — progress
may reset" warning (`title.devNote`). In-game, a 📢 button opens a **non-modal**
announcements window (`#news-panel` = `.news-window`, NOT a full-screen
overlay, so the game keeps running and the button toggles it open/hide);
content is server-published via `GET /api/announcements` (reads
`announcements.json` at the repo root at request time — edit + redeploy to post
an update). Each item is `{date, en:{title,body}, th:{title,body}}`, newest
first; the client picks the current language (falls back to `en`). Covered by
`tests/news_test.js`.

**Art pipeline (built):** `tools/art/generate.py` (Pillow, self-installing)
renders animated spritesheets → `assets/<key>.png` + `.json` + `manifest.json`;
`js/assets.js` loads the manifest, slices frames, and `drawSprite(key, faceLeft,
sx, sy, size, moving, animT)` draws the animated frame with **procedural
fallback** to `SPRITES[key]` (so missing art never breaks — upgrade sprite by
sprite). Entity draws (Player/RemotePlayer/Enemy) route through `drawSprite`.
Batch 1 shipped = 4 animated 32px heroes + 4-frame `portal`. Regenerate/extend
from any session via `tools/art/README.md`. It's **code-authored** pixel art
(not AI-mockup fidelity); real PNGs can replace any key by matching the naming.
Remaining procedural art (`js/sprites.js`) is still the fallback for everything
not yet in a sheet.

**Art redesign (target/spec):** see `docs/ART_REDESIGN.md` + `docs/ASSETS.md`. New procedural **content assets**: `orc`, `ghost` (mobs), `ogre`
(`miniboss:true`), `dragon` (`boss+worldboss:true`), `portal` (warp) —
sprites in `js/sprites.js`, stats in `ENEMY_TYPES`. **All now live** (see
Phase 1 below); `portal` is still only art (no warp system yet).

**Rebalance Phase 1 (shipped, see `docs/REBALANCE.md` §9):** enemy
**archetypes** — normal mobs roll **elite** (`ELITE_CHANCE ≈ 1/9`,
deterministic from the world seed so all clients agree; `ELITE_MULT` = ×3
HP / ×1.4 dmg / ×3 XP; tinted, larger, pulsing aura; guaranteed better
loot). `enemyArchetype`/`lootProfile` (in `data.js`) unify elite/miniboss/
boss/worldboss **loot** (more rolls, rarity bias, gold mult); bosses keep
their authored stats (NOT re-multiplied — only elites re-scale). orc/ghost
added to `TIER_ENEMIES` (tiers 3–4). `world.js` adds an **ogre** miniboss
lair (10-min respawn) + a **dragon world-boss** lair (`worldBossSpawn`,
skipped by the normal respawn loop). `Game.updateWorldBoss` (host-only)
drives the dragon on `WORLDBOSS_INTERVAL` (20 min) with a `WORLDBOSS_WARN`
(5 min) channel-wide notice via **system chat** (`{t:'chat', sys:1}` →
`onChat` shows it with a ★, no player bubble) + toast; `resetWorldBoss` on
kill. Minimap marks ogre + (live) dragon. `mobBaseStats` is the fitted
curve reference for tuning new content. Interval/respawn constants live in
`js/main.js`.

**Deferred by the user — remind them when they return:**
1. Shield / off-hand slot to pair with the one-hand sword.
2. Balance the new gear and tiers.
3. Sound effects for normal (common/rare) item pickups.

**Scaling — in progress (see `docs/SCALING.md`):** Stage 1a shipped
(accounts + cloud character store). Stage 1b shipped (server-only
anti-tamper hardening: gear-row caps, stat-point invariant, per-save
gold/level caps, xp clamp, write + login rate limits). **Remaining for full
anti-cheat:** the server still can't verify kills happened — that needs
server-authoritative combat (Stage 2: zone workers), which also unlocks
raising the 20-player cap.

**Open proposal, awaiting the user's go-ahead:** make the *server* host the
public World so it never depends on a player's device. Two paths discussed —
(A) a headless Node process that loads the existing JS as an always-on host
(reuses code, recommended), or (B) port the monster sim to Python
(server-authoritative, bigger rewrite). Needs confirmation that the Render
environment can run Node alongside Python before starting.

**Rebalance & content expansion spec (agreed direction):** `docs/REBALANCE.md`
— turns the owner's design doc ("PIXEL MMORPG ONLINE WEBSITE BASE.docx":
100+ enemies, 10 level-banded biome maps, gloves/accessory/off-hand slots,
reforge/refine, 4th-roll Awakening Stone, keys/chests, food/fishing,
costume coloring) into enemy stat curves fitted to today's mobs, archetype
multipliers (elite/miniboss/boss/worldboss), map/level-band tables, and a
6-phase save-compatible rollout. Future balance changes should follow it.

**Retention & monetization plan (proposed):** `docs/MONETIZATION.md` — fair,
no-P2W money model (cosmetics / convenience / supporter packs only, never
power), sequenced behind retention work first (enable orc/ghost/ogre/dragon
spawns, world-boss timer, gold sinks, dailies, leaderboard seasons) and
hard-gated on persistent storage before anything with entitlements is sold.
Read it before touching prices, drops, or any shop/payment work.

**Bigger backlog:** raise the 20-players/channel cap for a true massive
shared world — requires server-authoritative simulation + area-of-interest
(grid) filtering. Full architecture + staged migration plan (accounts/DB,
server authority, zone sharding, anti-cheat, cost levers) is in
`docs/SCALING.md` — start there.
