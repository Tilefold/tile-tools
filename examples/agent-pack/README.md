# Agent Pack (example)

Adds AI coding agents Tilefold doesn't know yet to **your own agents**, one command each: Grok Build, Kimi CLI, Mistral Vibe, Qwen Code, Aider, Goose and Crush. Tilefold shows you each agent and the exact command it would type before anything is added, and adds it only when you press **Add agent**. Afterwards it's under **Settings → Agents → Your own agents**, where you can change its command or remove it.

Needs Tilefold 0.1.27. The agent's own program must be installed and on your PATH; Agent Pack only tells Tilefold how to start it.

## Using it

Open the command palette and run, for example, **Agent Pack: Add Grok Build**. Tilefold asks; press **Add agent**. A notice says how it went: added, already one of your agents, not added, or why it couldn't be.

Once added, Tilefold marks the agent in the sidebar when it runs in a pane, and you can pick it for manager and side panes, or as the agent a tile works with.

## What it offers

| Agent | Command | Clears its context with |
|---|---|---|
| Grok Build | `grok` | `/clear` |
| Kimi CLI | `kimi` | `/clear` |
| Mistral Vibe | `vibe` | `/clear` |
| Qwen Code | `qwen` | `/clear` |
| Aider | `aider` | `/clear` |
| Goose | `goose` | none |
| Crush | `crush` | none |

If an agent's command is different on your computer, add it and then change the command in Settings → Agents.

## Permission

`agent.define`: to offer agents you add only after you confirm. The activity log records which agent was offered and whether it was added, nothing else.

## Files

| File | What it does |
|---|---|
| `src/presets.js` | The agents it offers, and the notice for each outcome |
| `src/main.js` | One command per agent, offering it with `tf.agent.define` |

---

Copyright (c) 2026 Tilefold. Released under the MIT License.

Last updated: 2026-11-08 by Tilefold
