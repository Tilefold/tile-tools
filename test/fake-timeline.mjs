/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Tilefold — tf.timeline
 *
 * The agents' timeline part of the fake Tilefold in fake-host.mjs (Tilefold
 * 0.1.27), with Tilefold's checks: a filter of a known kind with a plain
 * value, a cursor and an id without control characters, a whole-number
 * limit of 1–200, a known format, and only turns and messages with more
 * text. `timeline: { events, full, filters, now, exportReply }` gives what
 * it answers: `events` (any order; the fake sorts them newest first and
 * pages them with Tilefold's `<at>|<id>` cursor), `full` (whole texts by
 * id), `filters`, `now` and the export's answer (default: saved). Every
 * call is kept in `host.timeline.calls`; `host.timeline.add(event)` plays
 * a new event arriving.
 */

const KINDS = ["all", "team", "project", "fold"];

/** True for a string of 1 to `max` characters without control characters. */
function plain(v, max) {
  // eslint-disable-next-line no-control-regex
  return (
    typeof v === "string" &&
    v.length > 0 &&
    v.length <= max &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(v)
  );
}

/** Whether `e` stays under `filter` (the fake keeps by project and pane). */
function keeps(e, filter) {
  if (filter.kind === "all") return true;
  if (filter.kind === "project") return e.project === filter.value;
  return e.pane === filter.value || e.to === filter.value;
}

/** Adds `tf.timeline` to `tf`; its state goes in `host.timeline`. */
export function addTimeline(tf, host, named, opts) {
  const o = typeof opts === "object" ? opts : {};
  const state = {
    events: [...(o.events ?? [])],
    calls: [],
    add(event) {
      state.events.push(structuredClone(event));
    },
  };
  host.timeline = state;
  const checkFilter = (f) => {
    if (f === undefined || f === null) return { kind: "all" };
    if (typeof f !== "object" || !KINDS.includes(f.kind ?? "all"))
      throw named("TypeError", "filter.kind is all, team, project or fold");
    if ((f.kind ?? "all") !== "all" && !plain(f.value, 1024))
      throw named("TypeError", "a filter needs a value");
    return f.kind && f.kind !== "all" ? { kind: f.kind, value: f.value } : { kind: "all" };
  };
  const sorted = () =>
    [...state.events].sort((a, b) =>
      a.at === b.at ? (a.id < b.id ? 1 : -1) : a.at < b.at ? 1 : -1,
    );
  tf.timeline = {
    async events(request = {}) {
      const r = request ?? {};
      const filter = checkFilter(r.filter);
      if (r.before != null && !plain(r.before, 1024))
        throw named("TypeError", "before is the next cursor of a page");
      const limit = r.limit ?? 50;
      if (!Number.isInteger(limit) || limit < 1 || limit > 200)
        throw named("TypeError", "limit is a whole number from 1 to 200");
      state.calls.push({ call: "events", filter, before: r.before ?? null, limit });
      let list = sorted().filter((e) => keeps(e, filter));
      if (r.before) {
        const i = r.before.indexOf("|");
        const at = r.before.slice(0, i);
        const id = r.before.slice(i + 1);
        list = list.filter((e) => e.at < at || (e.at === at && e.id < id));
      }
      const events = list.slice(0, limit);
      const last = events.at(-1);
      const next = list.length > limit && last ? `${last.at}|${last.id}` : null;
      return structuredClone({ events, next });
    },
    async fullText(id) {
      if (!plain(id, 600) || !/^(turn|message):/.test(id))
        throw named("TypeError", "fullText takes a turn's or a message's id");
      state.calls.push({ call: "fullText", id });
      const text = o.full?.[id];
      if (text === undefined) throw named("NotFoundError", `no event ${id}`);
      return text;
    },
    async filters() {
      state.calls.push({ call: "filters" });
      return structuredClone(o.filters ?? { managers: [], projects: [], folds: [] });
    },
    async now() {
      state.calls.push({ call: "now" });
      return structuredClone(o.now ?? []);
    },
    async export(request = {}) {
      const r = request ?? {};
      const format = r.format ?? "markdown";
      if (format !== "markdown" && format !== "json")
        throw named("TypeError", "format is markdown or json");
      const filter = checkFilter(r.filter);
      state.calls.push({ call: "export", filter, format });
      const ext = format === "json" ? "json" : "md";
      return structuredClone(
        o.exportReply ?? {
          saved: `timeline.${ext}`,
          events: state.events.length,
          truncated: false,
        },
      );
    },
  };
}
