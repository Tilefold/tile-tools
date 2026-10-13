/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card — the tile
 *
 * Wires everything to Tilefold:
 *
 * - Commands: **Show or hide** (⌃⌥W) and **Refresh**. Clicking the card
 *   refreshes too.
 * - While the card is shown it checks for new weather every 15, 30 or 60
 *   minutes (a setting); while hidden it sends nothing at all.
 * - The place the user typed is looked up once and remembered with the last
 *   forecast in `tf.store`, so after a restart the card is back at once.
 * - With the summary turned on, each new forecast is followed by one
 *   question to Claude. Tilefold shows the user exactly what is sent and
 *   asks first; "Don't send" is respected until the user refreshes by hand.
 * - Tilefold's refusals are told apart from the weather service failing,
 *   and an older Tilefold without tile networking gets a plain message.
 *
 * Registration comes first, with no `await` before it.
 */
import {
  failureOf,
  forecastUrl,
  geocodeUrl,
  parseForecast,
  parsePlace,
} from "../weather/openMeteo.js";
import { cleanSummary, summaryFailure, summaryQuestion } from "../weather/summary.js";
import { FETCH_KEYS, readSettings } from "./settings.js";
import { CARD_ID, cardItem } from "./view.js";

/** Keys in `tf.store`. */
export const KEYS = { visible: "visible", last: "last" };

/** Commands: stable ids, message keys of their titles, default shortcuts. */
export const COMMANDS = [
  { id: "toggle", title: "cmd-toggle", key: { mac: "Ctrl+Alt+W", other: "Ctrl+Alt+W" } },
  { id: "refresh", title: "cmd-refresh" },
];

/**
 * Starts the tile.
 *
 * @param {any} tf
 */
