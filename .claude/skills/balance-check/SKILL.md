---
name: balance-check
description: >-
  Analyze and tune game balance for Pixel Realms Online — combat (DPS,
  time-to-kill), progression (XP curve, level pacing), loot (tier drop rates,
  gear roll caps), and economy (gold sinks/faucets, potion/shop prices). Use
  when the user asks to balance the game, check if gear/tiers/classes/enemies
  are over- or under-powered, tune drop rates or XP, or mentions "balance",
  "too strong", "too weak", "DPS", "time to kill", "OP", "underpowered",
  "grind", "drop rate", "loot", "progression curve", or "economy".
allowed-tools: Read, Grep, Glob, Bash, Edit
---

# Balance Check (Pixel Realms adaptation)

Adapted from `donchitos/claude-code-game-studios`. The upstream skill reads
`assets/data/`, `design/gdd/`, and calls `/propagate-design-change`. None of
those exist here — Pixel Realms keeps all balance numbers in **source**, mirrored
between the client and the server anti-tamper layer. This skill points at the
real files.

> The roadmap in `CLAUDE.md` explicitly defers **"Balance the new gear and
> tiers"** — this skill is the tool for that task.

## Where the numbers live

| Domain      | Files                                                                 |
|-------------|-----------------------------------------------------------------------|
| Combat      | `js/data.js` — `CLASSES`, `SKILLS`, `ENEMY_TYPES`, `deriveStats`, `computeBase` |
| Progression | `js/data.js` — level/XP (`xp_to_next`); `server.py` mirror (`xp_to_next`, `apply_save_caps`) |
| Loot / gear | `js/items.js` — `ITEM_TIERS`, `TIER_MULT`, `AFFIXES`/`AFFIX_MAX`, `rollItem`/`rollTier` |
| Economy     | `js/items.js` — potion prices, `sellValue`; `js/main.js` — `buyPotion`/`sellItem` |
| Server caps | `server.py` — `sanitize_character`, `row_cap`, `MAX_ILVL`, `enforce_player_invariants` |

**Critical invariant:** `server.py` duplicates client constants (`CLASS_BASE`,
`TIER_MULT`, `AFFIX_MAX`, `xp_to_next`) for anti-tamper. **Any balance change to
`data.js`/`items.js` must be mirrored in `server.py` or legit players get their
saves clamped/rejected.** Always grep both.

## Workflow

1. **Scope the domain** from the request (combat / progression / loot / economy).
   If unclear, ask which. Don't boil the ocean — tune one axis at a time.
2. **Read the source of truth** for that domain (table above). Grep the constant,
   don't guess it.
3. **Run the domain checks** below and compute actual numbers.
4. **Report** health + outliers + recommended deltas (structure below).
5. **On approval**, apply the edit, **mirror it in `server.py`** if it's a mirrored
   constant, run `node --check js/*.js` and the relevant test in `tests/`, and
   note it under the roadmap in `CLAUDE.md`.

## Domain checks

**Combat**
- DPS per class = weapon `dmgMul` × `computeBase` × crit expectation × attack
  speed (`aspdMul`/`spd`). Compare classes at the same level with tier-matched gear.
- Time-to-kill: class DPS vs each `ENEMY_TYPES` HP; flag TTK < ~1s (trivial) or
  runaway TTK on bosses.
- Dominance: one class/skill/weapon clearing everything faster than the rest by a
  wide margin.

**Progression**
- Plot `xp_to_next(level)` across the level range; flag dead zones (a level that
  takes disproportionately long) and power spikes. Confirm the `server.py` mirror
  matches, and that `apply_save_caps` (+10 levels/save) can't be tripped by
  legitimate play.

**Loot / gear**
- Per-tier drop probability from `rollTier`; expected rolls to see a Legend/Mystic.
- Gear power: `TIER_MULT` × `AFFIX_MAX` per row vs `row_cap(stat,tier,ilvl)` in
  `server.py` — **crafted/rolled gear must never exceed `row_cap`** or the server
  clamps it. Verify best-case client roll ≤ server cap.

**Economy**
- Faucets (enemy gold drops, quest gold) vs sinks (potion `buyPotion` cost,
  repair/none). Map net gold/hour; flag runaway inflation. Check `sellValue` isn't
  a buy→sell arbitrage.

## Report format

```
## Balance report — <domain>
Health: <one line — healthy / needs tuning / broken>
Outliers:
  - <thing>: <measured value> vs <target> → <over/under by X%>
Degenerate strategies:
  - <exploit or dominant pick, if any>
Recommendations (priority order):
  1. <file:const> <current> → <proposed> (why)  [mirror in server.py? Y/N]
```

## Guardrails

- Change constants, not formulas, unless the user asks for a redesign.
- Keep client ↔ `server.py` constants in sync (this is the #1 balance bug here).
- Re-run `tests/` after economy/loot/combat edits; browser tests catch real
  regressions.
