/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Agent Pack — the agents it offers
 *
 * Each preset is what `tf.agent.define` takes: the agent's name, the
 * command that starts it (its program, which must be installed and on the
 * user's PATH), words its terminal title shows, and what clears its
 * context. The user sees each one before it is added and can edit it in
 * Settings → Agents afterwards. Pure data.
 */

/**
 * The presets, by command id.
 *
 * @type {{ id: string, titleKey: string, name: string, command: string, title?: string,
 *   clear: "/clear" | "/new" | "" }[]}
 */
export const PRESETS = [
  {
    id: "grok",
    titleKey: "cmd-add-grok",
    name: "Grok Build",
    command: "grok",
    title: "Grok",
    clear: "/clear",
  },
  {
    id: "kimi",
    titleKey: "cmd-add-kimi",
    name: "Kimi CLI",
    command: "kimi",
    title: "Kimi",
    clear: "/clear",
  },
  {
    id: "vibe",
    titleKey: "cmd-add-vibe",
    name: "Mistral Vibe",
    command: "vibe",
    title: "Vibe",
    clear: "/clear",
  },
  {
    id: "qwen",
    titleKey: "cmd-add-qwen",
    name: "Qwen Code",
    command: "qwen",
    title: "Qwen Code",
    clear: "/clear",
  },
  { id: "aider", titleKey: "cmd-add-aider", name: "Aider", command: "aider", clear: "/clear" },
  { id: "goose", titleKey: "cmd-add-goose", name: "Goose", command: "goose", clear: "" },
  { id: "crush", titleKey: "cmd-add-crush", name: "Crush", command: "crush", clear: "" },
];

/** The message key that tells the user how an offer went. */
export function resultKey(r) {
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
