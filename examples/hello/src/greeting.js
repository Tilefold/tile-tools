/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Hello — which greeting fits the hour. A plain module: it knows nothing
 * about Tilefold, so it is easy to test on its own.
 */

/**
 * The message key for a greeting at `hour` (0–23).
 *
 * @param {number} hour
 * @returns {"greeting-morning" | "greeting-afternoon" | "greeting-evening"}
 */
export function greetingKey(hour) {
  if (hour >= 5 && hour < 12) return "greeting-morning";
  if (hour >= 12 && hour < 18) return "greeting-afternoon";
  return "greeting-evening";
}
