# Your first tile

This guide builds a small tile from an empty folder: a command, a setting, translated strings, and a request to a web service. It takes about fifteen minutes. You need Tilefold and [Node.js](https://nodejs.org) 22 or later.

## 1. Make the folder

In Tilefold, open **Settings → Tiles** and click **Open tiles folder** (usually `~/.tilefold/tiles/`). Make a folder for your tile there, `quote`:

```text
quote/
  tile.json
  locales/en/tile.ftl
  src/main.js
```

You can also work anywhere else and copy the folder in when you want to try it.

## 2. Say who the tile is

`tile.json` needs an `id` (`publisher.name`, lowercase) and a `version`:

```json
{
  "id": "you.quote",
  "version": "0.1.0",
  "name": "%tile-name%",
  "description": "%tile-description%"
}
```

`%tile-name%` tells Tilefold to show the `tile-name` message in the user's language. The [tile.json reference](tile-json.md) lists every field.

## 3. Write the strings

`locales/en/tile.ftl`:

```ftl
tile-name = Quote
tile-description = Shows a quote when you ask for one.
setting-author = Only quotes by
cmd-quote = Quote: Show a quote
quote = “{ $text }” ({ $author })
```

Add `locales/<lang>/tile.ftl` with the same keys for other languages; Tilefold picks the user's language and falls back to English.

## 4. Write the code

`src/main.js`:

```js
/** Quote (a first tile). */
export default (tf) => {
  // Register everything first, before any await, the same way every time.
  tf.setting("author", "", tf.t("setting-author"));

  tf.command(
    tf.t("cmd-quote"),
    () => tf.toast(tf.t("quote", { text: "Simplicity is prerequisite for reliability.", author: "Dijkstra" })),
    { id: "show-quote" }, // an id keeps the command stable when its title is translated
  );
};
```

## 5. Build and load it

```sh
cd ~/.tilefold/tiles/quote
npx @tilefold/tile-tools build --watch
```

Tile Tools bundles `src/main.js` and everything it imports into `main.js`, and rebuilds on every save. In Tilefold, click **Reload tiles** in Settings → Tiles. Your tile appears with **Allow**; Tilefold lists what it adds (one command, one setting) and asks for nothing else. Allow it, open the palette and run **Quote: Show a quote**.

After each change: save, wait for the rebuild, click **Reload tiles**. When something goes wrong, the tile's card says why it couldn't load, and **Log** shows what it wrote with `tf.log`.

## 6. Reach the internet

Let's fetch quotes from a web service. Ask for its host in `tile.json`, with the reason the user will read:

```json
"permissions": [{ "net:api.quotable.example": "to fetch a random quote" }]
```

Then replace the command in `src/main.js` with one that fetches in the background, so it returns at once (a command has ten seconds; a request may take thirty):

```js
async function showQuote() {
  if (!tf.net) return tf.toast(tf.t("update-tilefold"));
  try {
    const author = String(tf.settings.get("author") || "");
    const url = `https://api.quotable.example/random${author ? `?author=${encodeURIComponent(author)}` : ""}`;
    const res = await tf.net.fetch(url);
    if (!res.ok) return tf.toast(tf.t("no-quote"));
    const { content, author: by } = await res.json();
    await tf.toast(tf.t("quote", { text: content, author: by }));
  } catch (err) {
    // Tilefold names its errors: PermissionDeniedError, RateLimitError, NetworkError, …
    await tf.toast(tf.t(err.name === "PermissionDeniedError" ? "not-allowed" : "no-quote"));
  }
}

tf.command(tf.t("cmd-quote"), () => void showQuote(), { id: "show-quote" });
```

(Add the `update-tilefold`, `no-quote` and `not-allowed` messages to your `tile.ftl`.) Reload: because the tile now asks for a new permission, Tilefold asks the user again. The [network guide](network.md) covers API keys, sign-ins and every rule.

## 7. Test it

Keep logic that doesn't need Tilefold in its own modules, such as parsing an answer or choosing a message, and test them like any JavaScript. To test the tile as a whole, run its built `main.js` against a fake `tf`. This repository's `test/fake-host.mjs` is one you can copy: it records registrations, notices, storage, audit records and requests, and answers `tf.net.fetch` and `tf.ai.ask` from functions you give it. The examples' tests show it in use:

```js
const host = await startTile("examples/service-status", {
  net: () => ({ status: 200, body: JSON.stringify({ status: { indicator: "none" } }) }),
});
await host.command("check-now");
await host.advance(0);
expect(host.toasts).toEqual(["GitHub: all systems operational."]);
```

Run `npx @tilefold/tile-tools build --check` in CI to make sure the `main.js` you commit is a fresh build of your sources.

## 8. Share it

A tile is its folder: `tile.json`, `main.js` and `locales/`. Share it as a Git repository or a zip; others copy it into their tiles folder, click **Reload tiles** and **Allow**. Commit the built `main.js`, so people can read exactly the code they allow. There is no Gallery or signing yet.

## Rules worth remembering

- **Register first, the same way every time.** Tilefold checks a tile in a dry run and the live run must register the same things.
- **Return from handlers quickly.** Half a second for events, ten seconds for commands; start slow work with `void work()`.
- **Ask only for what you need, and say why.** Every permission shows your reason to the user.
- **Never hold secrets.** Declare keys and sign-ins under `auth`; Tilefold keeps them and adds them to requests.
- **Tell errors apart by `err.name`.**
- **Translate everything the user reads** with `tf.t`.

## Next

- [The tf API](tf-api.md): everything a tile can call
- [Overlays and sounds](overlays-and-sounds.md)
- [Network, keys and sign-ins](network.md)
- [Asking Claude](ai.md)
- [Limits and errors](limits-and-errors.md)

Copyright (c) 2026 Tilefold. Released under the MIT License.
