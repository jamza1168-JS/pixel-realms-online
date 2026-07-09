# Skill sources & attribution

These project skills were installed from mdskills.ai listings and **adapted** to
Pixel Realms Online's stack (vanilla-JS canvas client + pure-stdlib Python
server). They are not verbatim copies — upstream dependencies that don't exist
here (Aseprite MCP tools, a 49-agent studio hierarchy, `assets/data/`,
`design/gdd/`) were re-mapped onto this repo's real files.

| Skill               | Upstream source                                                                 | License | Adaptation                                                                 |
|---------------------|---------------------------------------------------------------------------------|---------|---------------------------------------------------------------------------|
| pixel-art-animator  | https://www.mdskills.ai/skills/pixel-art-animator (`willibrandon/pixel-plugin`) | MIT     | Aseprite/`mcp__aseprite__*` calls replaced with `makeSprite`/`SPRITES` frame arrays in `js/sprites.js` + a frame-index helper for `js/entities.js`. |
| balance-check       | https://www.mdskills.ai/skills/claude-code-game-studios (`donchitos/claude-code-game-studios`) | MIT | Cherry-picked. Points at `js/data.js`, `js/items.js`, and the mirrored `server.py` anti-tamper constants instead of `assets/data/` + `/propagate-design-change`. |
| playtest-report     | https://www.mdskills.ai/skills/claude-code-game-studios (`donchitos/claude-code-game-studios`) | MIT | Cherry-picked. Solo-mode only; saves to `tests/playtests/` and routes to `/balance-check` + `tests/`, no director-agent gate. |

The full Claude Code Game Studios framework (49 agents, 73 commands, 12 hooks,
its own CLAUDE.md/settings.json) was intentionally **not** installed — it's a
whole-repo scaffold for Unity/Unreal/Godot studios and would overwrite this
project's configuration. Only the two directly-relevant workflow skills were
taken.
