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
node feature_test.js               # heal circle, leveling, AFK keeps points, stat buttons
node bot_test.js                   # line of sight, unstuck/blacklist, manual override,
                                   #   retreat fight-back, cursor aim, live AFK farm (~1 min)
node trade_test.js                 # two-client trade flow + accept-reset exploit regression
node ui_test.js                    # real-mouse-click stat buttons, sound panel, persistence
node patch3a_test.js               # HUD name/level+ellipsis, buff chips, AFK focus menu,
                                   #   boss priority/flee, retreat routing, name uniqueness
```

If Playwright can't find a browser, point `PW_CHROMIUM` at a Chromium binary:

```bash
PW_CHROMIUM=/path/to/chromium node ui_test.js
```
