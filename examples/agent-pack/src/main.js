/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Agent Pack (example tile)
 *
 * Offers AI coding agents Tilefold doesn't know yet (Grok Build, Kimi CLI,
 * Mistral Vibe and others), one command each. Running one asks Tilefold to
 * add it to the user's own agents (`tf.agent.define`); Tilefold shows the
 * user the agent and its exact command first, and adds it only when they
 * press Add agent. A notice says how it went. The activity log records only
 * which preset was offered and whether it was added.
 *
 * Build:  npx @tilefold/tile-tools build
 */
import { PRESETS, resultKey } from "./presets.js";

export default (tf) => {
  for (const p of PRESETS) {
    tf.command(
      tf.t(p.titleKey),
      async () => {
        if (typeof tf.agent?.define !== "function") return tf.toast(tf.t("toast-needs-tilefold"));
        let r;
        try {
          r = await tf.agent.define({
            name: p.name,
            command: p.command,
            clear: p.clear,
            ...(p.title ? { title: p.title } : {}),
          });
        } catch (err) {
          // Busy with another question, asked too often, or not allowed.
          return tf.toast(tf.t("toast-failed", { reason: String((err && err.name) || err) }));
        }
        await tf.audit("offered", { preset: p.id, added: r?.added === true });
        return tf.toast(tf.t(resultKey(r), { name: p.name }));
      },
      { id: `add-${p.id}` },
    );
  }
};
