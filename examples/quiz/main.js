/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — quizzes on a borderless card
 *
 * Multiple-choice quizzes, one question at a time: says whether each answer
 * was right and why, keeps score and the best score. A short terminal quiz
 * comes with it; AI agents in the user's panes add more, made from the
 * user's own files. It shows on a borderless card floating over the panes,
 * light or dark, which the user drags by its grip, or in a panel beside the
 * panes (Settings → Tiles → Quiz). Each quiz resumes where it was left.
 *
 * Needs Tilefold 0.1.11 for the floating card and 0.1.14 for agents'
 * quizzes; 0.1.7 to 0.1.10 open the quiz in a window of its own, or in the
 * panel from 0.1.9.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
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

// src/library.js
var BUILTIN_ID = "terminal";
var LIMITS = Object.freeze({
  title: 80,
  questions: 30,
  question: 240,
  choice: 120,
  why: 240,
  minChoices: 2,
  maxChoices: 6,
  quizzes: 50
});
function builtinQuiz() {
  return {
    id: BUILTIN_ID,
    title: "quiz-title",
    builtin: true,
    questions: QUESTIONS.map((q) => ({
      text: q.text,
      why: q.why,
      choices: [...q.choices],
      answer: q.answer
    }))
  };
}
function line(value, max) {
  if (typeof value !== "string") return null;
  const s = value.replace(/\s+/g, " ").trim();
  return s && s.length <= max ? s : null;
}
var fix = (message) => Object.assign(new Error(message), { name: "TypeError" });
function checkQuiz(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw fix("Send an object: { title, questions: [{ question, choices, answer, why }] }.");
  }
  const raw = (
    /** @type {any} */
    input
  );
  const title = line(raw.title, LIMITS.title);
  if (!title) throw fix(`title must be text of 1 to ${LIMITS.title} characters.`);
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    throw fix("questions must be a list with at least one question.");
  }
  if (raw.questions.length > LIMITS.questions) {
    throw fix(`A quiz holds at most ${LIMITS.questions} questions; split it into several quizzes.`);
  }
  const questions = raw.questions.map((q, i) => {
    const at = `questions[${i}]`;
    if (!q || typeof q !== "object") throw fix(`${at} must be an object.`);
    const text = line(q.question, LIMITS.question);
    if (!text) throw fix(`${at}.question must be text of 1 to ${LIMITS.question} characters.`);
    if (!Array.isArray(q.choices) || q.choices.length < LIMITS.minChoices || q.choices.length > LIMITS.maxChoices) {
      throw fix(`${at}.choices must list ${LIMITS.minChoices} to ${LIMITS.maxChoices} answers.`);
    }
    const choices = q.choices.map((c, j) => {
      const s = line(c, LIMITS.choice);
      if (!s) throw fix(`${at}.choices[${j}] must be text of 1 to ${LIMITS.choice} characters.`);
      return s;
    });
    if (new Set(choices).size !== choices.length) throw fix(`${at}.choices must all differ.`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= choices.length) {
      throw fix(`${at}.answer must be the index (from 0) of the right choice.`);
    }
    const why = line(q.why, LIMITS.why);
    if (!why) throw fix(`${at}.why must explain the answer in 1 to ${LIMITS.why} characters.`);
    return { text, why, choices, answer: q.answer };
  });
  return { title, questions };
}
function quizId(title, now) {
  const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return `${slug || "quiz"}-${now.toString(36)}`;
}
function withBuiltin(index) {
  if (index.some((e) => e.id === BUILTIN_ID)) return index;
  const entry = {
    id: BUILTIN_ID,
    title: "quiz-title",
    builtin: true,
    count: QUESTIONS.length,
    added: "",
    best: null
  };
  return [entry, ...index];
}
var visible = (index) => index.filter((e) => !e.removed);
function entryFor(id, quiz, now) {
  return {
    id,
    title: quiz.title,
    count: quiz.questions.length,
    added: new Date(now).toISOString(),
    best: null
  };
}
var markRemoved = (index, id) => index.map((e) => e.id === id ? { ...e, removed: true } : e);
var markRestored = (index, id) => index.map((e) => {
  if (e.id !== id) return e;
  const { removed, ...rest } = e;
  void removed;
  return rest;
});
var withBest = (index, id, score) => index.map(
  (e) => e.id === id && (e.best === null || score > e.best) ? { ...e, best: score } : e
);
function readIndex(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (e) => e && typeof e.id === "string" && typeof e.title === "string" && Number.isInteger(e.count) && typeof e.added === "string" && (e.best === null || Number.isInteger(e.best))
  );
}
function readQuiz(value) {
  try {
    const q = checkQuiz(value && { title: value.title, questions: value.questions?.map(toInput) });
    return q;
  } catch {
    return null;
  }
}
var toInput = (q) => ({ question: q?.text, choices: q?.choices, answer: q?.answer, why: q?.why });

