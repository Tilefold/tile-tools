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
import { draftProblem, emptyDraft, nextClear, toDefinition, typed } from "./ownAgent.js";
import { clickTarget, panelContent, ROW } from "./panel.js";
import { PRESETS, resultKey } from "./presets.js";

export default (tf) => {
  /** What the user has typed for their own agent so far. */
  let draft = emptyDraft();
  /** True while Tilefold is asking the user about an agent: another offer meanwhile is ignored. */
  let asking = false;

  /**
   * Offers `agent` to Tilefold and says how it went. `details` is what
   * the activity log keeps. Resolves to whether it was added.
   */
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
      // Busy with another question, asked too often, not allowed, or a
      // command Tilefold won't take.
      await tf.toast(
        tf.t("toast-failed", { reason: String((err && err.name) || err).slice(0, 64) }),
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

  /** Offers ready-made agent `p`. */
  const offerPreset = (p) =>
    offer(
      { name: p.name, command: p.command, clear: p.clear, ...(p.title ? { title: p.title } : {}) },
      { preset: p.id },
    );

  /** Draws the panel for the draft. */
  async function draw() {
    if (!tf.panel) return;
    await tf.panel.show(panelContent(tf.t, draft));
  }

  /** Offers the user's own agent, starting over once it is added. */
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
    { id: "add-own" },
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
