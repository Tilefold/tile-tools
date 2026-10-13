# Overlays and sounds

A tile can draw small pictures above the panes, such as a pet walking along a pane or a now-playing card in a corner, and play short sounds. Tilefold draws and plays them itself: the tile's code stays in its worker and only sends a description, so nothing a tile sends can run inside Tilefold's window. The **Tilefold Pet**, **Tilefall** and **Tuneboard** examples use both.

## Overlays (permission window.overlay)

### A scene

A tile has one scene: a list of up to 8 items. Each item is a picture placed in the window's content area, in CSS pixels.

```js
const shown = await tf.overlay.show({
  items: [
    {
      id: "pet",
      image: "data:image/svg+xml;base64,…", // or a PNG, GIF, WebP or JPEG data URL
      x: 40, y: 600, w: 64, h: 64,
      anim: "breathe",
      hit: true, cursor: "grab",
      label: "Tessa the cat",
    },
  ],
});
if (!shown) {
  // The user has overlays hidden. Keep your state; show again later.
}
```

| Field | Default | What it does |
|---|---|---|
| `id` | required | 1–32 letters, digits, `-` or `_`, unique in the scene |
| `image` | required | A `data:image/…` URL of a PNG, GIF, WebP, JPEG or SVG picture. An SVG shown as an image can't run scripts or load anything |
| `x`, `y` | 0 | Left and top in the content area |
| `w`, `h` | 48 | Size, 1 to 256 pixels a side |
| `flip` | `false` | Mirror left to right |
| `sheet` | none | `{ frames, fps }`: the image is a sprite sheet with `frames` cells side by side (up to 64), played at `fps` (up to 30) |
| `anim` | `"none"` | A built-in loop while the item stands: `breathe`, `bob`, `bounce`, `shake` or `spin` |
| `moveMs` | 0 | When `x` or `y` changes, glide there over this many milliseconds (up to 20,000) instead of jumping |
| `bubble` | none | A speech bubble above the item, at most 80 characters |
| `hit` | `false` | Whether clicks and drags on the item reach the tile |
| `cursor` | `"pointer"` | The cursor over an item with `hit`: `default`, `pointer` or `grab` |
| `label` | none | What screen readers call the item (at most 80 characters); without one it is decorative |
| `opacity` | 1 | 0 to 1 |

All the pictures of a scene together may be about 1 MB of data URL text. Numbers out of range are clamped; anything else that is wrong fails the call with a `TypeError` naming the item and the field.

### Calls

| Call | What it does |
|---|---|
| `tf.overlay.show(scene)` | Draws the scene, replacing any earlier one. Resolves `true` when it is drawn and `false` while the user has overlays hidden (the scene is kept) |
| `tf.overlay.update({ items, remove })` | Changes only the fields you give, by item `id`, adds items with new ids, and removes the ids in `remove`. Move an item without sending its picture again. Fails if nothing is shown yet |
| `tf.overlay.hide()` | Takes the scene away |
| `tf.overlay.layout()` | The current layout (below) |

A tile may change its scene up to 60 times a second; more fail with `RateLimitError`. For smooth movement, prefer one `update` with a `moveMs` over many small steps.

### The layout

`tf.overlay.layout()` and the `overlay.layout` event give rectangles only, never what is in a pane:

```js
{
  content: { w: 1200, h: 800 },
  panes: [
    {
      id: "p1",          // opaque, the same for this pane for the rest of the session
      x: 0, y: 40, w: 1200, h: 730,
      focused: true,
      composer: { x: 0, y: 724, w: 1200, h: 46 }, // the command editor row, or null
    },
  ],
}
```

Listen to `overlay.layout` to follow panes as they open, close, move and change focus.

### Pointer events

Items with `hit: true` send `overlay.pointer` with `{ item, type, x, y }`, where `type` is `click`, `dblclick`, `dragstart`, `drag` or `drop`, and `x`, `y` are in the content area. Clicks never reach an item over the Composer, the tab bar or the title bar, or for two seconds after the user pressed a key, so an overlay can't get in the way of typing.

### The user is in charge

- **Hide or show tile overlays**, in the View menu and the palette (⌥⌘O; Ctrl+Alt+O on Windows and Linux), hides every tile's overlay, and right-clicking an item lets the user hide just that tile's. The tile gets `overlay.hidden` with `{ by: "user" }`, its scene is kept, and `show` and `update` resolve `false` until the user shows overlays again.
- Overlays always stay below Tilefold's menus, the palette, Settings, notices and the curtain.
- Animations pause a minute after the user switches to another app, and stop when the system asks for reduced motion.
- Showing and hiding a tile's overlay is recorded in the activity log; moves are not.
- Turning a tile off removes its scene.

## Sounds (permission sound.play)

```js
const heard = await tf.sound.play({ src: "data:audio/wav;base64,…", volume: 0.6 });
```

| | |
|---|---|
| Clip | A base64 `data:` URL of WAV (`audio/wav`, `audio/x-wav`), MP3 (`audio/mpeg`), Ogg (`audio/ogg`) or WebM (`audio/webm`) audio, at most 400,000 characters (about 300 KB of audio). Pass the URL alone or `{ src, volume }` |
| Volume | 0 to 1; 1 when left out |
| Result | `true` when it will be heard; `false` when the user has turned tile sounds off, before the window is ready to play, or at volume 0 |
| Limits | 2 sounds a second and 30 a minute per tile; more fail with `RateLimitError`. A new sound from a tile stops its previous one |

Users can mute every tile with **Play tile sounds** in Settings. The first sound each tile plays in a session is recorded in the activity log.

Small sounds can be made in code instead of shipped: the Tilefold Pet example builds its barks as WAV bytes and encodes them with `btoa`.

Copyright (c) 2026 Tilefold. Released under the MIT License.
