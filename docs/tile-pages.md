# Tile pages

From **Tilefold 0.1.7**, a tile with the `page` permission can show **a web page of its own**: a player, a map, a small dashboard. The page is ordinary HTML, CSS and JavaScript from the tile's `page/` folder. It opens in a window of its own, or runs hidden when it only plays sound. Tilefold sets the page's rules, and the tile and its page talk by messages.

The **Tuneboard** example (`examples/tuneboard`) is a complete tile with a page. A hidden page runs Spotify's player, and the same page shown as a window lists the user's playlists.

The **Watchpane** example (`examples/watchpane`) hosts another website's player instead: YouTube's IFrame Player API, loaded with `script:www.youtube.com`, in a window of its own. It needs no key or sign-in, and the tile never talks to YouTube itself; the page checks every link the user pastes before the player sees it.

## 1. Ask for the permissions

```json
"permissions": [
  { "page": "to play music in a page of its own" },
  { "script:sdk.example.com": "to load the player library" },
  { "net:api.example.com": "to ask what is playing" }
]
```

- `page` lets the tile show its page. The user sees **Show its own web page in a window of its own, or hidden to play sound** with your reason.
- `script:<host>` lets the page run scripts from that website, for example a vendor's player library. Name each one.
- `net:<host>` (the same permission `tf.net.fetch` uses) lets the page reach that website: requests, media, frames and pictures. `net:*.example.com` covers its subdomains.

## 2. Put the page's files in `page/`

```
my-tile/
  tile.json
  main.js
  page/
    index.html      opens first
    page.js
    page.css
```

Pages may load HTML, JavaScript, CSS, JSON, images, fonts, audio, video and WebAssembly from `page/`, at most 16 MB per file. **Inline `<script>` blocks and `eval` don't run**: keep code in `.js` files (`<script type="module">` works). Styles may be inline. In a development build of Tilefold, each page request is printed with its status, which helps when a file doesn't load.

## 3. Open and close it from the tile

```js
tf.command("Show player", () => void tf.page.open(), { id: "show" });
tf.command("Play in background", () => void tf.page.open({ visible: false }), { id: "play" });
tf.command("Stop", () => void tf.page.close(), { id: "stop" });
tf.on("page.closed", () => tf.toast("The player stopped"));
```

- `tf.page.open()` opens the page in a window, or shows it again if it's already open. `{ visible: false }` runs it hidden. Opening an already running page hidden leaves its window as it is.
- `keepRunning: true` makes the window's close button **hide** the page instead of closing it, so music keeps playing. `tf.page.open()` shows it again. Each open that names `keepRunning` sets it; one that leaves it out keeps the current choice.
- `tf.page.close()` always closes the page. So do turning the tile off, removing it, and a new version that asks for different permissions.
- `page.closed` tells the tile the page has closed, whatever closed it.

`tf.page` is missing in Tilefold 0.1.6 and earlier. Check for it if your tile should also run there:

```js
if (tf.page) {
  /* offer the page */
}
```

## 4. Talk with messages

The tile and its page exchange **plain JSON**: at most 256 KB per message, at most 100 a second each way. Messages aren't recorded in the activity log one by one.

In the tile:

```js
tf.page.post({ do: "play" }); // fails while the page isn't open
tf.on("page.message", (e) => tf.log.info(JSON.stringify(e.message)));
```

In the page, Tilefold provides `window.tilefold`:

```js
window.tilefold.onMessage((message) => {
  if (message.do === "play") player.play();
});
await window.tilefold.post({ state: "playing" });
```

A page that has just loaded can't know whether the tile already sent something it missed. Tuneboard's page says `hello` when it loads, and the tile answers. `onMessage` returns a function that stops listening; several listeners may be added.

Remember that a tile's event handlers get half a second (see [Limits and errors](limits-and-errors.md)). Do slow work, such as a network request a message asks for, in the background, and post the answer when it's ready.

