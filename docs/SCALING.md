# Scaling Pixel Realms Online — architecture & migration plan

*Goal: evolve from the current "one player hosts a channel of ≤20 over a dumb
relay" to a system that can hold **thousands** of concurrent players, stays
**cheap** to run, and is **hard to cheat**. This is the plan.*

> Read `CLAUDE.md` first for how the game works today. This document is the
> forward-looking target and the ordered steps to get there.

---

## 0. The core trade-off (read this first)

The three goals fight each other:

- **Anti-cheat** requires the **server to be the authority** over the game
  state (positions, damage, loot, gold).
- **Server authority costs CPU + bandwidth** = money.
- **Cheap** tempts you to trust the client — which is exactly what makes it
  hackable.

So there is **no free, client-trusted path that is also cheat-proof at
scale.** The whole strategy is: *keep the server authoritative over the few
things that matter, and make that authority as cheap as possible* via
interest management, lazy simulation, an efficient runtime, and horizontal
sharding.

### Where today's design stands
| | Thousands? | Cheap? | Anti-cheat? |
|---|---|---|---|
| **Today — player hosts a channel, server relays** | ❌ ~20/channel, O(N²) relay | ✅ server is just I/O; players pay CPU | ❌ **worst** — host player *is* the sim; any client can fake its own state/damage |

The current model is perfect for a hobby/co-op scale and terrible for a
secure MMO. That's fine — it got us a working game fast. This plan is how it
grows up.

---

## 1. Target architecture

Not one big server — a few cheap, independently-scalable pieces:

```
                 ┌──────────────┐
   players  ───► │  CDN / static│  (index.html, js, css — near-free to serve)
                 └──────────────┘
                        │ WebSocket
                 ┌──────────────┐
                 │   Gateway(s) │  stateless: auth, routing, rate-limit
                 └──────┬───────┘
            ┌───────────┼───────────┐
        ┌───▼───┐   ┌───▼───┐   ┌───▼───┐
        │ Zone  │   │ Zone  │   │ Zone  │   authoritative sim workers
        │ srv 1 │   │ srv 2 │   │ srv N │   (monsters, damage, loot, moves)
        └───┬───┘   └───┬───┘   └───┬───┘
            └───────────┼───────────┘
                 ┌──────▼───────┐
                 │   Database   │  accounts, characters, inventory, economy
                 └──────────────┘
```

**Pillars:**

1. **Stateless connection gateways** — terminate WebSockets, authenticate the
   session, forward to the right zone worker. Hold no game state, so you can
   run many behind a load balancer and add more under load.
2. **Authoritative zone/shard workers** — the map is split into zones (or the
   `@world-N` channels we already have). Each worker *owns* its monsters,
   applies damage, rolls loot, and **validates player moves** (max speed,
   attack rate). Clients send **inputs**, not results.
3. **Area-of-interest (AOI) filtering** — a player only receives entities in
   nearby grid cells, never the whole map. **This is the single biggest lever
   for both cost and scale**: it turns O(N²) broadcast into ~O(N) and caps
   each player's bandwidth.
4. **Efficient runtime on the hot path** — Go, Elixir/Erlang, Rust, or C#
   serve thousands of concurrent connections for a fraction of the CPU that
   Node/Python use per core. This is the biggest "don't eat the money"
   decision (see §4).
5. **Server-side accounts + database** — player progress lives on the server,
   not in the browser. This is also the #1 anti-cheat fix (see §2).
6. **Autoscaling** — workers scale with real load so you pay for *active*
   players, not idle peak capacity.

---

## 2. The #1 security fix: get player data off the client

**Today all progress lives in the browser's `localStorage`** (`pixelrealms_save`
holds gold, level, and every item). Anyone can open dev tools and give
themselves max gold and Mystic gear. **No netcode fixes this** — the data
itself must move server-side.

Required change:
- **Accounts** — a login (even lightweight: email + magic link, or OAuth).
- **Database of record** — characters, stats, inventory, storage, gold, and
  the leaderboard live in the DB; the client only *renders* them.
- **Server authority over the economy** — the server (not the client)
  computes XP/level, rolls drops, mutates gold and inventory, and processes
  trades. The client sends intents ("use item X", "sell item Y"); the server
  validates and applies.
- **Keep offline/solo mode** using `localStorage` as it is now — only *online*
  play requires an account. This preserves the "just open index.html" charm.

Until this is done, the game cannot be called cheat-resistant, regardless of
how the networking is built.

---

## 3. Anti-cheat checklist (what "server authority" concretely means)

- **Movement:** client sends intended direction/position; server rejects moves
  faster than `derived.speed` (+ a small tolerance) or through walls.
- **Combat:** client sends "attacked / cast skill i at time t"; the **server**
  checks cooldown + MP + range and computes the damage. Never trust a
  client-sent damage number (today clients send `hit` with a damage value —
  that must become server-computed).