// src/agent.js
var AGENT_COMMANDS = [
  {
    id: "add-quiz",
    title: "cmd-add-quiz",
    input: "{ title, questions: [{ question, choices: 2-6 answers, answer: index of the right one from 0, why: one sentence }] }: a quiz made from the user's files, at most 30 questions; send several quizzes one by one"
  },
  { id: "list-quizzes", title: "cmd-list-quizzes" },
  {
    id: "remove-quiz",
    title: "cmd-remove-quiz",
    input: "{ id }: a quiz from list-quizzes to remove (it is kept, and restore-quiz brings it back)"
  },
  {
    id: "restore-quiz",
    title: "cmd-restore-quiz",
    input: "{ id }: a removed quiz from list-quizzes to bring back"
  }
];
var refuse = (message) => Object.assign(new Error(message), { name: "TypeError" });
function idOf(input) {
  const id = input && typeof input === "object" ? (
    /** @type {any} */
    input.id
  ) : null;
  if (typeof id !== "string" || !id) throw refuse("Send { id }, an id from list-quizzes.");
  return id;
}
function createAgentCommands(tf, o) {
  const howTo = async () => {
    await tf.toast(tf.t("toast-ask-agent"));
    return void 0;
  };
  return {
    async "add-quiz"(input) {
      if (input === null || input === void 0) return howTo();
      const quiz = checkQuiz(input);
      const index = await o.loadIndex();
      if (visible(index).length >= LIMITS.quizzes) {
        throw refuse(`The library holds at most ${LIMITS.quizzes} quizzes; remove one first.`);
      }
      const id = quizId(quiz.title, o.now());
      await o.store.saveQuiz(id, quiz);
      await o.saveIndex([...index, entryFor(id, quiz, o.now())]);
      o.audit("quiz-added", { quiz: id, questions: quiz.questions.length });
      await o.changed();
      return {
        id,
        title: quiz.title,
        questions: quiz.questions.length,
        note: "Added. The user finds it with Quiz: Show all quizzes."
      };
    },
    async "list-quizzes"() {
      const index = await o.loadIndex();
      await o.revealList();
      return {
        quizzes: visible(index).map((e) => ({
          id: e.id,
          title: e.builtin ? tf.t(e.title) : e.title,
          questions: e.count,
          best: e.best
        })),
        removed: index.filter((e) => e.removed).map((e) => ({ id: e.id, title: e.title }))
      };
    },
    async "remove-quiz"(input) {
      if (input === null || input === void 0) return howTo();
      const id = idOf(input);
      const index = await o.loadIndex();
      const entry = index.find((e) => e.id === id && !e.removed);
      if (!entry) throw refuse(`No quiz "${id}". Use list-quizzes to see the ids.`);
      if (id === BUILTIN_ID) throw refuse("The built-in quiz can't be removed.");
      await o.saveIndex(markRemoved(index, id));
      o.audit("quiz-removed", { quiz: id });
      await o.changed();
      return { removed: id, note: "Kept, not deleted: restore-quiz brings it back." };
    },
    async "restore-quiz"(input) {
      if (input === null || input === void 0) return howTo();
      const id = idOf(input);
      const index = await o.loadIndex();
      if (!index.some((e) => e.id === id && e.removed)) {
        throw refuse(`No removed quiz "${id}". Use list-quizzes to see the ids.`);
      }
      await o.saveIndex(markRestored(index, id));
      o.audit("quiz-restored", { quiz: id });
      await o.changed();
      return { restored: id };
    }
  };
}