## 5. Give the page a key or sign-in (only if it must have one)

A tile never sees the user's keys or sign-ins: Tilefold adds them to `tf.net.fetch` requests itself. Some libraries need one inside the page, for example a player that streams from the user's account. Then mark it `"page": true` in `auth` (the tile needs `page` too):

```json
"auth": {
  "spotify": { "type": "oauth2-pkce", "...": "...", "page": true }
}
```

and ask for it in the page. A sign-in's token is renewed first when it's about to expire:

```js
const token = await window.tilefold.token("spotify");
```

The user sees **also given to code in this tile's page** when they allow the tile, and a tile that starts doing this in a new version is asked again, and signed in again. Every handover is recorded as `tile.credential.page`, with the credential's name, never its value.

Prefer keeping requests in the tile where you can. Tuneboard's page uses the token only for Spotify's player; the playlists are fetched by the tile with `tf.net.fetch` and posted to the page.

## 6. Give the page a web address (only if a player needs one)

Some embedded players play only in a page that has an https web address. YouTube's stops with **error 153** in an ordinary tile page. From **Tilefold 0.1.10** on macOS, open the page with one (0.1.9 accepts `origin` but opens the page without a web address):

```js
tf.command("Open", () => void tf.page.open({ origin: "https" }), { id: "open" });
```

Tilefold then shows the page at `https://<name>.<publisher>.tilepage.tilefold.com/`, an address of the tile's own (`example.watchpane` gets `https://watchpane.example.tilepage.tilefold.com/`). Tilefold owns that domain and never fetches anything from it; the address only tells the player which app it plays in.

Such a page is **one self-contained document**. Tilefold puts the files that `page/index.html` names with `<script src>` and `<link rel="stylesheet">` inside it, and nothing else from `page/` can be loaded: no pictures, fonts or JSON from the folder, and a script can't import its neighbours. Write the page's code in `page-src/` and let `tilefold-tile build` bundle it into one `page/main.js`, then name only that script:

```html
<link rel="stylesheet" href="page.css" />
<script type="module" src="main.js"></script>
```

Use `type="module"` (or put the script at the end of `<body>`): an inlined classic script runs where it stands, before the rest of the page exists. `window.tilefold` works as before, and only the page itself can use it, never a player's frame inside it. A page already open keeps the kind of address it was opened with. Other systems refuse `origin: "https"` for now. The **Watchpane** example plays YouTube videos this way.

## What a page can't do

- reach websites the tile doesn't name with `net:`;
- run scripts from anywhere but its own files and `script:` websites, or run code typed into it;
- use Tilefold's own features: terminals, files, other tiles' pages, or keys and sign-ins other than one given to it;
- open other websites in its window, or submit forms elsewhere.

A page's own requests go straight to the websites it may reach, so unlike `tf.net.fetch` they aren't logged one by one. A script loaded with a `script:` permission may run part of itself in a frame from its own website, and that frame follows its website's rules, not the tile's. Ask for a `script:` website only if you trust it.

Every opening and closing is recorded as `tile.page.open` and `tile.page.close`, and a close button that only hid the window as `tile.page.hide`.

## 7. Dock the page in Tilefold's window

From **Tilefold 0.1.11**, a page can sit **inside Tilefold's window** instead of in a window of its own: a video next to the tile's card, say. Open it with a spot, in the window's content and in CSS pixels, like overlay items (120 to 2,000 pixels a side):

```js
await tf.page.open({ origin: "https", dock: { x: 600, y: 300, w: 356, h: 200 } });
tf.on("overlay.layout", (layout) => void tf.page.dock(spotFor(layout)));
```

A docked page has no title bar or close button and doesn't take the keyboard when it opens; the user clicks into it to use it. It moves with Tilefold's window, and Tilefold hides it while its own interface covers the spot (the command palette, settings, menus) or the user hides tile overlays. Move it with `tf.page.dock(spot)` and close it with `tf.page.close()`. `tf.page.dock` is missing before 0.1.11, so check for it and fall back to a window of its own:

