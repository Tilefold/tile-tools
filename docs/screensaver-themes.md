# Screensaver themes

From **Tilefold 0.1.12**, Tilefold has a screensaver of its own: it covers the whole window after some idle minutes, when the user switches apps, or on demand, and can stay locked until the user unlocks. Tilefold draws two themes itself, **Blur** and **Clock**. A tile can add more, and they appear in **Settings → Screensaver → Theme** under **From tiles**.

The **Screensaver Themes** example (`examples/screensaver-themes`) adds two: falling green code (Matrix) and a starfield.

## 1. Ask for the permission, and nothing else

```json
"permissions": [{ "screensaver.theme": "to draw falling green code on the screensaver" }]
```

A tile that asks for `screensaver.theme` is a **theme tile**: it may ask for no other permission, and declare no keys or sign-ins (`auth`). Tilefold refuses to load one that does. So a theme can only draw, and the user can allow one without worry. Put anything else your tile does in a tile of its own.

## 2. Add a theme

```js
export default (tf) => {
  if (!tf.screensaver) return; // before Tilefold 0.1.12

  tf.screensaver.theme("stars", tf.t("theme-stars"), (f) => {
    f.ctx.fillStyle = f.colors.background;
    f.ctx.fillRect(0, 0, f.width, f.height);
    f.ctx.fillStyle = f.colors.accent;
    f.ctx.fillRect((f.time / 10) % f.width, f.height / 2, 4, 4);
  });
};
```

`tf.screensaver.theme(id, name, draw)`:

- `id`: a lowercase letter, then lowercase letters, digits or hyphens (64 characters at most), unique in the tile.
- `name`: what Settings shows, 60 characters at most; use `tf.t` so it is translated.
- `draw(frame)`: called once per frame while your theme is on screen.

Register themes when the tile starts, like commands and settings. A tile may add up to 12. Adding a theme counts as a change to your tile, so users are asked to allow it again.

## 3. Draw a frame

Tilefold asks for a frame at most 30 times a second, and only while the window can be seen. It asks for the next one only after your `draw` returns. Each call gets:

| Field | What it is |
|---|---|
| `ctx` | A Canvas 2D context covering the window, already scaled so you draw in CSS pixels |
| `width`, `height` | The window's size in CSS pixels |
| `time` | Milliseconds since this start of the theme |
| `dt` | Milliseconds since the last frame (0 on the first) |
| `frame` | The frame's number in this start, from 0 |
| `colors` | `{ background, text, accent }` from the user's Tilefold theme, as CSS colors |

The canvas keeps what you drew between frames, so a theme can fade the last frame instead of drawing everything again (the Matrix example does). It is cleared when the window is resized, and each start of the screensaver begins with an empty canvas and `frame` 0: start your animation afresh there.

**Move by time, not by frames.** Use `dt` (or `time`) for movement, so your theme runs at the same speed at 30 frames a second, at 10, and after a pause.

Only a 2D context is offered. Your tile's settings work as usual: read them in `draw` with `tf.settings.get`, and a change shows at the next frame.

## What a theme can't do

- It gets no keys, clicks or pointer positions. The user's first key or click goes to Tilefold, which ends the screensaver or asks to unlock.
- It can't see the user's terminals or anything else on screen: the canvas starts empty and holds only what you drew.
- It can't end the screensaver or unlock Tilefold, and Tilefold's own unlock prompt is always drawn above your theme.
- It can't reach the network or open pages (a theme tile has no other permission).

## When it goes wrong

Tilefold switches to its own **Blur** theme, and the window stays covered (and locked, if it was), when your theme:

- can't start, because the tile is off or the web view can't hand it a canvas;
- throws from `draw`;
- takes more than **two seconds** to finish a frame. The tile is then also stopped, as a crash.

Each switch goes in the activity log (`ui.screensaver.fallback`, with the reason). Errors from `draw` also appear in the tile's log in Settings → Tiles.

## Testing it

The fake Tilefold in this repository's tests can run a theme: start your built tile with `startTile(dir, { screensaver: true })`, then `host.drawTheme(id, { frames, dt, width, height })` plays a start's frames on a context that records every call (see `test/screensaver-themes.test.mjs`).

Copyright (c) 2026 Tilefold. Released under the MIT License.
