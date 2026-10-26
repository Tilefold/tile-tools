/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — a short terminal quiz on a borderless card
 *
 * Asks a few multiple-choice questions about working in a terminal, one at
 * a time, says whether each answer was right and why, and keeps score. It
 * shows on a borderless card floating over the panes, which the user drags
 * by its grip, or in a panel beside the panes (Settings → Tiles → Quiz).
 * Progress is kept, so the quiz resumes where it was left.
 *
 * Needs Tilefold 0.1.11 for the floating card; 0.1.7 to 0.1.10 open the
 * quiz in a window of its own, or in the panel from 0.1.9.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/position.js
var FALLBACK_CONTENT = { w: 800, h: 600 };
function contentOf(layout) {
  const c = layout && layout.content;
  if (c && Number.isFinite(c.w) && Number.isFinite(c.h) && c.w > 0 && c.h > 0) {
    return { w: c.w, h: c.h };
  }
  return FALLBACK_CONTENT;
}
var unit = (n) => Math.min(1, Math.max(0, n));
function readPosition(value) {
  if (!value || typeof value !== "object") return null;
  const { fx, fy } = (
    /** @type {any} */
    value
  );
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
  return { fx: unit(fx), fy: unit(fy) };
}
function placeAt(content, w, h, pos) {
  const roomX = Math.max(0, content.w - w);
  const roomY = Math.max(0, content.h - h);
  return { x: Math.round(roomX * unit(pos.fx)), y: Math.round(roomY * unit(pos.fy)) };
}
function positionFor(content, w, h, x, y) {
  const roomX = Math.max(0, content.w - w);
  const roomY = Math.max(0, content.h - h);
  return { fx: roomX > 0 ? unit(x / roomX) : 0, fy: roomY > 0 ? unit(y / roomY) : 0 };
}
function createDrag() {
  let from = null;
  const move = (px, py, content, w, h) => {
    if (!from || !Number.isFinite(px) || !Number.isFinite(py)) return null;
    return positionFor(content, w, h, from.x + (px - from.px), from.y + (py - from.py));
  };
  return {
    start(px, py, origin) {
      from = Number.isFinite(px) && Number.isFinite(py) ? { px, py, x: origin.x, y: origin.y } : null;
    },
    move,
    end(px, py, content, w, h) {
      const pos = move(px, py, content, w, h);
      from = null;
      return pos;
    },
    active: () => from !== null,
    cancel() {
      from = null;
    }
  };
}

