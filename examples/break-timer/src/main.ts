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
import { Reminder, minutesFrom } from "./timer";
import type { Tf } from "./tf";

const KEY = "ringsAt";

export default (tf: Tf): void => {
  const reminder = new Reminder();

  const ring = async (): Promise<void> => {
    await tf.store.delete(KEY);
    await tf.toast(tf.t("toast-break"));
  };

  // Register everything first, before any `await`.
  tf.setting("minutes", 50, tf.t("setting-minutes"));

  tf.command(
    tf.t("cmd-start"),
    async () => {
      const minutes = minutesFrom(tf.settings.get("minutes"));
      const at = Date.now() + minutes * 60_000;
      await tf.store.set(KEY, at);
      reminder.set(at, () => void ring());
      await tf.toast(tf.t("toast-started", { minutes }));
    },
    { id: "start" },
  );

  tf.command(
    tf.t("cmd-stop"),
    async () => {
      reminder.clear();
      await tf.store.delete(KEY);
      await tf.toast(tf.t("toast-stopped"));
    },
    { id: "stop" },
  );

  // When Tilefold starts, pick up a reminder that was running. Event
  // handlers have half a second, so do only quick work here.
  tf.on("app.ready", async () => {
    const at = Number(await tf.store.get(KEY));
    if (Number.isFinite(at) && at > 0) reminder.set(at, () => void ring());
  });
};
