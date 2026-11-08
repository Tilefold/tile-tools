# Agent Pack (example)

Adds any AI coding agent you like to **your own agents**. Type its name and the command that starts it, or pick a ready-made one: Grok Build, Kimi CLI, Mistral Vibe, Qwen Code, Aider, Goose or Crush. Tilefold shows you each agent and the exact command it would type before anything is added, and adds it only when you press **Add agent**. Afterwards it's under **Settings → Agents → Your own agents**, where you can change its command or remove it.

Needs Tilefold 0.1.27. The agent's own program must be installed and on your PATH; Agent Pack only tells Tilefold how to start it.

## Using it

**Any agent.** Open the command palette and run **Agent Pack: Add your own agent…**. A panel opens beside your panes:

1. Type the agent's name in **Agent name** and press Enter.
2. Type the command that starts it in **Command**, such as `gemini --model pro`, and press Enter.
3. Click **Clears its context with** to switch between `/clear`, `/new` and nothing, to match the agent.
4. Click **Add this agent…**. Tilefold asks; press **Add agent**.

The panel shows what you typed under the fields, and says what to fix if the command has something a shell would treat as special (only letters, digits and `. _ , : = @ % + / ~ -` are allowed). **Start over** clears what you typed.

**A ready-made agent.** Click it under **Ready-made** in the same panel, or run its command from the palette, for example **Agent Pack: Add Grok Build**.

A notice says how it went: added, already one of your agents, not added, or why it couldn't be.

Once added, Tilefold marks the agent in the sidebar when it runs in a pane, and you can pick it for manager and side panes, or as the agent a tile works with.

## Ready-made agents

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

## Permissions

- `agent.define`: to offer agents you add only after you confirm.
- `window.panel`: to show the panel where you type your own agent.

The activity log records which ready-made agent was offered (or that it was your own) and whether it was added, never a name or a command.

## Files

| File | What it does |
|---|---|
| `src/presets.js` | The ready-made agents, and the notice for each outcome |
| `src/ownAgent.js` | Your own agent as you type it, and the checks it must pass |
| `src/panel.js` | The panel: the fields, what you typed, and the ready-made agents |
| `src/main.js` | The commands and the panel's events, offering each agent with `tf.agent.define` |

---

Copyright (c) 2026 Tilefold. Released under the MIT License.

Last updated: 2026-11-08 by Tilefold
