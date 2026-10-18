/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Screensaver Themes — Starfield
 *
 * Flying through stars: each star has a place in front of the viewer and
 * comes closer every frame, growing and brightening as it does; one that
 * passes the viewer or leaves the window starts again far away. How many
 * stars there are follows the window's size. Movement is measured in time,
 * not frames, so the speed is the same at any frame rate.
 */

/** Fewest and most stars, and how many CSS pixels of window each one gets. */
export const MIN_STARS = 150;
export const MAX_STARS = 800;
const PIXELS_PER_STAR = 2500;

/** How much closer a star comes in a second at normal speed (1 = the whole depth). */
const DEPTH_PER_SECOND = 0.25;

/** The nearest a star gets before it starts again far away. */
const NEAREST = 0.02;

/**
 * Creates the starfield. Call `draw` once per frame with the frame Tilefold
 * gives and the color and speed to use.
 *
 * @param {() => number} random Numbers in [0, 1).
 */
export function createStarfield(random) {
  /**
   * Stars: z is the distance (1 far, near 0); x / z and y / z are where the
   * star shows, from -1 to 1 across the window, so every star starts inside it.
   */
  let stars = [];
  let width = 0;
  let height = 0;

  /** A star at distance `z` (at least 0.1), somewhere inside the window. */
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
        const count = Math.round((width * height) / PIXELS_PER_STAR);
        const target = Math.min(MAX_STARS, Math.max(MIN_STARS, count));
        while (stars.length < target) stars.push(star());
        stars.length = target;
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = f.colors.background || "#000";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = look.color;

      const step = DEPTH_PER_SECOND * look.speed * (Math.max(0, Math.min(f.dt, 250)) / 1000);
      const cx = width / 2;
      const cy = height / 2;
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        s.z -= step;
        // Across the whole window, its width and its height alike.
        const px = cx + (s.x / s.z) * cx;
        const py = cy + (s.y / s.z) * cy;
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
    },
  };
}
