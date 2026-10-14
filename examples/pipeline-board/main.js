/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Pipeline Board
 *
 * The latest CI pipelines of a GitLab project in a corner of the focused
 * pane: passed, failed, running or waiting, on which branch and how long
 * ago, with an optional notice when one finishes.
 *
 * It shows signing in to a service from Tilefold 0.1.6 on. tile.json
 * declares a GitLab sign-in (`oauth2-pkce`) that uses the user's own GitLab
 * application (`"clientId": "user"`), so no client id or secret ships with
 * the tile. Tilefold runs the sign-in in the browser, keeps the token in
 * the keychain, refreshes it, and adds it to requests that name the
 * sign-in; the tile only ever learns whether the user is signed in.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/gitlab/api.js
var API = "https://gitlab.com/api/v4";
var ROWS = 4;
var SIGN_IN = "gitlab";
function cleanProject(value) {
  if (typeof value !== "string") return "";
  let path = value.trim();
  const fromUrl = /^https:\/\/gitlab\.com\/(.+?)(?:\/-\/.*)?\/?$/.exec(path);
  if (fromUrl) path = fromUrl[1];
  path = path.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
  const part = /^[A-Za-z0-9_][\w.-]*$/;
  const parts = path.split("/");
  return parts.length >= 2 && parts.every((x) => part.test(x)) && path.length <= 255 ? path : "";
}
function cleanRef(value) {
  if (typeof value !== "string") return "";
  const ref = value.trim();
  return /^[^\s~^:?*[\\]{1,200}$/.test(ref) ? ref : "";
}
function pipelinesUrl(project, ref = "") {
  const params = new URLSearchParams({ per_page: String(ROWS), order_by: "id", sort: "desc" });
  if (ref) params.set("ref", ref);
  return `${API}/projects/${encodeURIComponent(project)}/pipelines?${params}`;
}
function parsePipelines(json) {
  if (!Array.isArray(json)) return [];
  const out = [];
  for (const p of json) {
    if (!p || typeof p !== "object") continue;
    const id = Number(p.id);
    if (!Number.isInteger(id)) continue;
    out.push({
      id,
      iid: Number.isInteger(Number(p.iid)) ? Number(p.iid) : id,
      status: typeof p.status === "string" ? p.status : "unknown",
      ref: typeof p.ref === "string" ? p.ref.slice(0, 120) : "",
      updatedAt: typeof p.updated_at === "string" ? p.updated_at : String(p.created_at ?? "")
    });
  }
  return out.slice(0, ROWS);
}
function failureOf(err, status = 0) {
  const name = err && typeof err === "object" ? err.name : "";
  if (name === "CredentialMissingError") return "signed-out";
  if (name === "PermissionDeniedError" || name === "NetworkPolicyError") return "denied";
  if (name === "RateLimitError") return "rate";
  if (status === 401) return "signed-out";
  if (status === 403 || status === 404) return "not-found";
  if (status === 429) return "rate";
  return "error";
}

// src/gitlab/status.js
var GROUP_OF = {
  created: "pending",
  waiting_for_resource: "pending",
  preparing: "pending",
  pending: "pending",
  scheduled: "pending",
  running: "running",
  success: "success",
  failed: "failed",
  canceled: "canceled",
  canceling: "canceled",
  skipped: "canceled",
  manual: "manual"
};
var GROUPS = Object.freeze({
  running: { color: "#3b82f6", text: "status-running" },
  pending: { color: "#a1a1aa", text: "status-pending" },
  success: { color: "#22c55e", text: "status-success" },
  failed: { color: "#ef4444", text: "status-failed" },
  canceled: { color: "#71717a", text: "status-canceled" },
  manual: { color: "#a855f7", text: "status-manual" }
});
function groupOf(status) {
  return (
    /** @type {any} */
    GROUP_OF[
      /** @type {string} */
      status
    ] ?? "pending"
  );
}
function isActive(status) {
  const g = groupOf(status);
  return g === "running" || g === "pending";
}
function finishedSince(before, now) {
  const out = [];
  for (const p of now) {
    const was = before.get(p.id);
    if (was === void 0 || !isActive(was) || isActive(p.status)) continue;
    out.push({ iid: p.iid, ref: p.ref, group: groupOf(p.status) });
  }
  return out;
}
function ageOf(iso, now) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return { key: "age-unknown", n: 0 };
  const minutes = Math.max(0, Math.floor((now - then) / 6e4));
  if (minutes < 1) return { key: "age-now", n: 0 };
  if (minutes < 60) return { key: "age-minutes", n: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { key: "age-hours", n: hours };
  return { key: "age-days", n: Math.floor(hours / 24) };
}

// src/tile/settings.js
var CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];
var SETTINGS = [
  { key: "project", default: "", label: "setting-project" },
  { key: "ref", default: "", label: "setting-ref" },
  {
    key: "corner",
    default: "bottom-right",
    label: "setting-corner",
    choices: [
      { value: "bottom-right", label: "setting-corner-bottom-right" },
      { value: "bottom-left", label: "setting-corner-bottom-left" },
      { value: "top-right", label: "setting-corner-top-right" },
      { value: "top-left", label: "setting-corner-top-left" }
    ]
  },
  { key: "notify", default: true, label: "setting-notify" }
];
var FETCH_KEYS = ["project", "ref"];
function registerSettings(tf) {
  for (const s of SETTINGS) {
    if (s.choices) {
      const choices = s.choices.map((c) => ({ value: c.value, label: tf.t(c.label) }));
      tf.setting(s.key, s.default, tf.t(s.label), { choices });
    } else {
      tf.setting(s.key, s.default, tf.t(s.label));
    }
  }
}
function readSettings(settings) {
  const get = (key) => {
    try {
      return settings.get(key);
    } catch {
      return void 0;
    }
  };
  const corner = String(get("corner"));
  return {
    project: cleanProject(get("project")),
    ref: cleanRef(get("ref")),
    corner: CORNERS.includes(corner) ? corner : "bottom-right",
    notify: get("notify") !== false
  };
}

