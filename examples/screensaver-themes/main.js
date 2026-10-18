/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Screensaver Themes
 *
 * Two themes for Tilefold's screensaver: Matrix (columns of falling green
 * glyphs) and Starfield (flying through stars). Pick one in Settings →
 * Screensaver → Theme; this tile's settings choose the color and speed.
 *
 * It shows what a screensaver theme tile is (Tilefold 0.1.12): it asks for
 * `screensaver.theme` and nothing else, and adds themes with
 * `tf.screensaver.theme(id, name, draw)`. Tilefold calls `draw` once per
 * frame, at most 30 times a second, with a Canvas 2D context covering the
 * window; the theme gets no input and nothing from the screen. Each start
 * draws afresh (frame 0), with new random columns and stars.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/matrix.js
var GLYPHS = "\uFF66\uFF71\uFF73\uFF74\uFF75\uFF76\uFF77\uFF79\uFF7A\uFF7B\uFF7C\uFF7D\uFF7E\uFF7F\uFF80\uFF82\uFF83\uFF85\uFF86\uFF87\uFF88\uFF8A\uFF8B\uFF8E\uFF8F\uFF90\uFF91\uFF92\uFF93\uFF94\uFF95\uFF97\uFF98\uFF9C0123456789:.=*+-<>";
var MIN_SPEED = 8;
var MAX_SPEED = 22;
var KEEP_PER_FRAME = 0.9;
function createMatrixRain(random) {
  let columns = [];
  let width = 0;
  let height = 0;
  let size = 16;
  const glyph = () => GLYPHS[Math.floor(random() * GLYPHS.length)];
  const column = (rowsAbove) => ({
    row: -rowsAbove,
    speed: MIN_SPEED + random() * (MAX_SPEED - MIN_SPEED),
    glyph: glyph()
  });
  const layout = (w, h) => {
    width = w;
    height = h;
    size = Math.min(22, Math.max(14, Math.round(w / 80)));
    const count = Math.ceil(w / size);
    const rows = Math.ceil(h / size);
    while (columns.length < count) columns.push(column(Math.floor(random() * rows)));
    columns.length = count;
  };
  return {
    /** The glyph size and each column's row (for tests). */
    state: () => ({ size, columns: columns.map((c) => c.row) }),
    /**
     * Draws one frame.
     *
     * @param {{ ctx: any, width: number, height: number, dt: number,
     *           colors: { background?: string } }} f The frame.
     * @param {{ color: string, speed: number }} look
     */
    draw(f, look) {
      const { ctx } = f;
      const background = f.colors.background || "#000";
      if (f.width !== width || f.height !== height) {
        layout(f.width, f.height);
        ctx.globalAlpha = 1;
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
      }
      const dt = Math.max(0, Math.min(f.dt, 250));
      ctx.globalAlpha = 1 - Math.pow(KEEP_PER_FRAME, Math.max(dt, 1) / (1e3 / 30));
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${size}px monospace`;
      ctx.textBaseline = "top";
      const rows = height / size;
      for (let i = 0; i < columns.length; i += 1) {
        let c = columns[i];
        const before = Math.floor(c.row);
        c.row += c.speed * look.speed * (dt / 1e3);
        const now = Math.floor(c.row);
        const x = i * size;
        if (now !== before) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = look.color;
          ctx.fillText(c.glyph, x, before * size);
          c.glyph = glyph();
        }
        if (now > rows) {
          c = columns[i] = column(Math.floor(random() * rows * 0.5));
          continue;
        }
        if (now >= 0) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = "#f2fff4";
          ctx.fillText(c.glyph, x, now * size);
        }
      }
      ctx.globalAlpha = 1;
    }
  };
}

// src/palette.js
var COLORS = {
  green: "#39ff6a",
  amber: "#ffb000",
  blue: "#4fc3ff",
  theme: null
};
var SPEEDS = { slow: 0.6, normal: 1, fast: 1.6 };
function colorFor(choice, colors) {
  if (choice === "theme") return colors.accent || COLORS.green;
  return Object.hasOwn(COLORS, choice) && COLORS[choice] ? COLORS[choice] : COLORS.green;
}
function speedFor(choice) {
  return Object.hasOwn(SPEEDS, choice) ? SPEEDS[choice] : SPEEDS.normal;
}

// src/random.js
function seededRandom(seed) {
  let state = Math.trunc(seed) >>> 0 || 2654435769;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

// src/starfield.js
var MIN_STARS = 150;
var MAX_STARS = 800;
var PIXELS_PER_STAR = 2500;
var DEPTH_PER_SECOND = 0.25;
var NEAREST = 0.02;
function createStarfield(random) {
  let stars = [];
  let width = 0;
  let height = 0;
  const star = (z = random()) => {
    const d = Math.max(z, 0.1);
    return { x: (random() * 2 - 1) * d, y: (random() * 2 - 1) * d, z: d };
  };
  return {
    /** The stars (for tests). */
    state: () => stars.map((s) => ({ ...s })),
    /**
     * Draws one frame.
     *
     * @param {{ ctx: any, width: number, height: number, dt: number,
     *           colors: { background?: string } }} f The frame.
     * @param {{ color: string, speed: number }} look
     */
    draw(f, look) {
      const { ctx } = f;
      if (f.width !== width || f.height !== height) {
        width = f.width;
        height = f.height;
        const count = Math.round(width * height / PIXELS_PER_STAR);
        const target = Math.min(MAX_STARS, Math.max(MIN_STARS, count));
        while (stars.length < target) stars.push(star());
        stars.length = target;
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = f.colors.background || "#000";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = look.color;
      const step = DEPTH_PER_SECOND * look.speed * (Math.max(0, Math.min(f.dt, 250)) / 1e3);
      const cx = width / 2;
      const cy = height / 2;
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        s.z -= step;
        const px = cx + s.x / s.z * cx;
        const py = cy + s.y / s.z * cy;
        if (s.z <= NEAREST || px < 0 || px >= width || py < 0 || py >= height) {
          stars[i] = star(1);
          continue;
        }
        const near = 1 - s.z;
        const r = 0.5 + near * 2.5;
        ctx.globalAlpha = Math.min(1, 0.2 + near);
        ctx.fillRect(px - r / 2, py - r / 2, r, r);
      }
      ctx.globalAlpha = 1;
    }
  };
}

// src/main.js
var main_default = (tf) => {
  tf.setting("color", "green", tf.t("setting-color"), {
    choices: [
      { value: "green", label: tf.t("color-green") },
      { value: "amber", label: tf.t("color-amber") },
      { value: "blue", label: tf.t("color-blue") },
      { value: "theme", label: tf.t("color-theme") }
    ]
  });
  tf.setting("speed", "normal", tf.t("setting-speed"), {
    choices: [
      { value: "slow", label: tf.t("speed-slow") },
      { value: "normal", label: tf.t("speed-normal") },
      { value: "fast", label: tf.t("speed-fast") }
    ]
  });
  if (!tf.screensaver) return;
  const look = (colors) => ({
    color: colorFor(tf.settings.get("color"), colors),
    speed: speedFor(tf.settings.get("speed"))
  });
  const theme = (create) => {
    let current = null;
    return (f) => {
      if (f.frame === 0 || !current) current = create(seededRandom(Date.now()));
      current.draw(f, look(f.colors));
    };
  };
  tf.screensaver.theme("matrix", tf.t("theme-matrix"), theme(createMatrixRain));
  tf.screensaver.theme("starfield", tf.t("theme-starfield"), theme(createStarfield));
};
export default main_default;
