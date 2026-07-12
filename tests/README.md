# Tests

End-to-end tests for Pixel Realms Online. The browser tests drive the real
game in Chromium via Playwright; the relay test speaks raw WebSocket frames
to `server.py`.

## Setup (once)

```bash
npm install playwright     # anywhere; or use an existing install
npx playwright install chromium
```

## Run

All tests expect the game server on port **8900**:

```bash
python3 ../server.py 8900 &        # from this folder (or repo root: server.py 8900)

python3 ws_test.py                 # relay: join/host, chat, fragmentation, migration
python3 shard_test.py              # public world 20-cap sharding + private-room passwords
node session_flow_test.js          # guest = sessionStorage/offline, login auto-joins World (browser)
node landing_test.js               # two-step title (login/guest → class), lang on page 1,
                                   #   live account-username availability check (browser)
node news_test.js                  # landing PDPA + dev-phase notices, server-fed
                                   #   announcements window (scroll, toggle open/hide) (browser)
python3 accounts_test.py           # register/login/logout, auth, character save+sanitize
node account_ui_test.js            # account panel + cloud save/load + Continue (browser)
node account_flow_test.js          # flow: new acct = Start-only, returning = Continue-only,
                                   #   in-game logout → title, guest name != a username (browser)
python3 hardening_test.py          # anti-tamper: gear caps, stat invariant, gold/level
                                   #   caps, xp clamp, write + login rate limits
node feature_test.js               # heal circle, leveling, AFK keeps points, stat buttons
node bot_test.js                   # line of sight, unstuck/blacklist, manual override,
                                   #   retreat fight-back, cursor aim, live AFK farm (~1 min)
node trade_test.js                 # two-client trade flow + accept-reset exploit regression
node inv_trade_test.js             # inventory filter/tier-sort, stat-panel gear bonus,
                                   #   equipped-compare tooltip, two-client item trade
node ui_test.js                    # real-mouse-click stat buttons, sound panel, persistence
node patch3a_test.js               # HUD name/level+ellipsis, buff chips, AFK focus menu,
                                   #   boss priority/flee, retreat routing, name uniqueness
node items_test.js                 # roll/tiers, equip stat changes, weapon dmgMul, potions,
                                   #   drops, pickup->bag, inventory UI equip, save/load
node shop_test.js                  # merchant buy/sell, storage deposit/withdraw+merge,
                                   #   hotkey potion assign/use/key, save/load
node reforge_test.js               # Phase 2a reforge: cost escalation, row reroll
                                   #   within cap, gold spend, rr save round-trip, UI click
node refine_test.js                # Phase 2b ore+refine: ore stacking, refine cost/odds,
                                   #   stat bonus, fail-drops-a-step, save round-trip,
                                   #   rock mining + cooldown, real-click Refine
node chest_test.js                 # Phase 2c: teleport scroll warp, seed-placed chests,
                                   #   key-gated open + loot, AFK bot skips chests
node support_test.js               # M0 tip jar: /api/support, cost meter %, https-only
                                   #   link guard, title-landing support slot render
node map_test.js                   # P3a maps/portals: hub determinism unchanged, Forest
                                   #   biome, warp round-trip, bot skips portal, online gate
node offhand_test.js               # P4a off-hand slot: roll/slot, class refusal, two-hand
                                   #   pairing+eviction, quiver+bow, damage reduction, save
```

If Playwright can't find a browser, point `PW_CHROMIUM` at a Chromium binary:

```bash
PW_CHROMIUM=/path/to/chromium node ui_test.js
```
