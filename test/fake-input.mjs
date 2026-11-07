/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Tilefold — tf.input
 *
 * The input actions part of the fake Tilefold in fake-host.mjs (Tilefold
 * 0.1.27): `tf.input.action({ id, label })` registers a button in the agent
 * input box, checked as Tilefold checks it (an id of 1–32 lowercase
 * letters, digits and dashes, a one-line label of 1–24 characters, at most
 * two per tile, no id twice); the buttons are kept in `host.actions`.
 *
 * The box is `host.box.text`. `host.clickAction(id, { text, spot })` plays
 * the user's click: it fires `input.action` with the box's text (masking
 * words that look like keys, as Tilefold does, and putting them back in a
 * replacement that keeps every mask), a one-time request id and
 * `language`, and resolves to that request id. The tile answers with
 * `tf.input.replace(request, { text })`, which puts the text in the box
 * (kept in `host.box.replaced`, and in `host.box.sent` too with `send:
 * true`, as Tilefold then sends it) and resolves `{ done: true }`, or `{ done:
 * false, why }`: "changed" when the test changed `host.box.text` since the
 * click, "expired" after `host.expireInput()`, "gone" after
 * `host.closeBox()`, "stopped" after `host.stopAction()` (the user's ×
 * beside the spinning button, which first fires `input.cancelled` with
 * `{ request }` for each open request). A request is answered once; a replacement longer than
 * twice the clicked text plus 200 characters, or another request's id, is
 * refused with a TypeError. `tf.input.release(request)` ends a request
 * (kept in `host.box.released`). See fake-host.mjs for how tests use it.
 */

const ACTION_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
/** What Tilefold writes in place of a secret. */
export const MASK = "[redacted]";

/** Key-like words, as Tilefold masks them (in short). */
const SECRET = /\b(?:sk-|ghp_|AKIA)[\w-]{12,}/g;

/**
 * Adds `tf.input` to `tf` and the box's controls to `host`.
 *
 * @param {any} tf
 * @param {any} host
 * @param {(name: string, message: string) => Error} named
 * @param {{ text?: string, language?: string }} [opts]
 */
export function addInput(tf, host, named, opts = {}) {
  host.actions = [];
  host.box = { text: opts.text ?? "", replaced: [], released: [], sent: [], open: true };
  /** Requests the tile hasn't answered: id → { text, expired, stopped }. */
  const requests = new Map();
  let seq = 0;

  host.clickAction = async (id, { text = host.box.text, spot = null } = {}) => {
    if (!host.actions.some((a) => a.id === id)) throw new Error(`no input action ${id}`);
    host.box.text = text;
    seq += 1;
    const request = `req${seq}`;
    requests.set(request, {
      text,
      secrets: text.match(SECRET) ?? [],
      expired: false,
      stopped: false,
    });
    await host.emit("input.action", {
      action: id,
      request,
      text: text.replace(SECRET, MASK),
      language: opts.language ?? "en",
      spot,
    });
    return request;
  };
  host.expireInput = () => {
    for (const r of requests.values()) r.expired = true;
  };
  host.closeBox = () => {
    host.box.open = false;
  };
  /** The user's × beside the spinning button: each open request stops. */
  host.stopAction = async () => {
    for (const [request, r] of requests) {
      if (r.stopped) continue;
      r.stopped = true;
      await host.emit("input.cancelled", { request });
    }
  };

  const own = (request) => {
    const r = requests.get(request);
    if (!r) throw named("TypeError", "no such input request");
    return r;
  };

  tf.input = {
    action(options = {}) {
      const id = options.id;
      const label =
        typeof options.label === "string" ? options.label.replace(/\s+/g, " ").trim() : "";
      if (typeof id !== "string" || !ACTION_ID.test(id)) {
        throw new Error("an input action needs an id: 1–32 lowercase letters, digits and dashes");
      }
      if (!label || label.length > 24) {
        throw new Error(`input action "${id}" needs a label of 1–24 characters on one line`);
      }
      if (host.actions.some((a) => a.id === id)) {
        throw new Error(`two input actions share the id "${id}"`);
      }
      if (host.actions.length >= 2) throw new Error("a tile may add at most 2 input actions");
      host.actions.push({ id, label });
      host.regs.push({ kind: "action", id, label });
    },
    async replace(request, proposal) {
      const r = own(request);
      if (typeof proposal?.text !== "string")
        throw named("TypeError", "tf.input.replace needs { text }");
      if (proposal.send !== undefined && typeof proposal.send !== "boolean")
        throw named("TypeError", "send: true or false");
      if (proposal.text.length > r.text.length * 2 + 200) {
        throw named("TypeError", "the replacement is too long");
      }
      requests.delete(request);
      if (r.stopped) return { done: false, why: "stopped" };
      if (!host.box.open) return { done: false, why: "gone" };
      if (r.expired) return { done: false, why: "expired" };
      if (host.box.text !== r.text) return { done: false, why: "changed" };
      // The masked secrets go back when every mask was kept, as in Tilefold.
      const pieces = proposal.text.split(MASK);
      const text =
        r.secrets.length > 0 && pieces.length - 1 === r.secrets.length
          ? pieces.reduce((out, p, i) => out + (i ? r.secrets[i - 1] : "") + p, "")
          : proposal.text;
      host.box.text = text;
      host.box.replaced.push(text);
      // The user pressed the tile's Send: the box sends it, as Enter would.
      if (proposal.send === true) host.box.sent.push(text);
      return { done: true };
    },
    async release(request) {
      own(request);
      requests.delete(request);
      host.box.released.push(request);
      return null;
    },
  };
}