export function runWeatherCard(tf) {
  let visible = false;
  /** The item on screen, or null when nothing (or not this) is drawn. */
  let shown = null;
  let layout = null;
  let status = "no-place";
  /** @type {{ query: string, units: string, name: string, country: string, lat: number, lon: number } | null} */
  let place = null;
  let forecast = null;
  let fetchedAt = 0;
  let summary = "";
  let summaryNote = "";
  let declined = false;
  let asking = false;
  let busy = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;

  const settings = () => readSettings(tf.settings);
  const quiet = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch(() => {});
  const warn = (text) => quiet(() => tf.log.warn(String(text).slice(0, 300)));
  const audit = (action, details) => quiet(() => tf.audit(action, details));

  // ------------------------------------------------------------ drawing
  const draw = async () => {
    if (!visible) return;
    const item = cardItem({
      status,
      place,
      forecast,
      summary,
      summaryNote,
      query: settings().place,
      corner: settings().corner,
      layout,
      t: (key, args) => tf.t(key, args),
    });
    if (!shown) {
      const ok = await tf.overlay.show({ items: [item] });
      // False: the user has overlays hidden. Draw it whole next time.
      shown = ok === false ? null : item;
      return;
    }
    if (JSON.stringify(item) === JSON.stringify(shown)) return;
    shown = item;
    await tf.overlay.update({ items: [item] });
  };

  const remember = () =>
    quiet(() => tf.store.set(KEYS.last, { place, forecast, fetchedAt, summary }));

  // ------------------------------------------------------------ checking
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!visible) return;
    const wait = Math.max(60_000, fetchedAt + settings().everyMs - Date.now());
    timer = setTimeout(() => void refresh(false), wait);
  };

  /** Gets the weather. `byUser` is true for a command or a click. */
  const refresh = async (byUser) => {
    if (busy) return;
    busy = true;
    const s = settings();
    try {
      if (!tf.net || typeof tf.net.fetch !== "function") {
        status = "no-network";
        return;
      }
      if (!s.place) {
        status = "no-place";
        return;
      }
      if (!forecast) {
        status = "loading";
        await draw();
      }
      if (!place || place.query !== s.place) {
        const res = await tf.net.fetch(geocodeUrl(s.place, tf.t("language-code")));
        if (!res.ok)
          throw Object.assign(new Error(`geocoding ${res.status}`), { name: "HttpError" });
        const found = parsePlace(await res.json());
        if (!found) {
          status = "not-found";
          forecast = null;
          place = null;
          void audit("forecast", { ok: false, code: "not-found" });
          return;
        }
        place = { query: s.place, units: s.units, ...found };
        forecast = null;
      }
      const res = await tf.net.fetch(forecastUrl(place, s.units));
      if (!res.ok) throw Object.assign(new Error(`forecast ${res.status}`), { name: "HttpError" });
      const next = parseForecast(await res.json());
      if (!next) throw Object.assign(new Error("forecast unreadable"), { name: "HttpError" });
      forecast = next;
      place = { ...place, units: s.units };
      fetchedAt = Date.now();
      status = "ready";
      summary = "";
      summaryNote = "";
      void audit("forecast", { ok: true });
      void remember();
    } catch (err) {
      status = failureOf(err);
      void audit("forecast", { ok: false, code: String((err && err.name) || "Error") });
      void warn(`weather check failed: ${err && err.name}: ${err && err.message}`);
    } finally {
      busy = false;
      fetchedAt = fetchedAt || Date.now();
      await draw();
      schedule();
    }
    if (status === "ready" && s.summary) void summarize(byUser);
  };

  // ------------------------------------------------------------ Claude
  /** Asks Claude for the one-line summary. `byUser` lifts an earlier "Don't send". */
  const summarize = async (byUser) => {
    if (asking || !forecast || !place) return;
    if (!tf.ai || typeof tf.ai.ask !== "function") return;
    if (declined && !byUser) return;
    asking = true;
    summaryNote = "summary-thinking";
    await draw();
    try {
      const where = [place.name, place.country].filter(Boolean).join(", ");
      const system = tf.t("summary-system", { language: tf.t("language-name") });
      const answer = await tf.ai.ask(summaryQuestion({ place: where, forecast, system }));
      summary = cleanSummary(answer && answer.text);
      summaryNote = "";
      declined = false;
      void audit("summary", { ok: true });
      void remember();
    } catch (err) {
      const failure = summaryFailure(err);
      declined = failure === "declined";
      summaryNote = failure === "declined" ? "" : failure;
      void audit("summary", { ok: false, code: String((err && err.name) || "Error") });
      if (!failure) void warn(`summary failed: ${err && err.name}: ${err && err.message}`);
    } finally {
      asking = false;
      await draw();
    }
  };

  // ------------------------------------------------------------ showing
  const show = async () => {
    visible = true;
    shown = null;
    try {
      layout = await tf.overlay.layout();
    } catch {
      layout = null;
    }
    void quiet(() => tf.store.set(KEYS.visible, true));
    void audit("shown", {});
    const stale = !forecast || Date.now() - fetchedAt >= settings().everyMs;
    if (stale) await refresh(false);
    else {
      await draw();
      schedule();
    }
  };

  const hide = async () => {
    visible = false;
    shown = null;
    schedule();
    await tf.overlay.hide();
    void quiet(() => tf.store.set(KEYS.visible, false));
    void audit("hidden", {});
  };

  /** Restores the last forecast (when it is for the place still set) and the card. */
  const restore = async () => {
    const s = settings();
    const last = await tf.store.get(KEYS.last).catch(() => null);
    if (last && last.place && last.place.query === s.place && last.place.units === s.units) {
      const parsed = last.forecast && last.forecast.now ? last.forecast : null;
      if (parsed) {
        place = last.place;
        forecast = parsed;
        fetchedAt = Number(last.fetchedAt) || 0;
        summary = s.summary && typeof last.summary === "string" ? last.summary : "";
        status = "ready";
      }
    }
    if (await tf.store.get(KEYS.visible).catch(() => false)) await show();
  };

  /** Runs a handler's work in the background, so the handler returns at once. */
  const background = (fn) => (e) =>
    void Promise.resolve()
      .then(() => fn(e))
      .catch((err) => warn(err));

  // ------------------------------------------------------------ registration (nothing awaited above)
  for (const c of COMMANDS) {
    const run =
      c.id === "toggle"
        ? background(() => (visible ? hide() : show()))
        : background(() => (visible ? refresh(true) : show()));
    tf.command(tf.t(c.title), run, c.key ? { id: c.id, key: c.key } : { id: c.id });
  }
  tf.on("app.ready", background(restore));
  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (visible && e && e.item === CARD_ID && e.type === "click") await refresh(true);
    }),
  );
  tf.on(
    "overlay.layout",
    background(async (next) => {
      if (next && typeof next === "object") layout = next;
      await draw();
    }),
  );
  tf.on(
    "overlay.hidden",
    background(async () => {
      shown = null;
    }),
  );
  tf.on(
    "window.focused",
    background(async () => {
      if (visible && Date.now() - fetchedAt >= settings().everyMs) await refresh(false);
    }),
  );
  tf.on(
    "setting.changed",
    background(async (e) => {
      const key = e && e.key;
      if (FETCH_KEYS.includes(key)) {
        if (key === "place") place = null;
        forecast = null;
        summary = "";
        fetchedAt = 0;
        if (visible) await refresh(true);
        return;
      }
      if (key === "summary") {
        summary = "";
        summaryNote = "";
        declined = false;
        if (settings().summary && status === "ready") void summarize(true);
      }
      if (key === "every") schedule();
      await draw();
    }),
  );

  return { refresh, summarize, state: () => ({ status, visible, summary, summaryNote, declined }) };
}