```js
const docked = typeof tf.page.dock === "function";
await tf.page.open(docked ? { origin: "https", dock: spot } : { origin: "https" });
```

The **Watchpane** example docks YouTube's player this way, with its controls drawn as overlay items in a dock right under it. When the user drags that dock (`overlay.pointer` drag events), Watchpane moves the page with `tf.page.dock` on every move, so the video follows. The page itself can't be the drag handle, because a docked web page keeps the pointer.

A docked page doesn't need `origin: "https"`: a page of the tile's own, with no website in it, docks just the same. The **Quiz** example (`examples/quiz`) is one: a borderless card floating over the panes, with a grip drawn as overlay items above it to drag it by.

## 8. Dock the page beside the panes

From **Tilefold 0.1.20**, a page can also go **in the dock beside the panes**, on the right, where the pages of Tilefold's browser go. The panes make room for it, and Tilefold draws a bar above it with the tile's name, the tab menu, **Undock** and **Close**. The user resizes it by its edge and shows it on one tab or every tab, like any page in the dock.

```js
await tf.page.open({ side: true });                          // into the dock
await tf.page.open({ dock: spot });                          // back out, floating over the panes
tf.on("page.undocked", () => void tf.page.open({ dock: spot })); // the user pressed Undock
```

Opened without `side`, a page in the dock moves back out: to the `dock` spot you give, or a window of its own. When the user presses **Undock**, the docked page closes and the tile hears `page.undocked`: show it again where it should go. Moving a page between the dock and a window **loads it again**, so keep the page's state (where the user is, what they chose) in the tile, and send it again when the page says hello. A page with a web address (`origin: "https"`) can't dock there yet, and `side` can't be given with a `dock` spot. Docking and undocking are recorded as `tile.page.dock` and `tile.page.undock`.

`side` is new in 0.1.20 and an older Tilefold ignores it, opening the page in a window instead. Check for `tf.theme`, which came with it:

```js
const canSide = typeof tf.theme === "function";
```

AI agents' browser tools never see a tile's own page in the dock.

## 9. Draw the page in Tilefold's colors

From **Tilefold 0.1.20**, every tile page, in a window, floating or docked, gets Tilefold's theme as **CSS variables** on its root, set before the page's own scripts run and again whenever the user changes the theme, switches between light and dark, or their system does. `color-scheme` is set to `light` or `dark` too.

| Variable | What it is |
|---|---|
| `--tf-pane` | A pane's background: use it to look like one of the user's panes |
| `--tf-surface`, `--tf-surface-raised`, `--tf-surface-hover`, `--tf-canvas` | Other backgrounds |
| `--tf-border`, `--tf-border-strong` | Borders |
| `--tf-text`, `--tf-text-secondary`, `--tf-text-muted` | Text |
| `--tf-accent`, `--tf-accent-soft`, `--tf-on-accent` | The accent, a faint one, and text on it |
| `--tf-success`, `--tf-error`, `--tf-warning`, `--tf-info` | Status colors |
| `--tf-focus-ring` | Focus outlines |

Give each a fallback for older Tilefolds:

```css
body { background: var(--tf-pane, #1d1f27); color: var(--tf-text, #e8e9f0); }
button { background: var(--tf-accent, #5b5bd6); color: var(--tf-on-accent, #fff); }
```

The page's scripts read the same with `window.tilefold.theme` (`{ mode, name, colors }`, or `null` on an older Tilefold) and hear changes with `window.tilefold.onTheme(fn)`, which returns a function that stops listening. The tile itself asks with `tf.theme()` and hears `theme.changed` (needs no permission). Only these colors and light or dark go out, nothing else about the window.

The **Quiz** example does both: its card docks beside the panes with a button, comes back out with another (or Tilefold's Undock), and is drawn in Tilefold's colors.

Copyright (c) 2026 Tilefold. Released under the MIT License.

