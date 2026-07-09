---
name: playtest-report
description: >-
  Generate a structured playtest template, or turn raw play/QA notes into
  categorized, actionable findings for Pixel Realms Online. Use when the user
  wants to record a playtest, review how a session felt, triage feedback, or
  mentions "playtest", "play session", "QA notes", "feedback", "first
  impressions", "what should I fix", "tester notes", or pastes raw observations
  from playing the game.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Playtest Report (Pixel Realms adaptation)

Adapted from `donchitos/claude-code-game-studios`. The upstream skill saves to
`production/qa/playtests/` and routes to a director-agent hierarchy that doesn't
exist here. This solo-friendly version writes to **`tests/playtests/`** and
routes findings to this repo's real tools and files.

## Modes

- `new` — emit a blank structured template for the user to fill in.
- `analyze <notes>` — parse raw notes (a path or pasted text) into categorized
  findings.

There's one reviewer here (solo project), so skip any multi-agent "director
gate" — just produce the report and the routing.

## Workflow

1. **new**: write the template below to
   `tests/playtests/playtest-YYYY-MM-DD.md` (today via `date +%F`).
2. **analyze**: read the notes, then sort every observation into exactly one of:
   - **Design** — mechanics/UX/feel changes.
   - **Balance** — numbers too strong/weak/grindy → hand to **`/balance-check`**
     (`js/data.js`, `js/items.js`, keep `server.py` mirrors in sync).
   - **Bug** — broken behavior → note repro steps; check against `tests/` and
     the gotchas in `CLAUDE.md` (stat-panel rebuild, trade escrow, WS
     fragmentation, bob/anim, etc.).
   - **Polish** — art/sound/copy. Remember: user-visible strings are **bilingual
     EN/TH via `t('key')`**; sound must route through `beep()`.
3. **Prioritize**: pick the top 3 by player impact × effort.
4. **Route**: for each finding name the concrete next step (file to edit, test to
   run, or skill to invoke). Reproduce interaction bugs with a real
   `python3 server.py 8900` + browser test in `tests/` before "fixing" — per
   CLAUDE.md, `element.click()` in evaluate has masked a rebuilt-every-frame bug;
   use `page.click`.

## Template

```md
# Playtest — <date> — <tester/build>

## Session context
- Build / branch:
- Class played, online or guest:
- Duration:

## First impressions (first 2 min)
-

## Gameplay flow
- What felt good:
- Where I got stuck / bored / confused:

## Findings
| # | Category (design/balance/bug/polish) | Observation | Repro / notes | Priority |
|---|--------------------------------------|-------------|---------------|----------|

## Quantitative
- Time-to-first-kill / level-up:
- Deaths, gold/hour, notable drops:

## Top 3 priorities
1.
2.
3.
```

## Output for `analyze`

```
## Playtest analysis — <date>
Summary: <one line>
Design:   [...]      → next: <file / skill>
Balance:  [...]      → next: /balance-check
Bug:      [...]      → next: repro via tests/, then fix; check CLAUDE.md gotchas
Polish:   [...]      → next: t()/i18n both langs, beep() for sound
Top 3: 1) ... 2) ... 3) ...
Report saved: tests/playtests/playtest-<date>.md
```

## Guardrails

- One category per finding; if it's both a bug and balance, split it.
- Every "fix" recommendation names the real file and the test that guards it.
- Save the artifact so playtests accumulate a history in the repo.