// src/render/svg.js
var MAX_SIDE = 256;
var THEME = {
  panel: "#18181b",
  panelOpacity: 0.95,
  border: "#27272a",
  text: "#fafafa",
  muted: "#a1a1aa",
  accent: "#fc6d26",
  warn: "#f59e0b",
  error: "#ef4444",
  info: "#fc6d26"
};
var FONT = "system-ui,-apple-system,'Segoe UI',sans-serif";
function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function svgUrl(w, h, body) {
  const dw = Math.min(MAX_SIDE, w);
  const dh = Math.min(MAX_SIDE, h);
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${dw}" height="${dh}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc)}`;
}
var wide = (ch) => /[ᄀ-ᇿ⺀-꓏가-힣豈-﫿＀-￯]/.test(ch);
function textWidth(text, size) {
  let units = 0;
  for (const ch of String(text)) units += wide(ch) ? 1 : 0.56;
  return units * size;
}
function ellipsize(text, size, maxWidth) {
  const s = String(text);
  if (textWidth(s, size) <= maxWidth) return s;
  let out = "";
  for (const ch of s) {
    if (textWidth(`${out}${ch}\u2026`, size) > maxWidth) break;
    out += ch;
  }
  return `${out.trimEnd()}\u2026`;
}
function textEl(o) {
  const weight = o.weight ? ` font-weight="${o.weight}"` : "";
  const anchor = o.anchor ? ` text-anchor="${o.anchor}"` : "";
  return `<text x="${o.x}" y="${o.y}" font-family="${FONT}" font-size="${o.size}"${weight}${anchor} fill="${o.color ?? THEME.text}">${escapeXml(ellipsize(o.text, o.size, o.maxWidth))}</text>`;
}
function wrapLines(text, size, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const joined = line ? `${line} ${word}` : word;
    if (textWidth(joined, size) <= maxWidth) {
      line = joined;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const ch of word) {
      if (line && textWidth(line + ch, size) > maxWidth) {
        lines.push(line);
        line = "";
      }
      line += ch;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(`${kept[maxLines - 1]} ${lines[maxLines]}`, size, maxWidth);
  return kept;
}

// src/render/board.js
var BOARD_W = 240;
var HEADER_H = 34;
var ROW_H = 34;
var MESSAGE_H = 88;
var TONES = { info: THEME.info, warn: THEME.warn, error: THEME.error };
function frame(h) {
  return `<rect x="0.5" y="0.5" width="${BOARD_W - 1}" height="${h - 1}" rx="12" fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>`;
}
function mark(x, y) {
  return `<path d="M${x + 7} ${y} L${x + 14} ${y + 7} L${x + 7} ${y + 14} L${x} ${y + 7} Z" fill="${THEME.accent}"/>`;
}
function dot(cx, cy, color, running) {
  return running ? `<circle cx="${cx}" cy="${cy}" r="5" fill="none" stroke="${color}" stroke-width="2.4" stroke-dasharray="20 8"/>` : `<circle cx="${cx}" cy="${cy}" r="5" fill="${color}"/>`;
}
function renderList(v) {
  const rows = v.rows.slice(0, 4);
  const h = HEADER_H + Math.max(1, rows.length) * ROW_H + 6;
  let body = frame(h);
  body += mark(12, 11);
  body += textEl({ x: 34, y: 23, text: v.project, size: 12, weight: 600, maxWidth: BOARD_W - 46 });
  body += `<line x1="12" y1="${HEADER_H}" x2="${BOARD_W - 12}" y2="${HEADER_H}" stroke="${THEME.border}"/>`;
  if (rows.length === 0) {
    body += textEl({
      x: 14,
      y: HEADER_H + 22,
      text: v.empty,
      size: 10,
      color: THEME.muted,
      maxWidth: BOARD_W - 28
    });
  }
  rows.forEach((r, i) => {
    const top = HEADER_H + i * ROW_H;
    body += dot(20, top + 13, r.color, r.running);
    body += textEl({ x: 34, y: top + 17, text: r.ref, size: 11, weight: 600, maxWidth: 118 });
    body += textEl({
      x: BOARD_W - 14,
      y: top + 17,
      text: r.status,
      size: 10,
      color: r.color,
      maxWidth: 64,
      anchor: "end"
    });
    body += textEl({
      x: 34,
      y: top + 30,
      text: r.number,
      size: 9,
      color: THEME.muted,
      maxWidth: 80
    });
    body += textEl({
      x: BOARD_W - 14,
      y: top + 30,
      text: r.age,
      size: 9,
      color: THEME.muted,
      maxWidth: 110,
      anchor: "end"
    });
  });
  return { image: svgUrl(BOARD_W, h, body), w: BOARD_W, h };
}
function renderMessage(v) {
  const color = TONES[v.tone] ?? THEME.info;
  const width = BOARD_W - 66;
  let body = frame(MESSAGE_H);
  body += `<g transform="translate(12 12)"><circle cx="16" cy="16" r="15" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.5"/><rect x="14.75" y="8" width="2.5" height="11" rx="1.2" fill="${color}"/><circle cx="16" cy="23.5" r="1.6" fill="${color}"/></g>`;
  const title = wrapLines(v.title, 12, width, 2);
  const hint = wrapLines(v.hint, 10, width, 4 - title.length);
  let y = 25;
  for (const line of title) {
    body += textEl({ x: 54, y, text: line, size: 12, weight: 600, maxWidth: width });
    y += 15;
  }
  y += 2;
  for (const line of hint) {
    body += textEl({ x: 54, y, text: line, size: 10, color: THEME.muted, maxWidth: width });
    y += 13;
  }
  return { image: svgUrl(BOARD_W, MESSAGE_H, body), w: BOARD_W, h: MESSAGE_H };
}

