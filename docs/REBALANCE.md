# Pixel Realms Online — rebalance & content expansion spec

*Source: the owner's design document "PIXEL MMORPG ONLINE WEBSITE BASE.docx"
(top-down fantasy MMORPG, 3/4 perspective, 16–32-bit style), reconciled
with the current code (`js/data.js`, `js/items.js`) and the money rules in
`docs/MONETIZATION.md`. This is the balance blueprint to grow from today's
5-mob single map to the document's 100+ enemy / 10+ map vision **without
ever resetting existing players.***

## 0. What the owner's document asks for (checklist)

- **Enemies:** 100+ — goblin, wolf, bat, skeleton, demon, dragon…
  plus **boss variants** and **elite variants**.
- **World/biomes:** grasslands, forest, desert, snow, swamp, volcano,
  village, castle, dungeon (+ full tilesets: sand/snow/ash/lava, cliffs,
  waterfalls, autotiles/transitions).
- **Buildings:** church, blacksmith, inn, farm, castle, tower, dungeon
  entrance, warp portal, bridge, windmill, market, warehouse, interiors.
- **Equipment:** 15+ sets of chest/helmet/boots/legs/**gloves**/
  **accessories**; per class: Warrior 20+ swords + 20+ **shields**; Mage
  20+ staffs + robes + 20+ **books**; Archer 20+ bows + crossbows +
  **quivers**; Cleric 20+ hammers/holy staffs/maces + shields.
- **Items:** potions, mana, buff, debuff, **revive**, **teleport**,
  **keys**, **ore**, food, fish, quest items, treasure, resources.
- **Systems:** leveling; **10+ maps separated by level period**;
  **auto routing/traveling**; armor progression; **reforge/refine**
  progression; random 3-roll stats **+ 1 extra roll via an item (4 total)**;
  **costume coloring customization**; biome rules.

Everything below turns that list into numbers and a build order.

## 1. Design pillars

1. **Formulas, not hand-tuning.** With 100+ enemies, per-mob hand stats
   don't scale. Every mob gets a **level L** and an **archetype**; stats
   come from shared curves. §3's curves are fitted to the CURRENT mobs, so
   adopting them re-derives today's game almost exactly — a formalization,
   not a reset.
2. **Levels are the road, gear is the endgame.** Keep
   `xpToNext = 45·L^1.45` (it yields a healthy ~12–15 kills-on-level per
   level across the whole range). Raise the effective cap to **40** via
   content bands; long-term chase = refine/reforge/4th-roll, not level 99.
3. **Every doc system respects the no-P2W line** (`MONETIZATION.md` §0):
   the 4th-roll item, refine materials, keys and teleports are **drops or
   gold purchases only — never real money**. The only doc item that is
   monetizable is *costume coloring* (dyes/skins).

## 2. World layout — the "10+ map system" by level band

Keep today's map as **Map 1 (Grasslands + Village hub)**. New maps are
separate seeded worlds entered through **warp portals** (portal sprite
already exists) placed at the hub; each map = its own relay room
server-side (private-room plumbing already supports this — reuse it as
`@map-N` channels).

| # | Map (biome) | Level band | Mobs (roster examples) | Apex |
|---|---|---|---|---|
| 1 | Grasslands / Village hub | 1–6 | slime, goblin | — |
| 2 | Forest | 5–10 | wolf, bat, boar* | Alpha Wolf* (miniboss) |
| 3 | Swamp | 9–14 | ghost, skeleton, toad* | Bog Horror* (miniboss) |
| 4 | Desert | 13–18 | orc, bandit*, scorpion* | Demon (existing boss, L14) |
| 5 | Snow | 17–22 | ice wolf*, yeti*, frost bat* | Ogre (existing, as L20) |
| 6 | Castle ruins | 21–26 | ghost knight*, cultist* | Dragon (existing, world boss L22) |
| 7 | Volcano | 25–31 | lava slime*, imp*, salamander* | Fire Lord* (boss) |
| 8 | Dungeon depths | 30–36 | revenant*, gargoyle* | Lich* (boss) |
| 9 | Demon castle | 35–40 | elite mixes | Demon King* (world boss) |
| 10+ | seasonal/event maps | any | reskins/variants | event boss |

*\* = new mob; most are **palette/behavior variants** of existing sprites
(the doc's "elite/boss variants" idea is exactly how 6 base rigs become
100+ enemies cheaply — variant = recolor + archetype multiplier).*

