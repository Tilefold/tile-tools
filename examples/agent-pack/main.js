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
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/presets.js
var PRESETS = [
  {
    id: "grok",
    titleKey: "cmd-add-grok",
    name: "Grok Build",
    command: "grok",
    title: "Grok",
    clear: "/clear"
  },
  {
    id: "kimi",
    titleKey: "cmd-add-kimi",
    name: "Kimi CLI",
    command: "kimi",
    title: "Kimi",
    clear: "/clear"
  },
  {
    id: "vibe",
    titleKey: "cmd-add-vibe",
    name: "Mistral Vibe",
    command: "vibe",
    title: "Vibe",
    clear: "/clear"
  },
  {
    id: "qwen",
    titleKey: "cmd-add-qwen",
    name: "Qwen Code",
    command: "qwen",
    title: "Qwen Code",
    clear: "/clear"
  },
  { id: "aider", titleKey: "cmd-add-aider", name: "Aider", command: "aider", clear: "/clear" },
  { id: "goose", titleKey: "cmd-add-goose", name: "Goose", command: "goose", clear: "" },
  { id: "crush", titleKey: "cmd-add-crush", name: "Crush", command: "crush", clear: "" }
];
function resultKey(r) {
  if (r && r.added === true) return "toast-added";
  switch (r && r.why) {
    case "exists":
      return "toast-exists";
    case "declined":
      return "toast-declined";
    case "full":
      return "toast-full";
    default:
      return "toast-refused";
  }
}

// src/main.js
var main_default = (tf) => {
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
            ...p.title ? { title: p.title } : {}
          });
        } catch (err) {
          return tf.toast(tf.t("toast-failed", { reason: String(err && err.name || err) }));
        }
        await tf.audit("offered", { preset: p.id, added: r?.added === true });
        return tf.toast(tf.t(resultKey(r), { name: p.name }));
      },
      { id: `add-${p.id}` }
    );
  }
};
export default main_default;