// src/tile/view.js
var BOARD_ID = "board";
var MARGIN = 12;
var STATE_TEXT = {
  "no-network": ["state-no-network", "state-no-network-hint", "warn"],
  "signed-out": ["state-signed-out", "state-signed-out-hint", "info"],
  "no-project": ["state-no-project", "state-no-project-hint", "info"],
  loading: ["state-loading", "state-loading-hint", "info"],
  "not-found": ["state-not-found", "state-not-found-hint", "warn"],
  denied: ["state-denied", "state-denied-hint", "warn"],
  rate: ["state-rate", "state-rate-hint", "warn"],
  error: ["state-error", "state-error-hint", "error"]
};
var STATES = Object.freeze([...Object.keys(STATE_TEXT), "ready"]);
function placeBoard(layout, corner, w, h) {
  const panes = layout && Array.isArray(layout.panes) ? layout.panes : [];
  const pane = panes.find((p) => p && p.focused) || panes[0];
  const content = layout && layout.content || { w: 800, h: 600 };
  const area = pane ? {
    x: pane.x,
    y: pane.y,
    w: pane.w,
    h: pane.composer ? Math.max(0, pane.composer.y - pane.y) : pane.h
  } : { x: 0, y: 0, w: content.w, h: content.h };
  const x = corner.endsWith("left") ? area.x + MARGIN : area.x + area.w - w - MARGIN;
  const y = corner.startsWith("top") ? area.y + MARGIN : area.y + area.h - h - MARGIN;
  return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) };
}
function boardItem(s) {
  let picture;
  let label;
  if (s.status === "ready") {
    const rows = s.pipelines.map((p) => {
      const group = groupOf(p.status);
      const age = ageOf(p.updatedAt, s.now);
      return {
        ref: p.ref,
        number: `#${p.iid}`,
        status: s.t(GROUPS[group].text),
        age: s.t(age.key, { n: age.n }),
        color: GROUPS[group].color,
        running: group === "running"
      };
    });
    picture = renderList({ project: s.project, rows, empty: s.t("board-empty") });
    label = rows.length ? s.t("board-label", { project: s.project, status: rows[0].status }) : s.t("board-empty");
  } else {
    const [title, hint, tone] = STATE_TEXT[s.status] ?? STATE_TEXT.error;
    const titleText = s.t(title);
    picture = renderMessage({
      title: titleText,
      hint: s.t(hint, { project: s.project }),
      tone: (
        /** @type {"info"|"warn"|"error"} */
        tone
      )
    });
    label = titleText;
  }
  const at = placeBoard(s.layout, s.corner, BOARD_W, picture.h);
  return {
    id: BOARD_ID,
    image: picture.image,
    x: at.x,
    y: at.y,
    w: picture.w,
    h: picture.h,
    label: label.slice(0, 80),
    hit: true,
    cursor: "pointer"
  };
}

