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
js/entities.js  Player, RemotePlayer (net mirror), Enemy (sim or ghost),
                Projectile, Pickup
js/ui.js        UI singleton: HUD, panels, minimap, trade/board rendering
js/main.js      Game class: loop, input, AFK bot, combat, trade state,
                save (localStorage), leaderboard posts; bootstrap listeners
server.py       HTTP static + /api/score + /api/leaderboard + WS relay
```

## Multiplayer model (host-authoritative over a dumb relay)

- Server relays JSON to everyone else in the room and stamps `from`; the
  first client in a room is host, promoted on leave (`host` message).
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
  messages route by `to`/`fromKey` = `clientId:slot`.
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
  `itemToSave`/`itemFromSave`. UI reuses `#skill-tooltip` for item tips.
- Global keydown must not `preventDefault` arrows/space while an
  INPUT/TEXTAREA is focused (chat cursor, volume slider).
- Sound: gate every new SFX through `beep()` so `SOUND.vol/muted`
  (persisted under `pixelrealms_sound`) applies.
- `server.py` stays pure stdlib — no pip dependencies, Render free tier
  runs it as-is (`render.yaml`); disk is ephemeral (leaderboard resets).

## Deploy

Render auto-deploys `main` (blueprint in `render.yaml`). Flow used so far:
feature branch → PR → merge to main → Render redeploys. Server-side fixes
only take effect after a redeploy; remind players to hard-refresh for
client changes.
