/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Agent Pack (example tile)
 *
 * Adds AI coding agents to the user's own agents in two ways. **Add your
 * own agent…** opens a panel where the user types any agent's name and
 * command, picks what clears its context and presses Add this agent; the
 * panel also lists the ready-made agents (Grok Build, Kimi CLI, Mistral
 * Vibe and others), which are one palette command each too. Every offer
 * goes through `tf.agent.define`: Tilefold shows the user the agent and its
 * exact command first, and adds it only when they press Add agent. A
 * notice says how it went. The activity log records only which preset was
 * offered (or that it was the user's own) and whether it was added, never
 * a name or a command. What the user types is kept to 4,096 characters
 * and shown without hidden characters, and only one offer is open at a time.
 *
 * Build:  npx @tilefold/tile-tools build
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/ownAgent.js
var MAX_NAME = 60;
var MAX_ARGS = 16;
var MAX_WORD = 256;
var CLEARS = ["/clear", "/new", ""];
var SAFE_WORD = /^[A-Za-z0-9._,:=@%+/~-]+$/;
var HIDDEN = new RegExp(
  "[\\u0000-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]"
);
var MAX_TYPED = 4096;
var typed = (text) => typeof text === "string" ? text.slice(0, MAX_TYPED) : "";
var visible = (text) => text.replace(new RegExp(HIDDEN.source, "g"), "");
var emptyDraft = () => ({ name: "", command: "", clear: "/clear" });
function nameProblem(name) {
  const n = name.trim();
  if (!n) return "own-problem-name-empty";
  if ([...n].length > MAX_NAME || HIDDEN.test(n)) return "own-problem-name";
  return null;
}
var commandWords = (command) => command.trim().split(/\s+/).filter(Boolean);
function commandProblem(command) {
  const words = commandWords(command);
  if (words.length === 0) return "own-problem-command-empty";
  if (words.length > MAX_ARGS + 1) return "own-problem-command-long";
  if (words.some((w) => w.length > MAX_WORD || !SAFE_WORD.test(w))) {
    return "own-problem-command-chars";
  }
  return null;
}
var nextClear = (clear) => CLEARS[(CLEARS.indexOf(clear) + 1) % CLEARS.length];
var draftProblem = (draft) => nameProblem(draft.name) ?? commandProblem(draft.command);
var toDefinition = (draft) => ({
  name: draft.name.trim(),
  command: commandWords(draft.command).join(" "),
  clear: draft.clear
});

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

// src/panel.js
var ROW = {
  nameField: "own-name",
  commandField: "own-command",
  name: "own-name-now",
  command: "own-command-now",
  clear: "own-clear",
  problem: "own-problem",
  add: "own-add",
  start: "own-start-over"
};
var SHOWN = 120;
var shorten = (text) => {
  const chars = [...visible(text)];
  return chars.length > SHOWN ? `${chars.slice(0, SHOWN - 1).join("")}\u2026` : chars.join("");
};
var presetRow = (id) => `preset:${id}`;
function clickTarget(row) {
  if (row === ROW.add) return { kind: "add" };
  if (row === ROW.clear) return { kind: "clear" };
  if (row === ROW.start) return { kind: "start" };
  if (row.startsWith("preset:")) {
    const preset = PRESETS.find((p) => presetRow(p.id) === row);
    return preset ? { kind: "preset", preset } : null;
  }
  return null;
}
var clearLabel = (t, clear) => t("own-clear", { how: clear === "" ? t("own-clear-none") : clear });
function panelContent(t, draft) {
  const problem = draftProblem(draft);
  const typed2 = draft.name.trim() !== "" || draft.command.trim() !== "";
  const showProblem = problem && typed2 && !(problem === "own-problem-name-empty" && !draft.name) && !(problem === "own-problem-command-empty" && !draft.command);
  const rows = [
    { id: "own", label: t("own-section"), section: true },
    {
      id: ROW.nameField,
      label: t("own-name-field"),
      input: { kind: "text", placeholder: t("own-name-placeholder") }
    },
    {
      id: ROW.commandField,
      label: t("own-command-field"),
      input: { kind: "text", placeholder: t("own-command-placeholder") }
    },
    draft.name.trim() ? {
      id: ROW.name,
      label: t("own-name-now", { name: shorten(draft.name.trim()) }),
      icon: "info"
    } : { id: ROW.name, label: t("own-name-unset"), muted: true },
    draft.command.trim() ? {
      id: ROW.command,
      label: t("own-command-now", { command: shorten(commandWords(draft.command).join(" ")) }),
      icon: "info"
    } : { id: ROW.command, label: t("own-command-unset"), muted: true },
    { id: ROW.clear, label: clearLabel(t, draft.clear), hint: t("own-clear-hint") }
  ];
  if (showProblem) rows.push({ id: ROW.problem, label: t(problem), icon: "error", tone: "error" });
  rows.push(
    problem ? { id: ROW.add, label: t("own-add"), muted: true, hint: t("own-add-hint") } : { id: ROW.add, label: t("own-add"), tone: "accent" }
  );
  if (typed2) rows.push({ id: ROW.start, label: t("own-start-over"), muted: true });
  rows.push({ id: "ready", label: t("ready-section"), section: true });
  for (const p of PRESETS) {
    rows.push({ id: presetRow(p.id), label: p.name, trail: p.command, hint: t("ready-hint") });
  }
  return { title: t("panel-title"), rows };
}

// src/main.js
var main_default = (tf) => {
  let draft = emptyDraft();
  let asking = false;
  async function offer(agent, details) {
    if (typeof tf.agent?.define !== "function") {
      await tf.toast(tf.t("toast-needs-tilefold"));
      return false;
    }
    if (asking) return false;
    asking = true;
    let r;
    try {
      r = await tf.agent.define(agent);
    } catch (err) {
      await tf.toast(
        tf.t("toast-failed", { reason: String(err && err.name || err).slice(0, 64) })
      );
      return false;
    } finally {
      asking = false;
    }
    const added = r?.added === true;
    await tf.audit("offered", { ...details, added });
    await tf.toast(tf.t(resultKey(r), { name: agent.name }));
    return added;
  }
  const offerPreset = (p) => offer(
    { name: p.name, command: p.command, clear: p.clear, ...p.title ? { title: p.title } : {} },
    { preset: p.id }
  );
  async function draw() {
    if (!tf.panel) return;
    await tf.panel.show(panelContent(tf.t, draft));
  }
  async function offerOwn() {
    if (draftProblem(draft)) return draw();
    if (await offer(toDefinition(draft), { preset: "own" })) draft = emptyDraft();
    return draw();
  }
  tf.command(
    tf.t("cmd-add-own"),
    async () => {
      if (typeof tf.agent?.define !== "function" || !tf.panel) {
        return tf.toast(tf.t("toast-needs-tilefold"));
      }
      return draw();
    },
    { id: "add-own" }
  );
  for (const p of PRESETS)
    tf.command(tf.t(p.titleKey), () => offerPreset(p), { id: `add-${p.id}` });
  tf.on("panel.input", ({ row, text }) => {
    if (typeof text !== "string") return;
    if (row === ROW.nameField) draft = { ...draft, name: typed(text) };
    else if (row === ROW.commandField) draft = { ...draft, command: typed(text) };
    else return;
    return draw();
  });
  tf.on("panel.click", ({ row }) => {
    const target = typeof row === "string" ? clickTarget(row) : null;
    if (!target) return;
    if (target.kind === "add") return offerOwn();
    if (target.kind === "preset") return offerPreset(target.preset);
    if (target.kind === "clear") draft = { ...draft, clear: nextClear(draft.clear) };
    if (target.kind === "start") draft = emptyDraft();
    return draw();
  });
};
export default main_default;
