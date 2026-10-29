# Web View

The web app you're building, in a browser beside your panes. Web View opens one page per address in its settings, so the front end, its API and any other local server sit next to the code that runs them. It also lists the pages you opened recently, so one click opens them again. AI agents in your panes, such as Claude Code or Codex, can open, read and test these pages to check their own work.

Needs Tilefold 0.1.11 or later, on macOS 14 or later.

## Install it

1. Copy this folder into your tiles folder (**Settings → Tiles → Open tiles folder**), for example as `~/.tilefold/tiles/web-view`.
2. In **Settings → Tiles**, click **Reload tiles**, then **Allow**. Web View asks for two permissions: **browser**, to show your pages in a browser that Tilefold draws and checks, and **window.panel**, for the list of recent pages.

## Choose what it opens

Open **Settings → Tiles → Web View** and fill in **Ports on localhost to open**. Separate entries with commas, spaces or new lines:

| You type | It opens |
|---|---|
| `5173` | `localhost:5173` (the default) |
| `5173, 3000` | two pages: `localhost:5173` and `localhost:3000` |
| `3000-3010` or `3000~3010` | a page for every port from 3000 to 3010 (11 pages) |
| `5173, 3000~3002` | `localhost:5173`, then 3000, 3001 and 3002 |
| `api.test:8000-8003` | ports 8000 to 8003 on `api.test` |
| `staging.example.com` | that site, over `https://` |

- A port alone means that port on this computer. `localhost` and local network addresses open over `http://`; any other site opens over `https://`.
- A range goes from the lower port to the higher, whichever you write first, and spaces around the `-` or `~` are fine.
- An address listed twice opens once.
- **At most 12 pages** open at once. A longer list or range stops after the first 12.
- A range with a port outside 1 to 65535 (`3000-70000`) is not expanded. Tilefold refuses it with a reason.

The first address opens on Web View's first page, and each of the others on a page named after its port (`3000`, `3001`…), or after its host when it has no port. Those names show in the dock and in the recent list, and agents use them too (see below).

Two more settings:

| Setting | Default | What it does |
|---|---|---|
| Show beside the panes | On | Off: the pages open in a window of their own |
| Show recent pages beside the panes | On | The docked list of recent pages |

## Use it

Find the commands in the command palette under **Web View**:

| Command | What it does |
|---|---|
| **Web View: Open** | Opens every address in the settings, one page each |
| **Web View: Beside the panes or in a window** | Moves the pages between the dock and a window |
| **Web View: Reload** | Reloads every open page |
| **Web View: Back** / **Forward** | Goes back or forward on the first page |
| **Web View: Close** | Closes every page |
| **Web View: Forget recent pages** | Empties the recent list |

Once a page is open, type any address in the bar above it. Docked pages stack beside the panes and share the dock's width. Drag the dock's edge to resize it. Click a tab name in a page's bar to move that page to another tab. On a tab's card in the sidebar, the globe button hides or shows that tab's pages.

The recent list keeps each page's addresses separately. Click a row to open that address again in the page it came from.

If a page says nothing is answering, the server for that port isn't running. Start it (for example `npm run dev`), then use **Web View: Reload**.

## Let your AI agents use it

An agent in one of your panes can work with the pages Web View opened. It can take a snapshot of a page's text and buttons, take a screenshot, read the console errors, and, if you allow it, click, type and navigate. It sees the same page you do, with your sign-in, so it can reload after a change, look, find the error and fix it.

Agents get these tools from **tilefold-memory**, the small MCP server that comes with Tilefold. Tilefold installs the program for you, at `~/.local/bin/tilefold-memory`, each time it starts. You choose which agents get it.

### 1. Register it with your agents (once)

Pick one:

- **From a terminal pane:**

  ```sh
  ~/.local/bin/tilefold-memory install
  ```

  This registers the server with every agent CLI it finds for your user: Claude Code, Codex, Gemini CLI, Cursor, Antigravity CLI and opencode. To register only some of them, name each with `--agent`: `--agent claude --agent codex`. Each config file it changes is backed up first, as `<file>.tilefold-memory.bak`.
