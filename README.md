# Pixel Realms Online 🗡️

A pixel-art MMO-style RPG that runs entirely in the browser — full online
multiplayer, AFK auto-farming, leaderboards, and rebindable hotkeys.
เกม MMO พิกเซลอาร์ตแนวผจญภัย เล่นออนไลน์กับทุกคน ฟาร์มอัตโนมัติได้ รันบนเบราว์เซอร์

## Play

**Easiest — one command serves the game AND multiplayer:**

```
python server.py
```

Open http://localhost:8765 — done. Friends on your network open
`http://<your-ip>:8765` and everything (game + multiplayer address)
is pre-configured.

Other options:
- double-click `index.html` (offline play)
- any static host for the client (GitHub Pages, Netlify, itch.io) — then run
  `server.py` somewhere reachable for multiplayer

## Online multiplayer 🌐

The server is pure Python standard library — no installs:

```
python server.py            # game + relay on port 8765
python server.py 9000       # custom port (or set PORT env var)
```

1. Everyone clicks the **🌐** button, keeps the pre-filled server address
   (or types `ws://<host-ip>:8765`), enters the same **room** name, and a name.
2. Play together! The first player in a room becomes the **host** (★) and
   simulates monsters; if the host leaves, the next player is promoted
   automatically. The world map is generated from a shared seed, so only
   entity state is synced.

### Deploy to the cloud (play from anywhere)

The repo is deploy-ready — one service hosts both game and multiplayer:

- **Render (free):** push this folder to GitHub, then on
  [render.com](https://render.com) choose *New → Blueprint* and select the
  repo ([render.yaml](render.yaml) is picked up automatically). Share
  `https://<your-app>.onrender.com` — the game auto-fills the matching
  `wss://` address.
- **Docker (any VPS / Fly.io / Railway):**
  `docker build -t pixel-realms . && docker run -p 8765:8765 pixel-realms`
- **Quick tunnel (no account on a cloud):** run `python server.py` locally and
  expose it, e.g. `ngrok http 8765` — share the `https://` URL ngrok prints.

> Note: a game page served over **https** must use a **wss://** server
> address (browsers block mixed content). The auto-filled default handles this.

## Chat 💬

Press **Enter**, type, **Enter** again to send. Messages appear in the chat
log (bottom-left) and as a bubble above your hero's head — visible to
everyone in the room.

## Leaderboards 🏆

Click the **🏆** button for three server-wide rankings — **Level**,
**Mob Kills**, and **Gold** (each player's best marks). Scores submit
automatically while you play (level-ups, boss kills, every 45s, and when
you leave). Your own entry is highlighted with ★.

> Board data lives in `leaderboard.json` next to `server.py`. On free
> cloud tiers the disk is ephemeral, so the board resets when the service
> redeploys — attach a persistent disk (or a paid instance) to keep it
> forever.

## Trading 🤝

Click the **🤝** button, pick a player, send a trade request. Both sides
offer gold and must accept — the exchange applies only when both confirm.
Cancel anytime.

## Healing Circle ❤

The glowing circle in the village restores **10% of max HP per second**.
Retreat there when hurt; you also respawn inside it.

## Stat window 📈

Each level grants **+5 stat points**. Open the stat window with `C` or the
**＋Stats** button (it pulses with a badge when you have unspent points) and
customize STR / AGI / INT / VIT / LUK freely.

## AFK auto-farming 🤖

Press the **AUTO** button on your player frame (or the `F` key):

- hunts monsters suited to your level, walking zone to zone
  (skips ones hidden behind trees/rocks it can't reach)
- attacks and casts skills automatically
- picks up hearts, mana orbs, and gold
- retreats to the village heal circle when HP is low — and fights back
  from inside it instead of standing idle
- yields to you instantly: press any key to take over, release to resume
- keeps farming even when the browser tab is hidden/minimized

Stat points are never spent automatically — they stack up while you're
away, and you allocate them yourself in the stat window (`C`). Use the
**★ Recommended build** button to spend them all following your class's
suggested build, or **↺ Reset stats** to refund every point and start over.

## Rebindable hotkeys ⌨

Click the **⌨** button, click any binding, press the new key. Bindings are
saved in the browser. Defaults:

|            | Key |
|------------|-----|
| Move       | `W A S D` |
| Attack     | `J` |
| Skills 1-3 | `U` `I` `O` |
| Stat panel | `C` |
| AFK farm   | `F` |
| Chat       | `Enter` |

Attacks and skills **aim at your mouse cursor** (the AFK bot aims on its
own and ignores the cursor).

## Features

- 🎨 **Pixel art** — all sprites procedurally rendered, crisp pixel scaling
- ⚔️ **4 classes** — Warrior, Mage, Archer, Cleric, each with unique base stats and 3 skills
- 📈 **Stat progression** — every level grants **+5 stat points** for STR / AGI / INT / VIT / LUK
- 🌍 **Open world** — procedural map, 5 difficulty zones, a Demon Lord boss
- 🌐 **Thai / English** — switch language anytime, persisted
- 💾 **Auto-save** — progress saved in the browser (localStorage)
- 🔊 **Retro SFX** — synthesized WebAudio sound effects

## Classes

| Class   | Role | STR | AGI | INT | VIT | LUK |
|---------|------|-----|-----|-----|-----|-----|
| Warrior | Melee tank | 8 | 4 | 1 | 8 | 3 |
| Mage    | Burst caster | 1 | 3 | 10 | 4 | 4 |
| Archer  | Fast ranged DPS | 4 | 10 | 2 | 4 | 6 |
| Cleric  | Support / healer | 3 | 3 | 8 | 7 | 3 |

## Project structure

```
index.html        entry point + DOM overlays
css/style.css     UI styling
server.py         game host + multiplayer relay (pure stdlib WebSocket)
Dockerfile        container deploy (any VPS, Fly.io, Railway)
render.yaml       one-click Render blueprint
js/i18n.js        EN/TH language system
js/sprites.js     procedural pixel-art sprites
js/data.js        classes, stats, skills, enemies, balance, bot hints
js/world.js       procedural world, collision, zones, spawns
js/net.js         network layer (LocalNet / WSNet + protocol docs)
js/entities.js    Player / RemotePlayer / Enemy / Projectile / Pickup
js/ui.js          HUD, stat panel, class select, hotkeys, trade, chat
js/main.js        game loop, input, AFK bot, combat, trade, save system
```

## Network protocol (for contributors)

See the header comment in [js/net.js](js/net.js). Summary: clients exchange
JSON over the relay; the host broadcasts enemy snapshots at ~10 Hz and
authoritative events (deaths, projectiles, damage), while every client owns
its local players' state and damage.
