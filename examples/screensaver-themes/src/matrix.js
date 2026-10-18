/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Screensaver Themes — Matrix rain
 *
 * Columns of glyphs falling down the window, each at its own speed, with a
 * bright glyph at the head of each column and a trail that fades behind
 * it. The trail is made by covering the last frame with a little of the
 * background each frame, so nothing has to be remembered per glyph; how
 * much is covered depends on the time since the last frame, so the trail
 * is just as long at 10 frames a second as at 30. A column that has left
 * the bottom starts again above the top, after a pause of its own.
 */

/** Half-width katakana, digits and a few symbols. */
export const GLYPHS = "ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789:.=*+-<>";

/** Rows a second a column falls at normal speed, slowest and fastest. */
export const MIN_SPEED = 8;
export const MAX_SPEED = 22;

/** How much of the last frame stays after 1/30 s (the rest is covered). */
const KEEP_PER_FRAME = 0.9;

/**
 * Creates the rain. Call `draw` once per frame with the frame Tilefold gives
 * and the color and speed to use.
 *
 * @param {() => number} random Numbers in [0, 1).
 */
export function createMatrixRain(random) {
  /** One entry per column: its row (fractional), its speed and its head glyph. */
  let columns = [];
  let width = 0;
  let height = 0;
  /** The glyph size in CSS pixels. */
  let size = 16;

  const glyph = () => GLYPHS[Math.floor(random() * GLYPHS.length)];
  /** A column starting `rowsAbove` rows above the top (0: right at it). */
  const column = (rowsAbove) => ({
    row: -rowsAbove,
    speed: MIN_SPEED + random() * (MAX_SPEED - MIN_SPEED),
    glyph: glyph(),
  });

  /** Fits the columns to a new size, keeping the ones that still fit. */
  const layout = (w, h) => {
    width = w;
    height = h;
    size = Math.min(22, Math.max(14, Math.round(w / 80)));
    const count = Math.ceil(w / size);
    const rows = Math.ceil(h / size);
    // New columns start at random heights, so the first frames aren't one flat line.
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
      // Cover a little of the last frame: the trail fades at the same pace at any frame rate.
      const dt = Math.max(0, Math.min(f.dt, 250));
      ctx.globalAlpha = 1 - Math.pow(KEEP_PER_FRAME, Math.max(dt, 1) / (1000 / 30));
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${size}px monospace`;
      ctx.textBaseline = "top";
      const rows = height / size;
      for (let i = 0; i < columns.length; i += 1) {
        let c = columns[i];
        const before = Math.floor(c.row);
        c.row += c.speed * look.speed * (dt / 1000);
        const now = Math.floor(c.row);
        const x = i * size;
        if (now !== before) {
          // The head moved on: the glyph it left becomes part of the trail.
          ctx.globalAlpha = 1;
          ctx.fillStyle = look.color;
          ctx.fillText(c.glyph, x, before * size);
          c.glyph = glyph();
        }
        if (now > rows) {
          // Off the bottom: start again above the top after a pause of its own.
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
    },
  };
}
