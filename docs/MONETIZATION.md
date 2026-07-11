# Pixel Realms Online — retention & fair monetization plan

*Goal: make the game worth people's **time** first, then make paying feel
like a natural "thank you" rather than a requirement. Explicit design
constraints from the owner: **no pay-to-win, no hard sell, no monopoly
economy** — players should fully accept why they pay. Revenue target is
modest and honest: cover the server bill, then fund development.*

> Companion docs: `CLAUDE.md` (how the game works today),
> `docs/SCALING.md` (tech roadmap the money plan must respect),
> `docs/REBALANCE.md` (content/balance expansion spec from the owner's
> design document — its reforge/refine/keys/food systems implement the
> gold sinks in §3.5 here, and its "costume coloring" is the M2 shop).

---

## 0. The one rule everything follows

**Sell appearance, convenience, and gratitude — never power.**

Concretely, a purchase may NEVER grant: stats, gear, gear tiers, damage,
defense, XP multipliers, drop-rate multipliers, gold, trade advantage, or
access to areas/bosses that affect progression. If a future idea touches
any of those, it's out. This is the line that keeps the game from becoming
the P2W game we don't want.

What CAN be sold (industry-proven, player-accepted):

| Category | Examples here | Why players accept it |
|---|---|---|
| **Cosmetics** | hero skins, weapon skins, dyes, hats, non-combat pets, portal/death effects, chat name color, chat bubble style | Pure self-expression; visible status without power |
| **Convenience** | extra character slots, extra storage tabs, extra quick-slot row | Saves clicks, not progress |
| **Identity** | supporter badge by name, title ("Founder"), profile flair | Public "I keep this game alive" |
| **Gratitude** | one-time supporter pack, tip jar / donation | People pay for games they love when asked honestly |

What we deliberately do NOT do:
- **No loot boxes / paid gacha.** Random paid rewards read as gambling,
  are increasingly regulated (including Thai game-rating rules), and
  poison trust. Sell every cosmetic directly at a visible price.
- **No energy/stamina systems.** Never sell back time we artificially took.
- **No paid XP/drop boosts** — with one carefully-fenced exception noted
  in §4 (server-wide celebration events, which are triggered by community
  support but benefit *everyone equally*, payer or not).
- **No subscriptions gating content.** Everything playable is free.

---

## 1. Order of operations (why retention comes first)

Nobody pays for a game they don't already love. The funnel is:

```
come back tomorrow  →  come back for a month  →  care about identity
(daily loop)           (goals & seasons)          (cosmetics sell here)
```

So the phases below interleave **R** (retention/rebalance, free-player
value) and **M** (monetization). Each M step only makes sense after the R
steps before it.

There is also a **hard technical gate**: today the Render free tier has an
**ephemeral disk** — `accounts.db` and the leaderboard can reset on
redeploy, and the landing page literally warns "progress may reset."
**We must not take a single baht while purchases could vanish.** Persistent
storage (paid Render disk or managed Postgres, see SCALING.md Stage 1) is
the prerequisite for ANY real-money feature. Donations (no entitlement
attached) are exempt and can start day 1.

---

## 2. Phase R1 — make the mid-game worth staying for (content we already built)

The current spawn tables use only 5 mobs + 1 boss; `orc`, `ghost`,
`ogre` (miniboss) and `dragon` (world boss) already have sprites and
stats but are **not in `TIER_ENEMIES`** — the cheapest content unlock in
the whole plan.

1. **Enable orc + ghost** in the mid/high zones (tier 3–4 tables). Fills
   the XP gap between wolf/skeleton farming and the demon boss.
2. **Ogre as a roaming zone-4 miniboss** — respawns every ~10 min,
   drops with `bias` between demon and normal mobs. Gives AFK-farmers a
   reason to come back to the keyboard.
