# Handoff — resume on another machine

Short, practical notes to pick this project back up from a fresh clone on a
different PC. Deep architecture lives in `CLAUDE.md`; scaling plan in
`docs/SCALING.md`. This file is just "how do I get going again."

_Last updated: 2026-07-09._

## Where things stand

- **Live on `main`:** the renewed session model + the inventory/trade/stat UX
  pass shipped via **PR #14** (merged) and auto-deployed by Render.
- **Working branch:** `claude/engineering-skills-review-x70ieo`. After PR #14
  merged, more work landed here (see "In flight" below). If PR #14 shows as
  merged, treat new work as a **fresh PR** off this branch — do not reuse a
  merged PR.

### In flight on this branch (not yet PR'd at time of writing)

Two-step title screen + account-username checking:
- Title screen is now **two steps**: step 1 = **Log in / Register** or
  **Play as Guest**; step 2 = choose class. `showTitleStep()` in `js/main.js`
  toggles `#title-landing` / `#title-select`; `guestChosen` remembers the guest
  path. Language buttons live in the header so they work on both steps.
- Subtitle no longer says "co-op" (`title.subtitle` in `js/i18n.js`).
- **Live account-username availability:** new server route
  `GET /api/username-available?username=` (checks the `accounts` table);
  client shows ✓/✗ under the register field via `UI.checkUsernameAvailable()`
  and blocks an obviously-taken name before submit. (Server already rejected
  dupes at register via the `uname_lc` UNIQUE constraint → `taken`.)

## Run & verify (any machine)

```bash
python3 server.py 8900          # game + relay + accounts at http://localhost:8900
node --check js/*.js            # syntax gate
```

Tests live in `tests/` (see `tests/README.md`). They need Playwright + a
Chromium and a server on **8900**:

```bash
python3 server.py 8900 &                     # from repo root
cd tests
# browser tests (Node):
node landing_test.js        # two-step title, language, username availability
node session_flow_test.js   # guest = sessionStorage/offline, login auto-joins World
node account_ui_test.js     # account panel + cloud save/load + Continue
node inv_trade_test.js      # inventory filter/tier-sort, stat bonus, compare tip, item trade
node trade_test.js items_test.js shop_test.js ui_test.js feature_test.js patch3a_test.js
# server tests (Python, stdlib only):
python3 ws_test.py shard_test.py accounts_test.py hardening_test.py
```

If Playwright can't find a browser: `PW_CHROMIUM=/path/to/chromium node <test>.js`.

> In THIS cloud environment specifically (won't match your PC): Playwright is
> global at `/opt/node22/lib/node_modules` (set `NODE_PATH` to it) and Chromium
> is `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. On your own machine,
> `npm i -D playwright && npx playwright install chromium` instead.

## Data / accounts notes

- `accounts.db` (SQLite, gitignored) holds accounts + characters. Passwords are
  **pbkdf2-sha256 + per-row salt** — never plaintext, not recoverable.
- Render's free-tier disk is **ephemeral**: accounts + leaderboard reset on each
  redeploy. There is no password-reset endpoint yet.
- Save routing: signed-in → server (source of truth); guests → `sessionStorage`
  only (wiped on browser close).

## Deploy

Render auto-deploys `main` (`render.yaml`). Flow: feature branch → PR → merge to
`main` → Render redeploys. Client-only changes need a player hard-refresh.
`server.py` stays pure stdlib (no pip deps).

## Suggested next steps / backlog

1. Open a PR for the in-flight branch work above and merge to go live.
2. Deferred by the user: shield / off-hand slot; balance gear tiers; SFX for
   common/rare item pickups.
3. Bigger: server-hosted public World (proposal in `CLAUDE.md`), then
   server-authoritative combat (Stage 2 in `docs/SCALING.md`) to unlock a real
   anti-cheat and raise the 20-player channel cap.

## Skills applied here (keep using)

`karpathy-guidelines` (surgical, verify-first), `debug-mantra` (reproduce →
fail path → falsify → breadcrumbs), `scrutinize` (trace end-to-end, cite
`file:line`), `handoff` (this doc).
