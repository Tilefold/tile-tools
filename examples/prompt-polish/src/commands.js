/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — palette commands, the agent input box and the pill
 *
 * Registers what Promptsmith adds to Tilefold besides its card: the ✦
 * Polish button in the agent input box (with its click and cancel
 * events), one palette command per entry of COMMANDS (each with a fixed
 * id, run in the background), and the command the polish agent runs to
 * hand back the prompt it corrected (from the palette it opens the card).
 * And the pill's events: a click on it opens or folds the focused pane's
 * card, tile overlays hidden take it (and the card) away, and a new theme
 * redraws it in the new accent.
 */
import { COMMANDS } from "./settings.js";

/**
 * @param {any} tf
 * @param {{ background: (f: Function) => Function,
 *   inputAction: { register: () => void, clicked: (e: any) => Promise<void>,
 *     cancelled: (e: any) => Promise<void> },
 *   runs: Record<string, () => Promise<unknown>>, open: () => Promise<void>,
 *   handBack: (input: any) => Promise<unknown>,
 *   handBackId: string, handBackInput: string }} o
 */
export function registerCommands(tf, o) {
  // ✦ Polish in Tilefold's agent input box, where this Tilefold has it.
  o.inputAction.register();
  tf.on(
    "input.action",
    o.background((e) => o.inputAction.clicked(e)),
  );
  tf.on(
    "input.cancelled",
    o.background((e) => o.inputAction.cancelled(e)),
  );
  for (const c of COMMANDS) {
    tf.command(
      tf.t(c.title),
      o.background(() => o.runs[c.id]()),
      { id: c.id },
    );
  }
  // For AI agents: the agent in the pane hands back the prompt it corrected.
  tf.command(
    tf.t("cmd-hand-back"),
    async (input) => (input == null ? void (await o.open()) : o.handBack(input)),
    { id: o.handBackId, input: o.handBackInput },
  );
}

/**
 * @param {any} tf
 * @param {{ background: (f: Function) => Function, stage: any,
 *   sessions: { ensure: (id: string) => any }, focusId: () => string,
 *   place: () => Promise<void>, closeAll: () => Promise<void>, buttonId: string }} o
 */
export function registerPill(tf, o) {
  tf.on(
    "overlay.pointer",
    o.background(async (e) => {
      if (!e || e.item !== o.buttonId || e.type !== "click") return;
      const s = o.sessions.ensure(o.focusId());
      s.open = !s.open;
      await o.place();
    }),
  );
  tf.on(
    "overlay.hidden",
    // The user hid tile overlays: the button goes, and the card with it.
    o.background(async () => {
      o.stage.lostOverlay();
      if (o.stage.where() === "card") await o.closeAll();
    }),
  );
  tf.on(
    "theme.changed",
    o.background(async (e) => {
      o.stage.setAccent(e?.colors?.accent ?? null);
      if (o.stage.buttonShown()) await o.place();
    }),
  );
}