3. **Dragon as a scheduled WORLD BOSS** — spawns on a fixed clock (e.g.
   every 2 h, announced 5 min ahead via the 📢 announcements channel and a
   chat toast). Everyone in the channel converges on one fight. This is
   the single strongest "log in at 20:00 with your friends" hook we can
   ship with existing assets. High `bias` loot roll for everyone who
   tagged it (damage-participation, not last-hit, so nobody gets robbed).
4. **Active-play premium over AFK**: the AFK bot is a beloved feature —
   keep it — but active play should clearly out-earn it (~1.5–2×).
   Cheapest lever: world-boss/miniboss participation effectively requires
   presence (bot's `AFK_FOCUS` boss flag already lets bots flee bosses),
   and add a small "engaged" combo bonus to gold (not XP) for
   manually-triggered skills. AFK remains the respectful "I have a life"
   baseline; active play is the jackpot.

## 3. Phase R2 — reasons to return daily & monthly

1. **Daily quests (3/day)**: "kill 20 wolves", "defeat a miniboss",
   "trade with a player" → gold + a random potion. Server-validated
   counts once Stage 2 authority lands; until then, client-tracked and
   modest rewards (already capped by the per-save gold clamp).
2. **Login streak** (7-day cycle): small gold ramp, day 7 = one guaranteed
   `unique`-tier item roll. Never punishes a broken streak (restart at
   day 1, no guilt UI — "no hard sell" applies to engagement too).
3. **Leaderboard seasons**: monthly reset of the existing four boards
   (Level / Mob kills / Boss kills / Gold), with permanent **cosmetic**
   rewards — a seasonal border, name badge, title. Costs nothing to run,
   drives the whole month, and — critically — **teaches players that
   cosmetics are the prestige currency** before we ever sell one.
4. **Achievements/collection log**: kill counts, gear codex ("own every
   Legend weapon type"), exploration. Pure client+account data, cheap,
   huge completionist retention.
5. **Gold sinks (economy health — do BEFORE selling anything).** Today
   gold buys only potions, so it accumulates meaninglessly (and gold is
   the #1 leaderboard flex). Add:
   - **Affix reroll**: reroll ONE chosen row on a gear piece for
     `200 × tierMult` gold (common 200 → mystic 860), price doubling per
     reroll on the same item, result clamped by the existing server-side
     `row_cap`. This is the classic "endless but fair" sink.
   - **Storage tab #2/#3** for 5k / 25k gold.
   - **Gold-bought cosmetic dyes** (a few basic colors) — establishes the
     cosmetic pipeline with zero real money involved.
6. **Guild-lite (parties/friends) later** — biggest social retention, but
   gated on Stage 2 server work; keep on the backlog, don't block the
   money plan on it.

## 4. Phase M — monetization ladder (each step is optional & honest)

### M0 — Tip jar (can ship this week, zero code risk)
- Ko-fi / Buy Me a Coffee / GitHub Sponsors link on the title screen and
  the 📢 announcements panel: *"Pixel Realms is free and always will be.
  Server costs ~$X/month — if you enjoy it, you can help keep the lights
  on."* (EN/TH, via `t()` keys like everything else.)
- **The server-cost meter** is the emotional core of the whole plan: a
  small public bar — "July server bill: $14 · covered 60% by supporters 💚"
  (manually updated in `announcements.json` at first). Transparent,
  community-owned, the opposite of a cash-shop vibe. For a small game
  with a Thai+EN community this honesty IS the marketing.

### M1 — Founder / Supporter pack (one-time, after persistent DB)
- One-time pack (~$5 / ฿179): **Founder badge** next to the hero name,
  exclusive founder cosmetic skin, a title, and nothing else. Sold "to
  cover the servers", limited to the early era so it stays meaningful.
- Entitlement = one boolean on the `accounts` row; badge renders in the
  HUD/head name like the leaderboard ★ already does. Small, safe scope.
- Payments: start with manual fulfillment (Ko-fi message → grant flag via
  an admin endpoint) before integrating a gateway. When automating, use
  **Stripe (supports Thai PromptPay) or Opn/Omise + PayPal** for
  international players.

### M2 — Cosmetic shop (after the art pipeline batch, still no gameplay effect)
- `tools/art/generate.py` already renders animated hero spritesheets —
  skins are a **naming-convention swap** (`drawSprite('warrior_royal', …)`
  falls back safely if missing). Launch with 2–3 skins per class, dyes,
  and 2 non-combat pets (a following sprite, pure decoration).
- **Direct prices, no gacha, no premium currency at first** — price in
  real money (e.g. skin $2–3 / ฿69–99). Premium "gems" can come later if
  bookkeeping demands it; starting without them keeps trust ("no funny
  exchange-rate math").
- Owned cosmetics list lives on the account (server-side, like gear
  `sanitize_character` — cosmetics whitelist = another clamp).
- **Seasonal cosmetics ≠ FOMO pressure**: rotate the shop, but state
  clearly that items return in future rotations. No countdown-timer
  anxiety UI.

### M3 — Community goals (the fenced "boost" exception)
- When monthly support crosses the server-cost bar: trigger a weekend
  **celebration event for EVERYONE** — +25% gold & bonus world-boss
  spawns, payer and free player alike. Supporters buy a party for the
  whole server, not an advantage over it. This converts "donation" into a
  visible, social, feel-good moment and is explicitly NOT personal P2W.

### M4 (later, only if the game grows) — Cosmetic battle pass
- Free track + premium track (~$3/season), **all rewards cosmetic**, any
  functional item (potions etc.) only on the FREE track. Only worth
  building after seasons (R2.3) are proven and Stage 2 authority exists.

---

## 5. Rebalance notes tied to the above (current numbers)

- `xpToNext = 45·level^1.45` is healthy through ~L20; the problem is not
  the curve but **content density** — R1 fixes that with existing assets
  before touching the formula. Revisit only if post-R1 data shows a wall.
- Enemy gold (`slime 1–3` … `dragon 200–400`) is fine once the gold
  sinks in R2.5 exist; without sinks, any gold tuning is meaningless.
- Potion prices (25/60g) are good; the reroll sink should dwarf potion
  spend at endgame by design.
- The `mystic` 1% weight is the long-term chase — do NOT add any paid
  path that touches tier weights, ever (see §0).
- Keep `apply_save_caps` / `row_cap` in lockstep with any reroll feature —
  the reroll must go through the server so the anti-tamper clamps apply.

## 6. Cost & break-even reality check

| Item | Est./month |
|---|---|
| Render paid instance (needed for persistence + always-on) | ~$7 |
| Persistent disk / small Postgres | ~$1–7 |
| Domain (optional) | ~$1 |
| **Total to keep the lights on** | **~$10–15** |

That's **3 founder packs or ~30 Ko-fi coffees a month** — a very
reachable bar for a small loyal community, which is exactly why the
transparent server-meter framing works: the goal is visibly achievable.

## 7. Sequenced checklist (single source of truth)

1. ☐ R1: orc/ghost into spawn tables; ogre miniboss; dragon world-boss
   timer + announcement toast.
2. ☐ R2: gold sinks (affix reroll server-validated, storage tabs, gold
   dyes) → daily quests → login streak → monthly leaderboard seasons with
   cosmetic badges → achievements.
3. ☐ M0: tip-jar link + server-cost meter on title/announcements (EN/TH).
4. ☐ **Gate:** persistent DB / paid tier (SCALING.md Stage 1 infra) —
   nothing with entitlements before this.
5. ☐ M1: founder pack (account flag + badge render + manual fulfillment).
6. ☐ M2: cosmetic shop (art batch: skins/dyes/pets; server-side owned
   list; direct pricing).
7. ☐ M3: community celebration events tied to the support meter.
8. ☐ M4 (much later): cosmetic-only battle pass, after Stage 2 authority.