// src/tile/run.js
var ACTIVE_MS = 3e4;
var IDLE_MS = 12e4;
var SIGN_IN_MS = 5e3;
var RATE_MS = 3e5;
var KEYS = { visible: "visible" };
var COMMANDS = [
  { id: "toggle", title: "cmd-toggle", key: { mac: "Ctrl+Alt+L", other: "Ctrl+Alt+L" } },
  { id: "refresh", title: "cmd-refresh" }
];
var NOTICE = {
  success: "notice-success",
  failed: "notice-failed",
  canceled: "notice-canceled",
  manual: "notice-manual"
};
function runPipelineBoard(tf) {
  let visible = false;
  let shown = null;
  let layout = null;
  let status = "no-project";
  let pipelines = [];
  let seen = /* @__PURE__ */ new Map();
  let seenFor = "";
  let busy = false;
  let timer = null;
  const settings = () => readSettings(tf.settings);
  const quiet = (fn) => Promise.resolve().then(fn).catch(() => {
  });
  const warn = (text) => quiet(() => tf.log.warn(String(text).slice(0, 300)));
  const audit = (action, details) => quiet(() => tf.audit(action, details));
  const networked = () => Boolean(
    tf.net && typeof tf.net.fetch === "function" && tf.auth && typeof tf.auth.has === "function"
  );
  const draw = async () => {
    if (!visible) return;
    const s = settings();
    const item = boardItem({
      status,
      project: s.project,
      pipelines,
      now: Date.now(),
      corner: s.corner,
      layout,
      t: (key, args) => tf.t(key, args)
    });
    if (!shown) {
      const ok = await tf.overlay.show({ items: [item] });
      shown = ok === false ? null : item;
      return;
    }
    if (JSON.stringify(item) === JSON.stringify(shown)) return;
    shown = item;
    await tf.overlay.update({ items: [item] });
  };
  const nextWait = () => {
    if (status === "signed-out") return SIGN_IN_MS;
    if (status === "rate") return RATE_MS;
    if (status === "no-network" || status === "no-project") return null;
    return pipelines.some((p) => isActive(p.status)) ? ACTIVE_MS : IDLE_MS;
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const wait = visible ? nextWait() : null;
    if (wait !== null) timer = setTimeout(() => void refresh(), wait);
  };
  const announce = async (finished) => {
    for (const f of finished) {
      void audit("finished", { result: f.group });
      const key = NOTICE[f.group];
      if (key && settings().notify) await tf.toast(tf.t(key, { n: f.iid, ref: f.ref }));
    }
  };
  const refresh = async () => {
    if (busy) return;
    busy = true;
    const s = settings();
    try {
      if (!networked()) {
        status = "no-network";
        return;
      }
      if (!s.project) {
        status = "no-project";
        return;
      }
      if (!await tf.auth.has(SIGN_IN)) {
        status = "signed-out";
        return;
      }
      if (status !== "ready") {
        status = "loading";
        await draw();
      }
      const res = await tf.net.fetch(pipelinesUrl(s.project, s.ref), { auth: SIGN_IN });
      if (!res.ok) {
        status = failureOf(null, res.status);
        void audit("check", { ok: false, code: `http-${res.status}` });
        return;
      }
      const next = parsePipelines(await res.json());
      const key = `${s.project}|${s.ref}`;
      const finished = seenFor === key ? finishedSince(seen, next) : [];
      seen = new Map(next.map((p) => [p.id, p.status]));
      seenFor = key;
      pipelines = next;
      status = "ready";
      await announce(finished);
    } catch (err) {
      status = failureOf(err);
      void audit("check", { ok: false, code: String(err && err.name || "Error") });
      if (status === "error") void warn(`check failed: ${err && err.name}: ${err && err.message}`);
    } finally {
      busy = false;
      await draw();
      schedule();
    }
  };
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
    await refresh();
  };
  const hide = async () => {
    visible = false;
    shown = null;
    schedule();
    await tf.overlay.hide();
    void quiet(() => tf.store.set(KEYS.visible, false));
    void audit("hidden", {});
  };
  const background = (fn) => (e) => void Promise.resolve().then(() => fn(e)).catch((err) => warn(err));
  for (const c of COMMANDS) {
    const run = c.id === "toggle" ? background(() => visible ? hide() : show()) : background(() => visible ? refresh() : show());
    tf.command(tf.t(c.title), run, c.key ? { id: c.id, key: c.key } : { id: c.id });
  }
  tf.on(
    "app.ready",
    background(async () => {
      if (await tf.store.get(KEYS.visible).catch(() => false)) await show();
    })
  );
  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (visible && e && e.item === BOARD_ID && e.type === "click") await refresh();
    })
  );
  tf.on(
    "overlay.layout",
    background(async (next) => {
      if (next && typeof next === "object") layout = next;
      await draw();
    })
  );
  tf.on(
    "overlay.hidden",
    background(async () => {
      shown = null;
    })
  );
  tf.on(
    "setting.changed",
    background(async (e) => {
      if (FETCH_KEYS.includes(e && e.key)) {
        pipelines = [];
        status = "loading";
        if (visible) await refresh();
        return;
      }
      await draw();
    })
  );
  return { refresh, state: () => ({ status, visible, pipelines }) };
}

// src/main.js
var main_default = (tf) => {
  registerSettings(tf);
  runPipelineBoard(tf);
};
export default main_default;
