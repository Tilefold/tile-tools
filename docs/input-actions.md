# Buttons in the agent input box

From Tilefold 0.1.27, users can write to the AI agent in a pane (Claude Code, Codex, Gemini and the rest) in Tilefold's own input box under the terminal. A tile with the `input.actions` permission can add a button to that box. When the user clicks it, and only then, the tile gets what the box holds and can offer new text back. Tilefold puts the new text in the box with every change highlighted and an Undo. It never sends anything: the user still presses Enter.

The **Promptsmith** example (`examples/prompt-polish`) uses it: its **✦ Polish** button opens the tile's card with the prompt in it and the check already running, and **Use** puts the corrected prompt back in the box.

## 1. Ask for the permission

```json
"permissions": [
  { "input.actions": "to correct the prompt you wrote when you click Polish" }
]
```

`input.actions` is rated high on the consent screen, because prompts can hold private details. Adding it to an installed tile asks the user again. A tile that calls `tf.input.action` without asking for it doesn't load.

## 2. Add the button

Register it up front, as you register commands:

```js
export default (tf) => {
  if (typeof tf.input?.action === "function") {
    tf.input.action({ id: "polish", label: tf.t("polish-label") });
  }
};
```

- `id`: 1–32 lowercase letters, digits and dashes, unique in the tile.
- `label`: 1–24 characters on one line, in the user's language. Tilefold shows your tile's name with it.
- At most 2 buttons per tile. The box shows 4 in all and puts the rest under **⋯**.

The button shows once the box holds text. It's off when the box holds more than 8,000 characters, and ignores a click right after a key, so the user's typing doesn't trigger it.

### View buttons (Tilefold 0.1.29)

A button that only shows or hides something of yours for that pane (a card, a panel) never needs the user's words. Mark it `view: true`:

```js
tf.input.action({ id: "card", label: tf.t("card-label"), view: true });
```

- A click arrives as `input.action` with `{ action, view: true, language, spot }`: no `text`, no `request`, so there is nothing to answer or release.
- It shows even while the box is empty, and stays clickable while your tile works on a click of its other button, so the user can bring back or hide a card mid-check. From Tilefold 0.1.33 it doesn't spin meanwhile (only the button being worked on does); earlier versions spin it too.
- It counts toward the 2 buttons per tile. Turning a view button into an ordinary one (or back) changes the tile's consent fingerprint, so Tilefold asks the user to approve the tile again.
- An older Tilefold treats it as an ordinary button: the click carries the box's text and a request. Release that request at once, unused:

```js
tf.on("input.action", (e) => {
  if (e.action === "card") {
    if (typeof e.request === "string") void tf.input.release(e.request); // an older Tilefold
    void toggleCard(e.spot);
    return;
  }
  void polish(e);
});
```

## 3. Hear the click

```js
tf.on("input.action", (e) => {
  // e = { action: "polish", request: "k3…", text: "…", language: "ko", spot: { x, y, w, h } }
  void polish(e); // return at once: listeners get half a second
});
```

- `text` is what the box held when clicked, with anything that looks like a key, a token, a password or a private key replaced by `[redacted]`, as for `tf.ai.ask`.
- `request` answers this click only.
- `language` is the user's Tilefold language.
- `spot` is where the box is in the window, so you can open a card right above it (`tf.page.open({ dock })`).
- The event never names the pane or the agent. Agents can't trigger it: only the user's click does.
- A tile gets at most 10 clicks a minute, and one at a time per pane.
- While you work on a click, your button spins with a **×** beside it. When the user clicks ×, you get `input.cancelled` (`{ request }`): close whatever you opened for that click. The button is free again at once.

```js
tf.on("input.cancelled", (e) => void closeCardFor(e.request));
```

## 4. Answer

```js
const r = await tf.input.replace(e.request, { text: better });
// { done: true }, or { done: false, why: "changed" | "expired" | "gone" | "stopped" }
```

`replace` puts `text` in the box in place of what was clicked. Tilefold compares the old and new text itself and highlights every changed word, says how many places changed, and offers Undo. If your text keeps every `[redacted]` in place and in order, the user's own words go back where they were.

| `why` | What happened | What to do |
|---|---|---|
| `changed` | The user edited the box after clicking; nothing was replaced | Say so, and suggest clicking the button again |
| `expired` | More than 10 minutes passed | The same |
| `gone` | The pane closed, or the box was switched off | Nothing to do |
| `stopped` | The user clicked × to stop waiting (you also got `input.cancelled`) | Nothing to do |

Each request is answered once. Text longer than four times the clicked text plus 3,000 characters (8,000 at most), or another request's id, throws a `TypeError`. Tilefold strips control characters, escape sequences and characters that change reading direction from what you send.

When the user pressed your own **Send** (not Use), pass `send: true`: Tilefold puts the text in the box as above and then sends it, exactly as Enter would. If the agent is busy, it waits in the box. Use it only for that button.

```js
await tf.input.replace(e.request, { text: better, send: true });
```

When the user keeps their own words, end the request:

```js
await tf.input.release(e.request);
```

## 5. Keeping out of the way

A tile that also draws over the panes (`window.overlay`) and holds `input.actions` sees `agentInput: true` on a pane in `tf.overlay.layout()` and the `overlay.layout` event when that pane's row is the agent input box. Promptsmith uses it to hide its own pill there, since its buttons are in the box (and its Card view button brings a folded card back). Other tiles don't see it.

## Testing

`test/fake-host.mjs` adds `tf.input` with `input: true` (or `input: { text, language }`). `host.clickAction(id)` plays a click on the box's text (`host.box.text`) and resolves to the request id; `host.box.replaced` and `host.box.released` record the answers; change `host.box.text`, call `host.expireInput()` or `host.closeBox()` to get `changed`, `expired` or `gone`; `host.stopAction()` plays the user's × (`input.cancelled`, then `stopped`). A click on a view button (`host.clickAction("card")`) resolves to `null`: it carries no request. See `test/fake-input.test.mjs` and `test/prompt-polish/input-action.test.mjs`.

Copyright (c) 2026 Tilefold. Released under the MIT License.