// src/appearance.js
var APPEARANCES = ["auto", "light", "dark"];
var appearanceOf = (value) => APPEARANCES.includes(value) ? value : "auto";
function effectiveTheme(setting, switched, system) {
  if (switched) return switched;
  const s = appearanceOf(setting);
  if (s !== "auto") return s;
  return system === "dark" ? "dark" : "light";
}
var flipped = (theme) => theme === "dark" ? "light" : "dark";
var schemeOf = (value) => value === "dark" || value === "light" ? value : null;

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
var PAGE = Object.freeze({ w: 360, h: 340 });
var MIN_PAGE = Object.freeze({ w: 280, h: 240 });
var MAX_PAGE = Object.freeze({ w: 900, h: 1e3 });
var GRIP_H = 14;
var GRIP_GAP = 2;
var GRIP_PIECE = 256;
var cardOf = (page) => ({ w: page.w, h: GRIP_H + GRIP_GAP + page.h });
var cornerOf = (corner) => CORNERS.includes(corner) ? corner : "bottom-right";
var clamp = (n, lo, hi) => Math.round(Math.min(hi, Math.max(lo, n)));
function readSize(value, layout) {
  const v = (
    /** @type {any} */
    value
  );
  const ok = v && Number.isFinite(v.w) && Number.isFinite(v.h);
  const content = contentOf(layout);
  const maxW = Math.max(MIN_PAGE.w, Math.min(MAX_PAGE.w, content.w - 2 * MARGIN));
  const maxH = Math.max(
    MIN_PAGE.h,
    Math.min(MAX_PAGE.h, content.h - GRIP_H - GRIP_GAP - 2 * MARGIN)
  );
  const w = ok ? v.w : PAGE.w;
  const h = ok ? v.h : PAGE.h;
  return { w: clamp(w, MIN_PAGE.w, maxW), h: clamp(h, MIN_PAGE.h, maxH) };
}
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
function settle(layout, o, size) {
  const content = contentOf(layout);
  const { top, zones } = keepOut(layout);
  const maxY = Math.max(top, content.h - size.h);
  let y = Math.min(maxY, Math.max(top, o.y));
  for (let pass = 0; pass <= zones.length; pass++) {
    const hit = zones.find((z) => overlaps({ x: o.x, y, w: size.w, h: size.h }, z));
    if (!hit) break;
    const above = hit.y - MARGIN - size.h;
    y = above >= top ? above : Math.min(maxY, hit.y + hit.h + MARGIN);
  }
  const x = Math.min(Math.max(0, content.w - size.w), Math.max(0, o.x));
  return { x: Math.round(x), y: Math.round(y) };
}
function cornerOrigin(area, corner, size) {
  const left = corner.endsWith("left");
  const topCorner = corner.startsWith("top");
  return {
    x: left ? area.x + MARGIN : area.x + area.w - MARGIN - size.w,
    y: topCorner ? area.y + MARGIN : area.y + area.h - MARGIN - size.h
  };
}
function gripPieces(o, width) {
  const count = Math.max(1, Math.ceil(width / GRIP_PIECE));
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round(width * i / count);
    const next = Math.round(width * (i + 1) / count);
    pieces.push({ x: o.x + x, y: o.y, w: next - x, h: GRIP_H, from: x });
  }
  return pieces;
}
function cardSpots(layout, corner, position, page = PAGE) {
  const size = cardOf(page);
  const at = position ? placeAt(contentOf(layout), size.w, size.h, position) : cornerOrigin(areaOf(layout), cornerOf(corner), size);
  const o = settle(layout, at, size);
  return {
    card: { x: o.x, y: o.y, w: size.w, h: size.h },
    grip: gripPieces(o, size.w),
    page: { x: o.x, y: o.y + GRIP_H + GRIP_GAP, w: page.w, h: page.h }
  };
}

