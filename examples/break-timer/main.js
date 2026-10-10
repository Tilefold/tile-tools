/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Break Timer (example tile)
 *
 * A TypeScript tile in three files: this entry, a small timer module and the
 * types of the `tf` calls it uses. "Start" sets a reminder; the time it
 * rings is kept with tf.store, so a reminder survives a restart of
 * Tilefold. Tile Tools compiles and bundles it all into main.js.
 *
 * Build:  npx @tilefold/tile-tools build
 */
// Built by @tilefold/tile-tools from src/main.ts. Edit the sources, then rebuild.
// src/timer.ts
var Reminder = class {
  timer = null;
  /** Rings `ring` at `at` (milliseconds since 1970), replacing any earlier reminder. */
  set(at, ring) {
    this.clear();
    this.timer = setTimeout(
      () => {
        this.timer = null;
        ring();
      },
      Math.max(0, at - Date.now())
    );
  }
  /** Forgets the reminder, if any. */
  clear() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
};
function minutesFrom(value, fallback = 50) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(240, n) : fallback;
}

// src/main.ts
var KEY = "ringsAt";
var main_default = (tf) => {
  const reminder = new Reminder();
  const ring = async () => {
    await tf.store.delete(KEY);
    await tf.toast(tf.t("toast-break"));
  };
  tf.setting("minutes", 50, tf.t("setting-minutes"));
  tf.command(
    tf.t("cmd-start"),
    async () => {
      const minutes = minutesFrom(tf.settings.get("minutes"));
      const at = Date.now() + minutes * 6e4;
      await tf.store.set(KEY, at);
      reminder.set(at, () => void ring());
      await tf.toast(tf.t("toast-started", { minutes }));
    },
    { id: "start" }
  );
  tf.command(
    tf.t("cmd-stop"),
    async () => {
      reminder.clear();
      await tf.store.delete(KEY);
      await tf.toast(tf.t("toast-stopped"));
    },
    { id: "stop" }
  );
  tf.on("app.ready", async () => {
    const at = Number(await tf.store.get(KEY));
    if (Number.isFinite(at) && at > 0) reminder.set(at, () => void ring());
  });
};
export default main_default;