- **Loot & economy:** server rolls drops and owns gold/inventory mutations.
- **Rate limits & sanity caps:** cap messages/sec per client; clamp every
  numeric field (already done for the leaderboard — extend everywhere).
- **Never trust the client for authority, only for input.**

---

## 4. Keeping the bill down ("not eat the money")

- **Simulate lazily** — don't tick monsters with no player nearby. The current
  code already gates enemy updates on `playerNear`; keep that principle
  server-side. Idle zones cost ~nothing.
- **Tick rate** — 10–15 Hz for the authoritative sim is plenty for this game;
  60 Hz is wasted CPU.
- **AOI + binary protocol + delta snapshots** — send only nearby entities, as
  compact binary deltas, not full JSON every tick. Bandwidth is a real bill.
- **Efficient language** — the difference between ~200 and ~5,000 players per
  core. Recommended options:
  | Runtime | Why | Trade-off |
  |---|---|---|
  | **Elixir/Erlang (BEAM)** | built for millions of cheap concurrent processes; per-zone/per-player as a process is natural; great fault isolation | new language to learn |
  | **Go** | pragmatic sweet spot; goroutines + channels; easy deploy; fast | manual care for hot loops |
  | **Rust** | fastest, lowest memory | steepest to write |
  | **Node (TypeScript)** | reuse existing JS logic directly | least efficient per core of these |
- **Cheap horizontal infra** — small containers/VPS behind a load balancer +
  autoscaling; a managed Postgres; the static client on a CDN (cheap/free).
- **Pay for load, not peak** — autoscale workers up and down.

---

## 5. Staged migration plan

Incremental — each stage ships value and never breaks the working game.

### Stage 1 — Server owns the economy (biggest security win, still cheap)
*Kills save-file hacking; gets to hundreds of concurrent players.*
1. Add **accounts** (lightweight auth) + a **database** (start with Postgres,
   or SQLite for a first cut).
2. Move **characters, inventory, storage, gold, leaderboard** into the DB;
   the client loads/saves via authenticated API instead of `localStorage`
   (online mode). Offline mode keeps `localStorage`.
3. Make the server authoritative for **XP/level, drops, gold, trades** — the
   client sends intents; the server validates and persists.
4. **Interim world host:** run the existing JS simulation headlessly (a Node
   "always-on host") so the public World no longer depends on a player's
   device. (This is "Approach A" from earlier discussions — a stepping stone,
   not the final sim.)
5. Add basic **movement/attack validation** + per-client rate limits.

> Infra needed: a host that can run **Node + Python (or one language)** and a
> **managed database**. This is where the free single-process Render tier is
> outgrown.

### Stage 2 — Authoritative zone workers (the real scale step)
*Targets thousands.*
1. Rewrite the authoritative core in an **efficient language** (§4).
2. Split the map into **zones**; each zone worker simulates its own entities.
3. Add **area-of-interest** so clients receive only nearby entities.
4. **Stateless gateways** in front; **binary protocol** + delta snapshots.
5. Raise the per-shard cap far above 20; **autoscale** workers.

### Stage 3 — Polish for scale
- Cross-zone handoff (walking between zones), matchmaking/queues if needed,
  observability (metrics, per-zone load), backpressure, and DB read replicas.

---

## 6. Open decisions (need your call before Stage 1 coding)

1. **Hosting** — stay on Render (need a paid tier that runs a persistent
   worker + managed Postgres), or move to a VPS / container platform?
2. **Language for the authoritative core** — reuse **Node/TypeScript** (fastest
   to build, less efficient) or invest in **Go / Elixir** (more efficient,
   more work)? This mainly affects Stage 2.
3. **Auth model** — anonymous device accounts, email magic-link, or OAuth
   (Google/Discord)?
4. **Database** — Postgres (recommended) vs. a first-cut SQLite.
5. **Budget target** — rough monthly ceiling? It sets how aggressively we lean
   on autoscaling, AOI, and runtime choice.

---

## 7. TL;DR

- **Suitable end state for thousands + cheap + secure:** authoritative,
  **zone-sharded** workers in an **efficient language**, with
  **area-of-interest** filtering, **stateless gateways**, and **server-side
  accounts/DB** — i.e., evolve toward "Approach B", using the headless-JS host
  ("Approach A") only as an interim step.
- **Do first (Stage 1):** move player data + economy authority to the server
  with accounts + a database. This is the true prerequisite for anti-cheat and
  is independent of the fancy netcode.
- **You can't make thousands-scale authoritative play free** — but AOI, lazy
  simulation, an efficient runtime, and autoscaling make it *cost-efficient*.
- The money you'd save by trusting clients, you pay back in cheating.