// src/grip.js
var COLORS = Object.freeze({
  dark: Object.freeze({ bar: "#262833", border: "#4a4e5e", dots: "#8d92a8" }),
  light: Object.freeze({ bar: "#f3f4f8", border: "#c9ccd8", dots: "#8a8fa3" })
});
function drawing(width, theme) {
  const c = theme === "light" ? COLORS.light : COLORS.dark;
  const mid = width / 2;
  const dots = [-12, -6, 0, 6, 12].map((d) => `<circle cx="${mid + d}" cy="${GRIP_H / 2}" r="1.5" fill="${c.dots}"/>`).join("");
  return `<rect x="0.5" y="0.5" width="${width - 1}" height="${GRIP_H - 1}" rx="${GRIP_H / 2}" fill="${c.bar}" fill-opacity="0.96" stroke="${c.border}"/>` + dots;
}
function piece(body, from, w) {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${GRIP_H}" viewBox="${from} 0 ${w} ${GRIP_H}">${body}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(doc);
}
function gripImages(width, pieces, theme = "dark") {
  const body = drawing(width, theme);
  return pieces.map((p) => piece(body, p.from, p.w));
}

// src/card.js
var POSITION_KEY = "position";
var SIZE_KEY = "size";
var isGrip = (id) => /^grip-\d+$/.test(String(id));
var PHASES = ["start", "move", "end"];
var amount = (n) => Number.isFinite(n) ? Math.round(n) : 0;
function createCard(tf, o) {
  let layout = null;
  let position = null;
  let size = readSize(null);
  let shown = false;
  let drawnIds = "";
  let lastPage = "";
  const drag = createDrag();
  let pageDrag = null;
  let pageSize = null;
  const audit = (action, details) => Promise.resolve().then(() => tf.audit(action, details)).catch(o.warn);
  const currentLayout = async () => {
    if (!layout) layout = await tf.overlay.layout();
    return layout;
  };
  const spots = async () => cardSpots(await currentLayout(), o.corner(), position, size);
  const items = (s) => {
    const images = gripImages(s.card.w, s.grip, o.theme());
    return s.grip.map((r, i) => ({
      id: `grip-${i}`,
      image: images[i],
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      hit: true,
      cursor: "grab",
      label: o.label()
    }));
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
    const scene = items(s);
    const ids = scene.map((i) => i.id).join();
    if (ids === drawnIds) await tf.overlay.update({ items: scene });
    else await tf.overlay.show({ items: scene });
    drawnIds = ids;
    dockPage(s.page);
  };
  const pin = (card) => {
    const content = contentOf(layout);
    const next = cardOf(size);
    position = positionFor(content, next.w, next.h, card.x, card.y);
  };
  return {
    /** Reads the place and size kept from an earlier session. */
    async load() {
      position = readPosition(await tf.store.get(POSITION_KEY));
      size = readSize(await tf.store.get(SIZE_KEY), await currentLayout());
    },
    /** Where the page goes now (to open it docked there). */
    async pageSpot() {
      return (await spots()).page;
    },
    /** Draws the grip; the page was just opened at `pageSpot()`. */
    async show() {
      const s = await spots();
      const scene = items(s);
      await tf.overlay.show({ items: scene });
      shown = true;
      drawnIds = scene.map((i) => i.id).join();
      lastPage = JSON.stringify(s.page);
    },
    /** Takes the grip away (the page is closing or closed). */
    async hide() {
      drag.cancel();
      pageDrag = null;
      pageSize = null;
      if (!shown) return;
      shown = false;
      lastPage = "";
      drawnIds = "";
      await tf.overlay.hide();
    },
    /** Redraws in the user's language, corner or appearance, after a change. */
    redraw: draw,
    /** Follows a new window layout. */
    async moved(next) {
      if (next && typeof next === "object") layout = next;
      size = readSize(size, layout);
      if (!drag.active() && !pageDrag && !pageSize) await draw();
    },
    /** Handles a pointer event on the overlay: drags by the grip. */
    async pointer(e) {
      if (!shown || !e || typeof e !== "object") return;
      const content = contentOf(await currentLayout());
      const card = cardOf(size);
      if (e.type === "dragstart" && isGrip(e.item)) {
        drag.start(e.x, e.y, (await spots()).card);
        return;
      }
      if (e.type === "drag") {
        const at = drag.move(e.x, e.y, content, card.w, card.h);
        if (at) {
          position = at;
          await draw();
        }
        return;
      }
      if (e.type === "drop") {
        const at = drag.end(e.x, e.y, content, card.w, card.h);
        if (!at) return;
        position = at;
        await draw();
        await tf.store.set(POSITION_KEY, position);
        void audit("card-moved", { via: "grip" });
      }
    },
    /** The page's top bar was dragged by `dx`,`dy` since the press. */
    async pageMove(m) {
      if (!shown || !m || !PHASES.includes(m.phase)) return;
      if (m.phase === "start") {
        pageDrag = (await spots()).card;
        return;
      }
      if (!pageDrag) return;
      const card = cardOf(size);
      const content = contentOf(await currentLayout());
      position = positionFor(
        content,
        card.w,
        card.h,
        pageDrag.x + amount(m.dx),
        pageDrag.y + amount(m.dy)
      );
      await draw();
      if (m.phase === "end") {
        pageDrag = null;
        await tf.store.set(POSITION_KEY, position);
        void audit("card-moved", { via: "card" });
      }
    },
    /** The page's corner was dragged by `dw`,`dh` since the press. */
    async pageResize(m) {
      if (!shown || !m || !PHASES.includes(m.phase)) return;
      if (m.phase === "start") {
        pageSize = { size, at: (await spots()).card };
        return;
      }
      if (!pageSize) return;
      size = readSize(
        { w: pageSize.size.w + amount(m.dw), h: pageSize.size.h + amount(m.dh) },
        await currentLayout()
      );
      pin(pageSize.at);
      await draw();
      if (m.phase === "end") {
        pageSize = null;
        await tf.store.set(SIZE_KEY, size);
        await tf.store.set(POSITION_KEY, position);
        void audit("card-resized", { w: size.w, h: size.h });
      }
    },
    /** Puts the card back in the pane's corner; false if it was there already. */
    async reset(via) {
      drag.cancel();
      pageDrag = null;
      if (!position) return false;
      position = null;
      await tf.store.delete(POSITION_KEY);
      void audit("card-reset", { via });
      await draw();
      return true;
    },
    get visible() {
      return shown;
    }
  };
}

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
var APPEARANCE_KEYS = {
  auto: "setting-appearance-auto",
  light: "setting-appearance-light",
  dark: "setting-appearance-dark"
};
var COMMANDS = [
  { id: "open", title: "cmd-open" },
  { id: "list", title: "cmd-list" },
  { id: "close", title: "cmd-close" },
  { id: "restart", title: "cmd-restart" },
  { id: "theme", title: "cmd-theme" },
  { id: "put-back", title: "cmd-put-back" }
];
function registerSettings(tf) {
  tf.setting("showAs", "card", tf.t("setting-show-as"), {
    choices: SHOW_AS.map((value) => ({ value, label: tf.t(SHOW_AS_KEYS[value]) }))
  });
  tf.setting("corner", "bottom-right", tf.t("setting-corner"), {
    choices: CORNERS.map((value) => ({ value, label: tf.t(CORNER_KEYS[value]) }))
  });
  tf.setting("appearance", "auto", tf.t("setting-appearance"), {
    choices: APPEARANCES.map((value) => ({ value, label: tf.t(APPEARANCE_KEYS[value]) }))
  });
}
var read = (settings, key) => {
  try {
    return settings.get(key);
  } catch {
    return void 0;
  }
};
var showAsSetting = (settings) => read(settings, "showAs") === "panel" ? "panel" : "card";
var cornerSetting = (settings) => cornerOf(read(settings, "corner"));
var appearanceSetting = (settings) => appearanceOf(read(settings, "appearance"));

