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