- **Mob level within a map** spreads across its band (deeper = higher).
- **Auto routing/traveling (doc):** two stages — (a) **teleport scroll**
  (§6) to hub/map entrance; (b) extend the AFK bot to walk to the right
  portal for its target level band (`bot` already pathfinds; portals become
  waypoints).
- Old 5-zone tiering on Map 1 stays until Maps 2–3 ship, then Map 1 keeps
  bands 1–6 only (existing higher-tier spawn points migrate to new maps).

## 3. Enemy stat curves (fitted to current mobs)

For a mob of level `L` (validated against slime L1, goblin L3, wolf L5,
bat L4, skeleton L7, ghost L8, orc L9 — all within ~10% of current values):

```
lateGame(L) = 1 + 0.03 * max(0, L - 10)        // superlinear tail to
                                                // track player gear growth
hp(L)   = (25 + 10.5·L) · lateGame(L)
dmg(L)  = (3.5 + 1.7·L) · (1 + 0.02 · max(0, L - 10))
xp(L)   = 10 + 2·L + 0.55·L²
gold(L) = [0.5·L + 0.5,  1.1·L + 1.5]
```

**Archetype multipliers** (applied on top; calibrated so demon≈L14 and
dragon≈L22 come out at today's 1400/3200 hp, 900/2200 xp):

| Archetype | HP | DMG | XP | Gold | Loot |
|---|---|---|---|---|---|
| normal | ×1 | ×1 | ×1 | ×1 | normal `rollTier` |
| **elite** (doc) | ×3 | ×1.4 | ×3 | ×3 | guaranteed gear, `bias +0.5` |
| **miniboss** | ×4.5 | ×1.6 | ×4 | ×5 | guaranteed gear, `bias +1` |
| **boss** | ×7 | ×1.9 | ×6 | ×8 | 2 rolls, `bias +2` |
| **worldboss** | ×9 | ×2.2 | ×9 | ×12 | roll **per participant**, `bias +2.5` |

- Elites: ~1 per spawn cluster, slightly larger sprite + tinted (variant
  system). They also drop **keys** (§6).
- Ranged/fast specialists trade ~15% hp for their gimmick (as skeleton
  and ghost already do vs the curve).

## 4. Player-side balance

- `xpToNext` unchanged. Kills-to-level stays ~12–15 when fighting
  on-level mobs; leveling slows naturally because on-level kills take
  longer — no artificial wall needed.
- **Level cap 40** (matches Map 9). `MAX_ILVL` rises 28 → **40** in
  lock-step with the map bands (server `row_cap` already scales by ilvl —
  keep `server.py` constants in sync, per CLAUDE.md).
- **Slot budget:** new gear slots (§5) add affix rows to the player's
  budget, which the `lateGame()` mob tail is sized against. Ship order
  matters: **gloves with Map 4 (L13+ drops), accessories ×2 with Map 6
  (L21+ drops)**. Introducing a slot alongside harder content masks the
  power spike instead of trivializing old content.
- Death penalty stays lenient (respawn at heal circle). Risk knob for
  hard maps: mobs on Maps 7+ briefly gain the existing debuff chips
  (burn/slow) rather than one-shot damage.

## 5. Equipment expansion (doc's per-class lines)

1. **Slots:** rename today's `hands` (weapon) → `weapon`; add `offhand`,
   `gloves`, `acc1`, `acc2` (armor-type: gloves; new type: accessory —
   accessories roll ONLY primary-stat/crit/spd rows, no flat hp/atk, so
   they're spice rather than raw power).
2. **Off-hands** (pair with 1-handers; this absorbs the deferred
   "shield/off-hand" backlog item):
   - **Shield** (Warrior/Cleric): rows lean vit/hp; base `dmgMul 0.9`,
     +flat damage-reduction% (new stat, cap 20%).
   - **Book** (Mage): rows lean int/matk; base `matk`-flavored `dmgMul 1.1`.
   - **Quiver** (Archer): special case — pairs with the two-hand bow;
     rows lean agi/crit, base `aspdMul 1.08`.
3. **New 1-hand weapons:** `mace1h` (Cleric/Warrior, `dmgMul 1.05,
   aspdMul 1.0`), `wand1h` (Mage, `dmgMul 0.95, aspdMul 1.2`),
   `crossbow` (Archer 2h alt: `dmgMul 1.45, aspdMul 0.8` — the "sword2h
   of bows").
4. **Class tags:** weapons/off-hands gain `classes:[…]`; armor stays
   universal. Guardrail: keep the 1h+offhand total ≈ one 2h in raw output
   (±5%), differing in *mix* (defense/utility vs burst) so neither path
   is mandatory.
5. **"15+ sets" / "20+ swords":** cosmetic-first — same slot/base table,
   different sprite + name per map/biome (Desert Saber, Frost Blade…).
   Stats still come from tier+ilvl+rows, so 20 swords ≠ 20 balance
   problems; sets can later add small 2/4-piece bonuses (post-Stage-2,
   server-validated).

## 6. Reforge / refine / 4th roll (doc's progression systems = the gold & material sinks)

- **Refine (+0 → +9):** per gear piece. Weapon: +4% dmg per step; armor:
  +3% to its rolled rows per step. Cost per attempt:
  `150 gold × tierMult × (current+1)²` **+ ore** (`current+1` ore).
  Success 100% to +4, then 80/70/60/50/40%; failure = −1 step, item
  **never breaks** (frustration ceiling, and no repair-fee dark pattern).
- **Ore** (doc): drops from rock props (mineable nodes, 60s respawn) and
  Maps 4+ mobs (~8%). Tradable — gives the player-trade economy a
  commodity beyond gear.
- **Reforge:** reroll ONE chosen affix row: `200 gold × tierMult`,
  doubling per reroll on the same item (resets on refine +1). Result
  clamped by the server's existing `row_cap`.
- **4th roll — "Awakening Stone" (doc's +1 roll item):** boss/worldboss
  drop only (~5% / ~12%). Adds a 4th affix row to one item, once.
  Tradable, **never sold for money**. Server: `sanitize_character` must
  accept `rows.length == 4` only on `awakened: true` items.
- **Keys & treasure chests** (doc): locked chests spawn per map; keys
  drop from **elites** (~15%). Chest = gold + potions + gear roll.
  Purpose: an active-play loot beat the AFK bot doesn't chase (bot ignores
  chests) — reinforces "active play out-earns AFK."

### 6.5 Drop-tier rules (owner's loot spec) — ✅ SHIPPED

The tier that can drop is **constrained per archetype** so rarity means
something and bosses are worth fighting (`TIER_DROP` + `lootProfile` in
`data.js`, enforced by `rollItem({tierWeights})` in `items.js`):

| Archetype | common | rare | unique | legend | mystic | rolls |
|---|---|---|---|---|---|---|
| normal    | 68 | 27 | 5  | — | — | 1 (tier-scaled chance) |
| elite     | 30 | 45 | 25 | — | — | 1 (guaranteed) |
| miniboss  | —  | 50 | 50 | — | — | 1 (guaranteed) |
| **boss**  | —  | —  | 75 | 25 | — | 2 (guaranteed) |
| **worldboss** | — | — | 50 | 35 | 15 | 3 (guaranteed) |

Rules encoded (owner's requirements):
- **Legend is boss-exclusive**; **Mystic is world-boss-exclusive** — no
  normal/elite/miniboss can ever roll them.
- **Bosses & world bosses never drop common/rare** (floor = unique).
- Tougher enemy → higher floor + better odds; the legend/mystic drop
  fanfare is now a genuine boss-kill moment.
- A tier absent from an archetype's row simply can't roll there.
- The 5 tiers themselves (common/rare/unique/legend/mystic) and their
  stat multipliers are unchanged — only the *drop distribution* moved.

## 7. Consumables & life-skill hooks (doc's item list)

| Item | Effect | Price/source | Note |
|---|---|---|---|
| Revive feather | self-res on the spot, 50% HP | 400g, shop | 10-min cooldown; disabled during worldboss fights |
| Teleport scroll | return to hub / map entrance | 80g, shop | step (a) of auto-traveling |
| Food (bread/fish dishes) | +regen ×2 for 120s | 15g or **fishing/cooking** | food buff stacks WITH potion buffs (separate tag) — cheap comfort layer |
| Antidote/cleanse | clear debuff chips | 40g | pairs with Maps 7+ debuff mobs |
| Fish (doc) | raw material for food | **fishing** at water tiles | idle-adjacent life skill; zero combat power, pure retention & chat-while-fishing social time |
| Quest items / treasure | daily-quest tokens, collection log entries | drops | feeds `MONETIZATION.md` R2 dailies/achievements |

## 8. Costume coloring (doc) — the one monetizable line

The doc's "costume coloring customization" is exactly `MONETIZATION.md`
M2: base dye colors for **gold**, premium palettes/skins as supporter
cosmetics. Buildings the doc lists (blacksmith = refine/reforge NPC,
market = shop/auction later, inn = daily-quest board, church = revive/
cleanse) give these systems physical homes in the hub as the tile/building
art from `docs/ART_REDESIGN.md` lands.

## 9. Rollout phases (each ships alone, save-compatible)

1. **P1 — Curves + variants:** ✅ **SHIPPED.** Elite variant spawning
   (deterministic ~1-in-9 promotion on tier 2+ spawns, ×3 HP / ×1.4 dmg /
   ×3 XP + guaranteed better loot, tinted & larger with a pulsing aura);
   orc + ghost enabled in the tier-3/4 pools; **ogre** miniboss lair
   (10-min respawn) and **dragon** world boss (20-min timer with a 5-min
   channel-wide warning, announced via system chat + toast) added.
   Archetype **loot profiles** (`lootProfile`) unify elite/miniboss/boss/
   worldboss drops (more rolls, rarity bias, extra gold). Bosses keep their
   authored stats (not re-multiplied). `mobBaseStats` curve added as the
   tuning reference for future content. *Deferred within P1:* fully
   replacing authored mob stats with `mobBaseStats` generation — a pure,
   player-invisible refactor best done with the full suite watching; the
   fitted curve reproduces current mobs within ~10%, so there's no rush.
   Interval constants (`WORLDBOSS_INTERVAL`/`WARN`, `MINIBOSS_RESPAWN`) are
   in `js/main.js` — raise as the population grows.
2. **P2 — Loot & sinks:** ✅ **drop-tier rework SHIPPED** (§6.5: legend =
   boss-only, mystic = worldboss-only, bosses floored at unique, per-
   archetype tier weights). The remaining sinks are split into three small,
   independently-shippable sub-phases (§9.1) so each fits one focused
   coding session:
   - **2a — Reforge** ✅ **SHIPPED** (gold-only sink; reroll one affix row,
     escalating per-item cost).
   - **2b — Ore + Refine** ✅ **SHIPPED** (mineable ore material + gear
     refine +0→+9; gold + ore cost, fail past +4 drops a step, never breaks).
   - **2c — Teleport scrolls + Keys/Chests** (next; convenience consumable +
     active-play loot the AFK bot ignores).
3. **P3 — Maps 2–4 + portals:** map-per-room plumbing, level bands,
   gloves slot, teleport routing; migrate Map-1 high tiers out.
4. **P4 — Equipment lines:** offhand slot (shield/book/quiver), new
   weapons, class tags, accessories with Map 6.
5. **P5 — Maps 5–9, Awakening Stone, fishing/cooking.**
6. **P6 — Sets/variants art pass** (the "20+ swords" cosmetic breadth) —
   pairs with the dye/cosmetic shop (M2).

Server-side `CLASS_BASE`/`TIER_MULT`/`row_cap`/`MAX_ILVL` constants must
be updated in the same PR as any client formula change (CLAUDE.md
invariant), and every phase re-runs `tests/` plus a save-migration check
(old saves must load with zero data loss).

## 9.1 Phase 2 sub-phase specs (small, one-session each)

Ordered by dependency and risk (2a is smallest). Each ships alone, is
save-compatible with the phase before it, and adds its own test. **Ship in
order** — 2b's ore feeds nothing in 2a, but 2c's chests reuse 2b's ore.

### Phase 2a — Reforge (gold sink) — ✅ SHIPPED
*Goal: give endgame gold a purpose without any new item type or save-format
risk.*
- **Mechanic:** on a gear item, reroll ONE chosen affix row's value (same
  stat, new roll). Cost `200 × tierMult × 2^reforgeN` gold; `reforceN` is a
  per-item counter that increments each reforge. New value uses the existing
  `rollItem` row math (tier mult × ilvl scale) so it stays within the
  server's `row_cap` automatically — no new clamp needed.
- **Files:** `items.js` (`reforgeCost(item)`, `reforgeRow(item, rowIdx)` +
  a tiny `rr` counter on the item; `itemToSave`/`itemFromSave` carry `rr`),
  `main.js` (`Game.reforge(item, rowIdx)` — checks/spends gold, calls the
  item fn, re-derives stats if equipped), `ui.js` (a ⚒ Reforge control per
  row in the item tooltip/inventory; shows the cost), `i18n.js` (EN/TH),
  `server.py` (`sanitize_character` must accept + clamp the new `rr` int,
  e.g. 0..99 — gear rows are already clamped, so no exploit).
- **Test:** `tests/reforge_test.js` — reroll changes one row, spends the
  right gold, cost doubles, rows stay within cap, save round-trips `rr`.
- **No new item kind, no world changes** → lowest-risk, self-contained.

### Phase 2b — Ore + Refine (material + upgrade sink) — ✅ SHIPPED
*Goal: a deep, fair gold+material sink that makes gear feel owned.*
- **Ore item:** a new **stackable material** kind (`kind:'material'`, like
  potions stack via `_addTo`). Drops from **rock props** (make rocks
  mineable: click/attack a rock → ore + ~60s respawn) and from Maps-4+ mobs
  (~8%). Tradable (already works — trade escrows any `itemToSave`).
- **Refine +0→+9:** per gear piece, stored as `refine` (0..9) on the item.
  Weapon +4% dmg/step; armor +3% to its rolled rows/step — apply in
  `equipAgg()`/`deriveStats` so `UI.spSig` must include `refine` to
  re-render. Cost/attempt `150 × tierMult × (refine+1)²` gold **+
  (refine+1) ore**; success 100% to +4 then 80/70/60/50/40%; failure = −1
  step, **never breaks** (no dark pattern).
- **Files:** `items.js` (material kind + stack, `refine` field + save,
  refine cost/odds/apply helpers, `equipAgg` includes refine), `data.js`
  (rock-drop / mob-ore rates), `world.js` (rock props become mineable
  nodes with respawn), `main.js` (`Game.mineRock`, `Game.refine`),
  `ui.js` (refine control in blacksmith/inventory; ore in bag; `spSig`),
  `i18n.js`, `server.py` (`sanitize_character` clamps `refine` 0..9 and
  the refine stat contribution; add `MAX_REFINE=9`).
- **Test:** `tests/refine_test.js` — ore stacks, mining yields ore, refine
  raises stats, failure drops a step not the item, gold+ore spent, server
  clamps a tampered `refine:99` back to 9.
- **Save-format change** (`refine`, material items) → include the migration
  check; old saves (no `refine`) must default to +0.

### Phase 2c — Teleport scrolls + Keys / Treasure chests — convenience & active loot
*Goal: a QoL consumable + an active-play loot beat the AFK bot won't touch.*
- **Teleport scroll:** consumable (`kind:'consumable'` or reuse potion
  plumbing with a non-heal effect); `use` → warp the player to the village
  heal circle. Sold in the shop (80g). Simple, no world changes.
- **Keys:** stackable material dropped by **elites** (~15%, in the elite
  loot branch of `handleEnemyDead`).
- **Treasure chests:** deterministic chest spawn points in the world (seed-
  placed like enemy spawns so all clients agree), rendered as a prop;
  walking onto one with a key in the bag consumes the key and drops a
  reward (gold + a potion + one gear roll at the local tier's profile).
  **The AFK bot ignores chests** (don't add them to `botInput` targets) so
  chests reward active play (ties to MONETIZATION.md R1 "active > AFK").
- **Files:** `items.js` (scroll + key items), `world.js` (chest spawn
  points + prop), `data.js` (key drop rate in elite loot), `main.js`
  (`usePotion`/`useQuickItem` handles the scroll warp; chest pickup/open;
  key drop), `ui.js` (chest prop draw, key/scroll in bag), `i18n.js`,
  `server.py` (accept the new stackable items in `sanitize_character`).
- **Test:** `tests/chest_test.js` — scroll warps to village; elite drops a
  key; walking onto a chest with a key consumes it and yields loot; the
  bot walks past a chest (doesn't path to it).

> **Food / fishing** stays in **P5** (life skills), not Phase 2 — fishing is
> a whole idle sub-game and food's buff layer is low-priority next to the
> sinks above. A plain shop "bread" (+regen buff, separate tag) can pigg-back
> on 2c if trivial, else defer.