// src/store.js
var KEYS = Object.freeze({
  index: "quizzes",
  current: "current",
  appearance: "appearance",
  quiz: (id) => `quiz:${id}`,
  progress: (id) => `progress:${id}`
});
function createStore(tf) {
  const get = (key) => tf.store.get(key);
  const set = (key, value) => tf.store.set(key, value);
  return {
    async index() {
      return readIndex(await get(KEYS.index));
    },
    saveIndex: (index) => set(KEYS.index, index),
    /** A quiz by id: the built-in one, or one an agent added (null if gone). */
    async quiz(id) {
      if (id === BUILTIN_ID) return builtinQuiz();
      const q = readQuiz(await get(KEYS.quiz(id)));
      return q ? { id, ...q } : null;
    },
    saveQuiz: (id, quiz) => set(KEYS.quiz(id), { title: quiz.title, questions: quiz.questions }),
    async progress(id, total) {
      return restoreQuiz(await get(KEYS.progress(id)), total);
    },
    saveProgress: (id, state) => set(KEYS.progress(id), state),
    async current() {
      const id = await get(KEYS.current);
      return typeof id === "string" && id ? id : null;
    },
    saveCurrent: (id) => id ? set(KEYS.current, id) : tf.store.delete(KEYS.current),
    async appearance() {
      const a = await get(KEYS.appearance);
      return a === "light" || a === "dark" ? a : null;
    },
    saveAppearance: (a) => a ? set(KEYS.appearance, a) : tf.store.delete(KEYS.appearance)
  };
}