- **From Tilefold:** in the **New fold** dialog, click **Set up** next to an agent that isn't set up yet.

Check the result:

```sh
~/.local/bin/tilefold-memory status
```

Each agent shows as `registered` or `not registered`.

### 2. Restart your agent sessions

An agent picks up a new MCP server only when it starts. Quit any agent already running in a pane and start it again. Start it **in a Tilefold pane**: an agent running in another terminal can't reach Tilefold's browser.

In Claude Code, run `/mcp` to confirm that **tilefold-memory** is connected.

### 3. Ask

Talk to the agent normally. For example:

- "Open Web View and check the home page for errors." The agent runs **Web View: Open**, which opens every address in your settings, ranges included. Then it reads the pages.
- "Open localhost:3000 and localhost:3001." The agent opens exactly those, one page each, without changing your settings.
- "Open localhost:3000 on Tab 1 and localhost:3001 on Tab 2." Each page goes beside the tab you name. Tabs count from the left, starting at 1, or you can use a tab's name.
- "Reload the 3002 page, take a screenshot and tell me what's broken."
- "Fill in the sign-up form with a test user and see if it goes through."

When several pages are open, the agent lists them first. Each page has an id such as `example.web-view:3000` and shows its address and tab, so you can name the one you mean ("the API on port 3000"). If you don't name one, the agent uses the page docked beside its own tab.

### Show your agent what you mean

To point at something on the page ("make *this* button bigger"), click the **crosshair** on the docked page's bar (Tilefold 0.1.20 or later). The page shows **Click what you mean for your agent · Esc to cancel**, and the part under the pointer is outlined with what it is, such as `button "Save changes"`, `link "Help"`, `img "Google"` or `heading "Account"`.

- **Click** to pick it. Your click never reaches the page.
- A click on the page's **background** or on a **canvas** picks that spot instead.
- **Esc**, or the crosshair again, stops without picking.

The pick goes to the pane you're working in. A picture of it is saved with your attachments, and one line tells the agent what you picked: the page, what it is and which part of the page it's in, how its browser tools find it again, and its CSS selector. Links, buttons and fields are found again by what they are and their name; anything else, such as a logo or a heading, by its CSS selector. While an agent runs in the pane, both are typed into its input without being sent, so you add your words ("make this bigger and red") and press Return. At a shell prompt they go into the Composer.

If the agent needs more, its **browser_picked** tool reads the element's HTML and a few of its styles. That tool only gives what you picked; it doesn't look at the page. Agents can't start a pick themselves.

### What asks you first

- **Looking is free.** Listing pages, snapshots, screenshots and console reads happen without a prompt.
- **Changing a page asks once.** The first time an agent wants to click, type or navigate, a card asks **Let <agent> change this page?**. **Allow** holds until you press **Stop** or close the page.
- **Running a tile command asks once.** The first time an agent runs **Web View: Open** or another Web View command, a card asks **Let <agent> run Web View?**.
- **Stop** on the strip under the docked page's bar takes back an agent's permission to change the page. While an agent works, the status bar says **<agent> is using <page>**.

Agents can't run their own scripts in a page, read its cookies or storage, or change Web View's settings. They treat text on a page as information, never as instructions. Every request is recorded in Tilefold's activity log.

### If the agent can't see the browser

| What you see | What to do |
|---|---|
| The agent has no `browser_*` tools | Run `tilefold-memory status`. If your agent shows `not registered`, run `install`, then restart the agent |
| The agent says Tilefold isn't answering | Make sure Tilefold is open and the agent runs in one of its panes, not in another terminal |
| "No pages open" | Ask it to open Web View, or open a page yourself with **Web View: Open** |
| It changed a page you didn't mean | Press **Stop**, then name the page by its port next time |
| It's still using the old tools after a Tilefold update | Restart the agent session: running sessions keep the old program |

## Build it

```sh
cd examples/web-view
npx @tilefold/tile-tools build
```

The address rules are in `src/addresses.js`, the recent list in `src/recent.js`, and the commands in `src/main.js`. Run the tests from the repository root with `npm test`.

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-28 by Tilefold