// src/scene.js
var CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];
var MARGIN = 12;
var PAGE_W = 360;
var PAGE_H = 340;
var GRIP_H = 22;
var GRIP_GAP = 2;
var GRIP_HALF = PAGE_W / 2;
var CARD = { w: PAGE_W, h: GRIP_H + GRIP_GAP + PAGE_H };
var cornerOf = (corner) => CORNERS.includes(corner) ? corner : "bottom-right";
var rectOrNull = (r) => r && [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0 ? r : null;
var overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function areaOf(layout) {
  const panes = (Array.isArray(layout?.panes) ? layout.panes : []).filter(rectOrNull);
  const pane = panes.find((p) => p.focused) ?? panes[0];
  if (pane) {
    const bottom = rectOrNull(pane.composer) ? pane.composer.y : pane.y + pane.h;
    return { x: pane.x, y: pane.y, w: pane.w, h: Math.max(0, bottom - pane.y) };
  }
  const content = contentOf(layout);
  return { x: 0, y: 0, w: content.w, h: content.h };
}
function keepOut(layout) {
  const panes = (Array.isArray(layout?.panes) ? layout.panes : []).filter(rectOrNull);
  const top = panes.length ? Math.max(0, Math.min(...panes.map((p) => p.y))) : 0;
  const zones = panes.map((p) => rectOrNull(p.composer)).filter(Boolean);
  return { top, zones };
}
function settle(layout, o) {
  const content = contentOf(layout);
  const { top, zones } = keepOut(layout);
  const maxY = Math.max(top, content.h - CARD.h);
  let y = Math.min(maxY, Math.max(top, o.y));
  for (let pass = 0; pass <= zones.length; pass++) {
    const hit = zones.find((z) => overlaps({ x: o.x, y, w: CARD.w, h: CARD.h }, z));
    if (!hit) break;
    const above = hit.y - MARGIN - CARD.h;
    y = above >= top ? above : Math.min(maxY, hit.y + hit.h + MARGIN);
  }
  const x = Math.min(Math.max(0, content.w - CARD.w), Math.max(0, o.x));
  return { x: Math.round(x), y: Math.round(y) };
}
function cornerOrigin(area, corner) {
  const left = corner.endsWith("left");
  const topCorner = corner.startsWith("top");
  return {
    x: left ? area.x + MARGIN : area.x + area.w - MARGIN - CARD.w,
    y: topCorner ? area.y + MARGIN : area.y + area.h - MARGIN - CARD.h
  };
}
function cardSpots(layout, corner, position) {
  const at = position ? placeAt(contentOf(layout), CARD.w, CARD.h, position) : cornerOrigin(areaOf(layout), cornerOf(corner));
  const o = settle(layout, at);
  return {
    card: { x: o.x, y: o.y, w: CARD.w, h: CARD.h },
    gripL: { x: o.x, y: o.y, w: GRIP_HALF, h: GRIP_H },
    gripR: { x: o.x + GRIP_HALF, y: o.y, w: GRIP_HALF, h: GRIP_H },
    page: { x: o.x, y: o.y + GRIP_H + GRIP_GAP, w: PAGE_W, h: PAGE_H }
  };
}

// src/grip.js
var COLORS = Object.freeze({
  bar: "#262833",
  border: "#4a4e5e",
  dots: "#8d92a8",
  text: "#e8e9f0"
});
var xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var fitTitle = (title, max = 18) => {
  const s = String(title).trim();
  return s.length > max ? `${s.slice(0, max - 1)}\u2026` : s;
};
function drawing(title, rtl) {
  const dots = [-12, -6, 0, 6, 12].map((d) => `<circle cx="${PAGE_W / 2 + d}" cy="${GRIP_H / 2}" r="1.6" fill="${COLORS.dots}"/>`).join("");
  const x = rtl ? PAGE_W - 12 : 12;
  const anchor = rtl ? "end" : "start";
  return `<rect x="0.5" y="0.5" width="${PAGE_W - 1}" height="${GRIP_H - 1}" rx="${GRIP_H / 2}" fill="${COLORS.bar}" fill-opacity="0.94" stroke="${COLORS.border}"/>` + dots + `<text x="${x}" y="${GRIP_H / 2 + 4}" text-anchor="${anchor}" fill="${COLORS.text}" font-family="-apple-system, system-ui, sans-serif" font-size="11" font-weight="600">${xml(fitTitle(title))}</text>`;
}
function half(body, left) {
  const x = left ? 0 : GRIP_HALF;
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${GRIP_HALF}" height="${GRIP_H}" viewBox="${x} 0 ${GRIP_HALF} ${GRIP_H}">${body}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(doc);
}
function gripImages(title, rtl = false) {
  const body = drawing(title, rtl);
  return { left: half(body, true), right: half(body, false) };
}

// src/card.js
var POSITION_KEY = "position";
var GRIP_ITEMS = ["grip-l", "grip-r"];
function createCard(tf, o) {
  let layout = null;
  let position = null;
  let shown = false;
  let lastPage = "";
  const drag = createDrag();
  const audit = (action, details) => Promise.resolve().then(() => tf.audit(action, details)).catch(o.warn);
  const currentLayout = async () => {
    if (!layout) layout = await tf.overlay.layout();
    return layout;
  };
  const spots = async () => cardSpots(await currentLayout(), o.corner(), position);
  const items = (s) => {
    const images = gripImages(o.title(), o.rtl());
    const grip = (id, r, image) => ({
      id,
      image,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      hit: true,
      cursor: "grab",
      label: o.label()
    });
    return [grip("grip-l", s.gripL, images.left), grip("grip-r", s.gripR, images.right)];
  };
  const dockPage = (spot) => {
    const key = JSON.stringify(spot);
    if (key === lastPage) return;
    lastPage = key;
    void Promise.resolve().then(() => tf.page.dock(spot)).catch(o.warn);
  };
  const draw = async () => {
    if (!shown) return;
    const s = await spots();
    await tf.overlay.update({ items: items(s) });
    dockPage(s.page);
  };
  return {
    /** Reads the dropped position kept from an earlier session. */
    async load() {
      position = readPosition(await tf.store.get(POSITION_KEY));
    },
    /** Where the page goes now (to open it docked there). */
    async pageSpot() {
      return (await spots()).page;
    },
    /** Draws the grip; the page was just opened at `pageSpot()`. */
    async show() {
      const s = await spots();
      await tf.overlay.show({ items: items(s) });
      shown = true;
      lastPage = JSON.stringify(s.page);
    },
    /** Takes the grip away (the page is closing or closed). */
    async hide() {
      drag.cancel();
      if (!shown) return;
      shown = false;
      lastPage = "";
      await tf.overlay.hide();
    },
    /** Redraws in the user's language or corner, after a setting changed. */
    redraw: draw,
    /** Follows a new window layout. */
    async moved(next) {
      if (next && typeof next === "object") layout = next;
      if (!drag.active()) await draw();
    },
    /** Handles a pointer event on the overlay: drags by the grip. */
    async pointer(e) {
      if (!shown || !e || typeof e !== "object") return;
      const content = contentOf(await currentLayout());
      if (e.type === "dragstart" && GRIP_ITEMS.includes(e.item)) {
        drag.start(e.x, e.y, (await spots()).card);
        return;
      }
      if (e.type === "drag") {
        const at = drag.move(e.x, e.y, content, CARD.w, CARD.h);
        if (at) {
          position = at;
          await draw();
        }
        return;
      }
      if (e.type === "drop") {
        const at = drag.end(e.x, e.y, content, CARD.w, CARD.h);
        if (!at) return;
        position = at;
        await draw();
        await tf.store.set(POSITION_KEY, position);
        void audit("card.moved", { via: "drag" });
      }
    },
    /** Puts the card back in the pane's corner; false if it was there already. */
    async reset(via) {
      drag.cancel();
      if (!position) return false;
      position = null;
      await tf.store.delete(POSITION_KEY);
      void audit("card.reset", { via });
      await draw();
      return true;
    },
    get visible() {
      return shown;
    }
  };
}

// src/questions.js
var QUESTIONS = Object.freeze([
  {
    id: "pipe",
    text: "q-pipe",
    why: "q-pipe-why",
    choices: ["|", ">", "&", ";"],
    answer: 0
  },
  {
    id: "append",
    text: "q-append",
    why: "q-append-why",
    choices: [">", ">>", "<", "2>"],
    answer: 1
  },
  {
    id: "status",
    text: "q-status",
    why: "q-status-why",
    choices: ["$!", "$#", "$?", "$$"],
    answer: 2
  },
  {
    id: "background",
    text: "q-background",
    why: "q-background-why",
    choices: ["&", "&&", "||", "!"],
    answer: 0
  },
  {
    id: "and",
    text: "q-and",
    why: "q-and-why",
    choices: [
      "make; make install",
      "make || make install",
      "make && make install",
      "make | make install"
    ],
    answer: 2
  },
  {
    id: "history",
    text: "q-history",
    why: "q-history-why",
    choices: ["Ctrl+R", "Ctrl+C", "Ctrl+D", "Ctrl+Z"],
    answer: 0
  }
]);

// src/quiz.js
function startQuiz(total) {
  return { index: 0, picked: null, score: 0, done: false, total };
}
var within = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
function restoreQuiz(value, total) {
  const s = (
    /** @type {any} */
    value
  );
  const ok = s && typeof s === "object" && s.total === total && within(s.index, 0, Math.max(0, total - 1)) && within(s.score, 0, total) && (s.picked === null || within(s.picked, 0, 63)) && typeof s.done === "boolean";
  if (!ok) return startQuiz(total);
  return { index: s.index, picked: s.picked, score: s.score, done: s.done, total };
}
function pickChoice(state, questions, choice) {
  const q = questions[state.index];
  if (state.done || state.picked !== null || !q || !within(choice, 0, q.choices.length - 1)) {
    return { state, correct: null };
  }
  const correct = choice === q.answer;
  return { state: { ...state, picked: choice, score: state.score + (correct ? 1 : 0) }, correct };
}
function nextQuestion(state) {
  if (state.done || state.picked === null) return state;
  if (state.index + 1 >= state.total) return { ...state, done: true };
  return { ...state, index: state.index + 1, picked: null };
}

// src/settings.js
var SHOW_AS = ["card", "panel"];
var SHOW_AS_KEYS = { card: "setting-show-as-card", panel: "setting-show-as-panel" };
var CORNER_KEYS = {
  "bottom-right": "setting-corner-bottom-right",
  "bottom-left": "setting-corner-bottom-left",
  "top-right": "setting-corner-top-right",
  "top-left": "setting-corner-top-left"
};
var COMMANDS = [
  { id: "open", title: "cmd-open" },
  { id: "close", title: "cmd-close" },
  { id: "restart", title: "cmd-restart" },
  { id: "put-back", title: "cmd-put-back" }
];
function registerSettings(tf) {
  tf.setting("showAs", "card", tf.t("setting-show-as"), {
    choices: SHOW_AS.map((value) => ({ value, label: tf.t(SHOW_AS_KEYS[value]) }))
  });
  tf.setting("corner", "bottom-right", tf.t("setting-corner"), {
    choices: CORNERS.map((value) => ({ value, label: tf.t(CORNER_KEYS[value]) }))
  });
}
function showAsSetting(settings) {
  try {
    return settings.get("showAs") === "panel" ? "panel" : "card";
  } catch {
    return "card";
  }
}
function cornerSetting(settings) {
  try {
    return cornerOf(settings.get("corner"));
  } catch {
    return "bottom-right";
  }
}

// src/view.js
var letter = (i) => String.fromCharCode(65 + i);
function markOf(state, q, i) {
  if (state.picked === null) return "none";
  if (i === q.answer) return "right";
  return i === state.picked ? "wrong" : "none";
}
var scoreLine = (t, state) => t("quiz-score", { score: state.score, total: state.total });
var nextLabel = (t, state) => t(state.index + 1 >= state.total ? "quiz-finish" : "quiz-next");
function cardView(state, questions, t) {
  if (state.done) {
    return { done: true, score: scoreLine(t, state), again: t("quiz-again") };
  }
  const q = questions[state.index];
  const answered = state.picked !== null;
  return {
    done: false,
    progress: t("quiz-progress", { n: state.index + 1, total: state.total }),
    question: t(q.text),
    choices: q.choices.map((text, i) => ({ letter: letter(i), text, mark: markOf(state, q, i) })),
    picked: state.picked,
    result: answered ? t(state.picked === q.answer ? "quiz-right" : "quiz-wrong") : null,
    correct: answered ? state.picked === q.answer : null,
    why: answered ? t(q.why) : null,
    next: answered ? nextLabel(t, state) : null
  };
}
var ROW = Object.freeze({
  question: "question",
  result: "result",
  why: "why",
  next: "next",
  score: "score",
  again: "again"
});
function choiceOfRow(id) {
  const m = /^choice-(\d+)$/.exec(String(id));
  return m ? Number(m[1]) : null;
}
function panelView(state, questions, t) {
  const title = t("quiz-title");
  if (state.done) {
    return {
      title,
      subtitle: t("quiz-over"),
      rows: [
        { id: ROW.score, label: scoreLine(t, state), icon: "info", tone: "success" },
        { id: ROW.again, label: t("quiz-again"), icon: "link" }
      ]
    };
  }
  const q = questions[state.index];
  const answered = state.picked !== null;
  const tones = { right: "success", wrong: "error" };
  const rows = [
    { id: ROW.question, label: t(q.text), icon: "info" },
    ...q.choices.map((text, i) => {
      const mark = markOf(state, q, i);
      return {
        id: `choice-${i}`,
        label: `${letter(i)}. ${text}`,
        icon: "none",
        ...mark !== "none" ? { tone: tones[mark] } : {},
        // Once answered, the choices that don't matter step back.
        ...answered && mark === "none" ? { muted: true } : {}
      };
    })
  ];
  if (answered) {
    const correct = state.picked === q.answer;
    rows.push({
      id: ROW.result,
      label: t(correct ? "quiz-right" : "quiz-wrong"),
      icon: "info",
      tone: correct ? "success" : "error"
    });
    rows.push({ id: ROW.why, label: t(q.why), icon: "none", muted: true });
    rows.push({ id: ROW.next, label: nextLabel(t, state), icon: "link" });
  }
  return {
    title,
    subtitle: t("quiz-progress", { n: state.index + 1, total: state.total }),
    rows
  };
}

// src/run.js
var PROGRESS_KEY = "progress";
function runQuiz(tf) {
  const warn = (err) => void Promise.resolve().then(() => tf.log.warn(String(err && err.message ? err.message : err))).catch(() => {
  });
  const audit = (action, details) => Promise.resolve().then(() => tf.audit(action, details)).catch(warn);
  let quiz = startQuiz(QUESTIONS.length);
  let loaded = false;
  let where = null;
  const canDock = () => typeof tf.page?.dock === "function" && !!tf.overlay;
  const card = canDock() ? createCard(tf, {
    corner: () => cornerSetting(tf.settings),
    title: () => tf.t("quiz-title"),
    rtl: () => tf.t("page-dir") === "rtl",
    label: () => tf.t("grip-label"),
    warn
  }) : null;
  const load = async () => {
    if (loaded) return;
    loaded = true;
    quiz = restoreQuiz(await tf.store.get(PROGRESS_KEY), QUESTIONS.length);
    await card?.load();
  };
  const post = async (message) => {
    try {
      await tf.page.post(message);
    } catch {
    }
  };
  const render = async () => {
    if (where === "panel") await tf.panel.show(panelView(quiz, QUESTIONS, tf.t));
    else if (where) await post({ do: "show", view: cardView(quiz, QUESTIONS, tf.t) });
  };
  const update = async (next2) => {
    if (next2 === quiz) return;
    quiz = next2;
    await tf.store.set(PROGRESS_KEY, quiz);
    await render();
  };
  const open = async () => {
    await load();
    const wanted = showAsSetting(tf.settings);
    if (where) {
      const showing = where === "panel" ? "panel" : "card";
      if (showing === wanted) return render();
      await close(false);
    }
    if ((wanted === "panel" || !tf.page) && tf.panel) {
      where = "panel";
      await render();
    } else if (tf.page && card) {
      await tf.page.open({ dock: await card.pageSpot() });
      where = "card";
      await card.show();
    } else if (tf.page) {
      await tf.page.open();
      where = "window";
    } else {
      await tf.toast(tf.t("toast-needs-tilefold"));
      return;
    }
    void audit("quiz.opened", { as: where });
  };
  const close = async (record = true) => {
    const was = where;
    if (!was) return;
    where = null;
    if (was === "panel") await tf.panel.hide();
    else {
      await card?.hide();
      await tf.page.close();
    }
    if (record) void audit("quiz.closed", { as: was });
  };
  const restart = async () => {
    await load();
    await update(startQuiz(QUESTIONS.length));
    void audit("quiz.restarted", {});
    if (!where) await open();
  };
  const pick = async (i) => {
    const q = QUESTIONS[quiz.index];
    const { state, correct } = pickChoice(quiz, QUESTIONS, i);
    if (correct === null) return;
    await update(state);
    void audit("quiz.answered", { question: q.id, correct });
  };
  const next = async () => {
    const state = nextQuestion(quiz);
    if (state === quiz) return;
    await update(state);
    if (state.done) void audit("quiz.finished", { score: state.score, total: state.total });
  };
  const hear = async (m) => {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") {
      await post({
        do: "setup",
        lang: tf.t("page-lang"),
        dir: tf.t("page-dir"),
        title: tf.t("quiz-title"),
        close: tf.t("page-close")
      });
      return render();
    }
    if (m.type === "pick") return pick(Number(m.choice));
    if (m.type === "next") return next();
    if (m.type === "again") return restart();
    if (m.type === "close") return close();
  };
  const clicked = async (e) => {
    if (where !== "panel" || !e || e.action !== "activate") return;
    const choice = choiceOfRow(e.row);
    if (choice !== null) return pick(choice);
    if (e.row === ROW.next) return next();
    if (e.row === ROW.again) return restart();
  };
  const background = (fn) => (e) => void Promise.resolve().then(() => fn(e)).catch(warn);
  const runs = {
    open,
    close: () => close(),
    restart,
    "put-back": async () => {
      await load();
      await card?.reset("command");
    }
  };
  for (const c of COMMANDS) {
    tf.command(
      tf.t(c.title),
      background(() => runs[c.id]()),
      { id: c.id }
    );
  }
  tf.on(
    "page.message",
    background((e) => hear(e && e.message))
  );
  tf.on(
    "page.closed",
    background(async () => {
      if (where === "card" || where === "window") {
        where = null;
        await card?.hide();
        void audit("quiz.closed", { as: "page" });
      }
    })
  );
  tf.on(
    "panel.click",
    background((e) => clicked(e))
  );
  tf.on(
    "panel.closed",
    background((e) => {
      if (where === "panel" && e?.by === "user") {
        where = null;
        void audit("quiz.closed", { as: "panel" });
      }
    })
  );
  tf.on(
    "overlay.pointer",
    background((e) => card?.pointer(e))
  );
  tf.on(
    "overlay.layout",
    background((e) => card?.moved(e))
  );
  tf.on(
    "overlay.hidden",
    // The user hid tile overlays: the card goes with them, and comes back
    // with "Quiz: Start or show". Its progress stays saved.
    background(() => where === "card" ? close() : void 0)
  );
  let corner = cornerSetting(tf.settings);
  let showAs = showAsSetting(tf.settings);
  tf.on(
    "setting.changed",
    background(async () => {
      const nowCorner = cornerSetting(tf.settings);
      const nowShowAs = showAsSetting(tf.settings);
      if (nowShowAs !== showAs) {
        showAs = nowShowAs;
        if (where) await open();
      }
      if (nowCorner !== corner) {
        corner = nowCorner;
        if (await card?.reset("corner")) return;
      }
      await card?.redraw();
    })
  );
  return { state: () => ({ where, quiz }) };
}

// src/main.js
var main_default = (tf) => {
  registerSettings(tf);
  runQuiz(tf);
};
export default main_default;