// src/view.js
var letter = (i) => String.fromCharCode(65 + i);
var say = (quiz, t, text) => quiz.builtin ? t(text) : text;
var titleOf = (entry, t) => entry.builtin ? t(entry.title) : entry.title;
var ROW_MAX = 256;
var fit = (s) => s.length > ROW_MAX ? `${s.slice(0, ROW_MAX - 1)}\u2026` : s;
function markOf(state, q, i) {
  if (state.picked === null) return "none";
  if (i === q.answer) return "right";
  return i === state.picked ? "wrong" : "none";
}
var scoreLine = (t, state) => t("quiz-score", { score: state.score, total: state.total });
var nextLabel = (t, state) => t(state.index + 1 >= state.total ? "quiz-finish" : "quiz-next");
var progressLine = (t, state) => t("quiz-progress", { n: state.index + 1, total: state.total });
function cardView(state, quiz, t) {
  const title = say(quiz, t, quiz.title);
  if (state.done) {
    return {
      screen: "quiz",
      title,
      done: true,
      score: scoreLine(t, state),
      again: t("quiz-again")
    };
  }
  const q = quiz.questions[state.index];
  const answered = state.picked !== null;
  return {
    screen: "quiz",
    title,
    done: false,
    progress: progressLine(t, state),
    question: say(quiz, t, q.text),
    choices: q.choices.map((text, i) => ({ letter: letter(i), text, mark: markOf(state, q, i) })),
    picked: state.picked,
    result: answered ? t(state.picked === q.answer ? "quiz-right" : "quiz-wrong") : null,
    correct: answered ? state.picked === q.answer : null,
    why: answered ? say(quiz, t, q.why) : null,
    next: answered ? nextLabel(t, state) : null
  };
}
var detailOf = (entry, t) => entry.best === null ? t("list-count", { count: entry.count }) : t("list-best", { count: entry.count, best: entry.best });
function listCardView(entries, t) {
  return {
    screen: "list",
    title: t("list-title"),
    quizzes: entries.map((e) => ({ id: e.id, title: titleOf(e, t), detail: detailOf(e, t) })),
    hint: t("list-hint")
  };
}
var ROW = Object.freeze({
  list: "list",
  question: "question",
  result: "result",
  why: "why",
  next: "next",
  score: "score",
  again: "again",
  hint: "hint"
});
function choiceOfRow(id) {
  const m = /^choice-(\d+)$/.exec(String(id));
  return m ? Number(m[1]) : null;
}
function quizOfRow(id) {
  const m = /^quiz:(.+)$/.exec(String(id));
  return m ? m[1] : null;
}
var backRow = (t) => ({ id: ROW.list, label: t("list-back"), icon: "link", muted: true });
function panelView(state, quiz, t) {
  const title = fit(say(quiz, t, quiz.title));
  if (state.done) {
    return {
      title: title.slice(0, 120),
      subtitle: t("quiz-over"),
      rows: [
        backRow(t),
        { id: ROW.score, label: scoreLine(t, state), icon: "info", tone: "success" },
        { id: ROW.again, label: t("quiz-again"), icon: "link" }
      ]
    };
  }
  const q = quiz.questions[state.index];
  const answered = state.picked !== null;
  const tones = { right: "success", wrong: "error" };
  const rows = [
    backRow(t),
    { id: ROW.question, label: fit(say(quiz, t, q.text)), icon: "info" },
    ...q.choices.map((text, i) => {
      const mark = markOf(state, q, i);
      return {
        id: `choice-${i}`,
        label: fit(`${letter(i)}. ${text}`),
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
    rows.push({ id: ROW.why, label: fit(say(quiz, t, q.why)), icon: "none", muted: true });
    rows.push({ id: ROW.next, label: nextLabel(t, state), icon: "link" });
  }
  return { title: title.slice(0, 120), subtitle: progressLine(t, state), rows };
}
function listPanelView(entries, t) {
  return {
    title: t("list-title"),
    rows: entries.map((e) => ({
      id: `quiz:${e.id}`,
      label: fit(titleOf(e, t)),
      icon: "link",
      trail: detailOf(e, t).slice(0, 32)
    })),
    footer: { rows: [{ id: ROW.hint, label: fit(t("list-hint")), icon: "info", muted: true }] }
  };
}

// src/run.js
function runQuiz(tf) {
  const warn = (err) => void Promise.resolve().then(() => tf.log.warn(String(err && err.message ? err.message : err))).catch(() => {
  });
  const audit = (action, details) => void Promise.resolve().then(() => tf.audit(action, details)).catch(warn);
  const store = createStore(tf);
  let loaded = false;
  let index = [];
  let quiz = null;
  let state = null;
  let where = null;
  let switched = null;
  let system = null;
  const theme = () => effectiveTheme(appearanceSetting(tf.settings), switched, system);
  const canDock = () => typeof tf.page?.dock === "function" && !!tf.overlay;
  const card = canDock() ? createCard(tf, {
    corner: () => cornerSetting(tf.settings),
    theme,
    label: () => tf.t("grip-label"),
    warn
  }) : null;
  const loadIndex = async () => withBuiltin(await store.index());
  const saveIndex = async (next2) => {
    index = next2;
    await store.saveIndex(next2);
  };
  const select = async (id) => {
    const entry = visible(index).find((e) => e.id === id);
    const q = entry ? await store.quiz(id) : null;
    if (!q) {
      quiz = null;
      state = null;
      await store.saveCurrent(null);
      return false;
    }
    quiz = q;
    state = await store.progress(id, q.questions.length);
    await store.saveCurrent(id);
    return true;
  };
  const load = async () => {
    if (loaded) return;
    loaded = true;
    index = await loadIndex();
    const current = await store.current();
    if (current) await select(current);
    switched = await store.appearance();
    await card?.load();
  };
  const post = async (message) => {
    try {
      await tf.page.post(message);
    } catch {
    }
  };
  const render = async () => {
    if (where === "panel") {
      const content = quiz ? panelView(state, quiz, tf.t) : listPanelView(visible(index), tf.t);
      await tf.panel.show(content);
    } else if (where) {
      const view = quiz ? cardView(state, quiz, tf.t) : listCardView(visible(index), tf.t);
      await post({ do: "show", view });
    }
  };
  const update = async (next2) => {
    if (!quiz || next2 === state) return;
    state = next2;
    await store.saveProgress(quiz.id, state);
    await render();
  };
  const open = async () => {
    await load();
    const wanted = showAsSetting(tf.settings);
    if (where) {
      if ((where === "panel" ? "panel" : "card") === wanted) return render();
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
    audit("opened", { as: where });
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
    if (record) audit("closed", { as: was });
  };
  const showList = async () => {
    await load();
    index = await loadIndex();
    quiz = null;
    state = null;
    await store.saveCurrent(null);
    if (where) await render();
    else await open();
    await card?.redraw();
  };
  const openQuiz = async (id) => {
    await load();
    if (!await select(String(id))) return render();
    if (where) await render();
    else await open();
    await card?.redraw();
  };
  const restart = async () => {
    await load();
    if (!quiz) await select(BUILTIN_ID);
    if (!quiz) return;
    await update(startQuiz(quiz.questions.length));
    audit("restarted", { quiz: quiz.id });
    if (!where) await open();
  };
  const pick = async (i) => {
    if (!quiz) return;
    const n = state.index + 1;
    const { state: next2, correct } = pickChoice(state, quiz.questions, i);
    if (correct === null) return;
    await update(next2);
    audit("answered", { quiz: quiz.id, question: n, correct });
  };
  const next = async () => {
    if (!quiz) return;
    const after = nextQuestion(state);
    if (after === state) return;
    if (after.done) await saveIndex(withBest(index, quiz.id, after.score));
    await update(after);
    if (after.done) audit("finished", { quiz: quiz.id, score: after.score, total: after.total });
  };
  const applyTheme = async () => {
    if (where === "card" || where === "window") await post({ do: "theme", theme: theme() });
    await card?.redraw();
  };
  const switchTheme = async () => {
    await load();
    switched = flipped(theme());
    await store.saveAppearance(switched);
    audit("theme-switched", { to: switched });
    await applyTheme();
  };
  const hear = async (m) => {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") {
      system = schemeOf(m.scheme) ?? system;
      await post({
        do: "setup",
        lang: tf.t("page-lang"),
        dir: tf.t("page-dir"),
        theme: theme(),
        // Only a docked card moves and resizes from the page; a window has its own frame.
        docked: where === "card",
        labels: {
          close: tf.t("page-close"),
          list: tf.t("list-back"),
          theme: tf.t("page-theme"),
          resize: tf.t("page-resize")
        }
      });
      await card?.redraw();
      return render();
    }
    if (m.type === "scheme") {
      system = schemeOf(m.scheme) ?? system;
      return applyTheme();
    }
    if (m.type === "pick") return pick(Number(m.choice));
    if (m.type === "next") return next();
    if (m.type === "again") return restart();
    if (m.type === "list") return showList();
    if (m.type === "open-quiz") return openQuiz(m.id);
    if (m.type === "theme") return switchTheme();
    if (m.type === "move") return card?.pageMove(m);
    if (m.type === "resize") return card?.pageResize(m);
    if (m.type === "close") return close();
  };
  const clicked = async (e) => {
    if (where !== "panel" || !e || e.action !== "activate") return;
    const choice = choiceOfRow(e.row);
    if (choice !== null) return pick(choice);
    const id = quizOfRow(e.row);
    if (id !== null) return openQuiz(id);
    if (e.row === ROW.list) return showList();
    if (e.row === ROW.next) return next();
    if (e.row === ROW.again) return restart();
  };
  const agent = createAgentCommands(tf, {
    store,
    loadIndex: async () => {
      await load();
      return index;
    },
    saveIndex,
    // Shows the list only when the quiz is closed: never pulls the user out of a quiz.
    revealList: async () => where ? void 0 : showList(),
    // The list on show takes in what an agent changed.
    changed: async () => where && !quiz ? render() : void 0,
    audit,
    now: () => Date.now()
  });
  const background = (fn) => (e) => void Promise.resolve().then(() => fn(e)).catch(warn);
  const runs = {
    open,
    list: showList,
    close: () => close(),
    restart,
    theme: switchTheme,
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
  for (const c of AGENT_COMMANDS) {
    tf.command(tf.t(c.title), (input) => agent[c.id](input), {
      id: c.id,
      ...c.input ? { input: c.input } : {}
    });
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
        audit("closed", { as: "page" });
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
        audit("closed", { as: "panel" });
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
    // with "Quiz: Start or show". Everything stays kept.
    background(() => where === "card" ? close() : void 0)
  );
  let corner = cornerSetting(tf.settings);
  let showAs = showAsSetting(tf.settings);
  let appearance = appearanceSetting(tf.settings);
  tf.on(
    "setting.changed",
    background(async () => {
      const now = {
        corner: cornerSetting(tf.settings),
        showAs: showAsSetting(tf.settings),
        appearance: appearanceOf(appearanceSetting(tf.settings))
      };
      if (now.showAs !== showAs) {
        showAs = now.showAs;
        if (where) await open();
      }
      if (now.appearance !== appearance) {
        appearance = now.appearance;
        await load();
        switched = null;
        await store.saveAppearance(null);
        await applyTheme();
      }
      if (now.corner !== corner) {
        corner = now.corner;
        if (await card?.reset("corner")) return;
      }
      await card?.redraw();
    })
  );
  return { state: () => ({ where, quiz: quiz?.id ?? null, state }) };
}

// src/main.js
var main_default = (tf) => {
  registerSettings(tf);
  runQuiz(tf);
};
export default main_default;
