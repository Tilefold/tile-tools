/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — warnings and the audit trail
 *
 * `warn` writes to Tilefold's log, `audit` adds an event to the tile's
 * audit trail (counts and choices only, never what the user wrote). Neither
 * ever throws or holds up the caller: a failure to log is only logged.
 * `background` runs an event handler's work without the handler waiting,
 * its failures warned.
 */

/** @param {any} tf */
export function createLog(tf) {
  const warn = (err) =>
    void Promise.resolve()
      .then(() => tf.log.warn(String(err && err.message ? err.message : err)))
      .catch(() => {});
  const audit = (action, details) =>
    void Promise.resolve()
      .then(() => tf.audit(action, details))
      .catch(warn);
  const background = (fn) => (e) =>
    void Promise.resolve()
      .then(() => fn(e))
      .catch(warn);
  return { warn, audit, background };
}
