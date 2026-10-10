/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Break Timer — one reminder at a time. Knows nothing about Tilefold: it is
 * told when to ring and what to do then.
 */

export class Reminder {
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Rings `ring` at `at` (milliseconds since 1970), replacing any earlier reminder. */
  set(at: number, ring: () => void): void {
    this.clear();
    this.timer = setTimeout(
      () => {
        this.timer = null;
        ring();
      },
      Math.max(0, at - Date.now()),
    );
  }

  /** Forgets the reminder, if any. */
  clear(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}

/** Minutes from a setting value: a whole number from 1 to 240, else `fallback`. */
export function minutesFrom(value: unknown, fallback = 50): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(240, n) : fallback;
}
