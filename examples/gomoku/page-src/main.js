/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku page
 *
 * The board and everything around it: the lobby (your name, Start a game,
 * Join with a code), the code to send while waiting for the other player,
 * and the game itself with whose turn it is, Resign, Rematch and Leave.
 * The page holds the connection to the relay (a tile page may keep a
 * WebSocket open to a host its tile asks for; the tile itself can't), and
 * runs the match (match.js) in the open.
 *
 * Messages with the tile: the page says `hello` when it loads and gets
 * `setup` (its language, the labels, the relay's address, the player's id
 * and name, and the game to resume, if any). It sends `keep` (what to keep
 * for next time: the player's id and name, and the game, or null),
 * `notice` (something the other player did, only while this page doesn't
 * have the focus, for the tile to show as a notice), `event` (one word for
 * the tile's activity log) and `close`. The tile sends `leave` for its
 * Leave command. All text arrives from the tile in the user's language;
 * labels hold `{name}`, `{code}` or `{cell}` where those go.
 *
 * Modified 2026-10-29 (playing an AI agent): "Play against an agent" starts
 *   a game on this board alone (versus.js), the other color played by an
 *   agent in one of the user's panes through the tile's commands. The tile
 *   passes the agent's requests as `agent` messages ({ id, ask: "board",
 *   "play" or "versus", input }) and the page answers each with the board
 *   as the agent reads it (agent-view.js), waiting up to WAIT_MS for the
 *   agent's turn when asked to. In a game with another person, an agent may
 *   read the board and play for the user on their turn.
 * Modified 2026-10-29 (undo): Undo takes the user's last move back: at once
 *   against an agent, after the other player allows it in a game with
 *   someone (who sees Allow and Decline, and a notice while away).
 *
 * Built into page/main.js with `npx @tilefold/tile-tools build`.
 */
import { createBoard } from "./board.js";
import { showCode } from "./code.js";
import { cellName } from "./game.js";
import { createMatch, NAME_MAX } from "./match.js";
import { createRelay } from "./relay.js";
import { agentBoard, parseCell } from "./agent-view.js";
import { createVersus } from "./versus.js";

/** Longest an agent's "wait for my turn" is held, in milliseconds (the tile's command has ten seconds). */
export const WAIT_MS = 7000;

const bridge = window.tilefold;
const $ = (id) => document.getElementById(id);

/** Sends a message to the tile; a refused one (the tile is off) is dropped. */
const send = (message) => {
  if (bridge) bridge.post(message).catch(() => {});
};

/** The labels from the tile, by message key. */
let labels = {};

/** A label with its `{placeholders}` filled in. */
const L = (key, vars = {}) =>
  String(labels[key] ?? "").replace(/\{(name|code|cell)\}/g, (_, k) => String(vars[k] ?? ""));

/** Error codes from the match, as the lobby words them. */
const ERRORS = {
  "no-name": "error-no-name",
  "bad-code": "error-bad-code",
  "no-room": "error-no-room",
  "wrong-app": "error-no-room",
  "room-full": "error-room-full",
  "room-gone": "error-room-gone",
};

/** This player's random id, kept by the tile. */
let player = null;
let match = null;
/** The game against an agent, on this board alone. */
let versus = null;
let board = null;
/** Agents' requests waiting for their turn: { check(), timer }. */
const waiting = new Set();
/** The view last drawn. */
let view = null;
/** The last thing told to the tile for its activity log, so each is said once. */
let lastEvent = null;

/** A new random id for this player. */
const newPlayerId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

/**
 * Tells the tile what to keep: the player's id and name, and `saved` (the
 * game to resume, or null for none); without `saved`, the game kept stays.
 */
const keep = (saved) =>
  send({
    type: "keep",
    player,
    name: $("name").value.trim(),
    ...(saved === undefined ? {} : { saved }),
  });

/** One word for the tile's activity log, once per change. */
const event = (action) => {
  if (action === lastEvent) return;
  lastEvent = action;
  send({ type: "event", action });
};

/** The game being played: the one against the agent while it's open, else the match. */
const active = () => (versus && versus.view().phase !== "lobby" ? versus : match);

/** Something the other player did, as a notice, while the user is looking elsewhere. */
function notice(n) {
  if (document.hasFocus()) return;
  const cell = n.kind === "moved" || n.kind === "agent-moved" ? cellName(n.x, n.y) : "";
  send({ type: "notice", kind: n.kind, name: n.name, cell });
}

/** Shows one of the page's screens. */
function screen(name) {
  for (const id of ["lobby", "waiting", "game"]) $(id).hidden = id !== name;
}

/** The status line of a game in progress or over. */
function status(v) {
  const name = v.opponent?.name ?? "";
  if (v.room && !v.online) return L(v.offline ? "error-offline" : "status-reconnecting");
  if (v.phase === "over") {
    const r = v.result;
    if (!r.winner) return L("status-draw");
    if (r.winner === v.color)
      return L(r.resigned ? "result-they-resigned" : "status-won", { name });
    return L(r.resigned ? "result-you-resigned" : "status-lost", { name });
  }
  if (v.mode === "agent") return v.myTurn ? L("status-your-turn") : L("status-agent-turn");
  if (v.opponent?.gone) return L("status-gone", { name });
  if (!v.opponent?.here) return L("status-away", { name });
  return v.myTurn ? L("status-your-turn") : L("status-their-turn", { name });
}

/** A player's line above the board: their stone, name and whose turn it is. */
function playerLine(el, color, name, turn) {
  el.textContent = "";
  const stone = document.createElement("span");
  stone.className = `stone-chip ${color}`;
  stone.setAttribute("aria-hidden", "true");
  el.append(stone, document.createTextNode(`${name} · ${L(`stone-${color}`)}`));
  el.classList.toggle("to-move", turn);
}

/** Draws `v`, the match's view. */
function render(v) {
  // A game against the agent draws over the match, which waits in its lobby meanwhile.
  if (v.mode !== "agent" && versus && versus.view().phase !== "lobby") return;
  view = v;
  for (const w of [...waiting]) w.check();
  const busy = v.phase === "connecting" && !v.room;
  $("conn").textContent = v.room && !v.online ? "●" : "";
  $("conn").title = v.room && !v.online ? L("status-reconnecting") : "";

  if (v.phase === "lobby" || busy) {
    screen("lobby");
    for (const id of ["new", "join", "name", "code", "versus"]) $(id).disabled = busy;
    $("error").hidden = !v.error && !busy;
    $("error").textContent = busy
      ? L(v.offline ? "error-offline" : "status-connecting")
      : v.error
        ? L(ERRORS[v.error] ?? "error-server")
        : "";
    $("error").classList.toggle("is-error", !busy);
    $("cancel-connect").hidden = !busy;
    return;
  }

  if (v.phase === "waiting" && !v.opponent) {
    screen("waiting");
    $("room-code").value = showCode(v.room);
    $("waiting-status").textContent = v.online ? "" : L("status-reconnecting");
    event("created");
    return;
  }

  screen("game");
  const them = v.opponent?.name ?? "";
  const other = v.color === "black" ? "white" : "black";
  playerLine($("me"), v.color, L("player-you"), v.phase === "playing" && v.turn === v.color);
  playerLine($("them"), other, them, v.phase === "playing" && v.turn === other);
  $("status").textContent = status(v);
  board.draw({
    moves: v.moves,
    line: v.result?.line ?? null,
    playable: v.myTurn,
    label: (cell, stone) => (stone ? L(`cell-${stone}`, { cell }) : L("cell-empty", { cell })),
  });
  $("resign").hidden = v.phase !== "playing";
  $("undo").hidden = v.phase !== "playing";
  $("undo").disabled = !v.undo?.canAsk;
  $("undo").textContent = v.undo?.asked ? L("undo-waiting", { name: them }) : L("action-undo");
  const offered = !!v.undo?.offered;
  $("undo-offer").hidden = !offered && !v.undo?.declined;
  $("undo-text").textContent = offered
    ? L("undo-offered", { name: them })
    : L("undo-declined", { name: them });
  $("undo-allow").hidden = !offered;
  $("undo-decline").hidden = !offered;
  const over = v.phase === "over";
  $("rematch").hidden = !over || !!v.opponent?.gone;
  $("rematch").disabled = v.rematch.mine;
  $("rematch").textContent =
    v.mode === "agent"
      ? L("action-rematch")
      : v.rematch.mine
        ? L("rematch-waiting", { name: them })
        : v.rematch.theirs
          ? L("rematch-accept")
          : L("action-rematch");
  $("offer").hidden = v.mode === "agent" || !(over && v.rematch.theirs && !v.rematch.mine);
  $("offer").textContent = L("rematch-offered", { name: them });
  if (over) {
    const r = v.result;
    event(!r.winner ? "draw" : r.winner === v.color ? "won" : "lost");
  } else if (v.phase === "playing") {
    event("started");
  }
}

/** Puts the labels from the tile on the page's fixed parts. */
function applyLabels() {
  const text = {
    title: "page-title",
    intro: "lobby-intro",
    "name-label": "lobby-name",
    new: "lobby-new",
    versus: "lobby-agent",
    "code-label": "lobby-code",
    join: "lobby-join",
    "cancel-connect": "action-cancel",
    "waiting-title": "waiting-title",
    "waiting-hint": "waiting-hint",
    copy: "waiting-copy",
    cancel: "action-cancel",
    resign: "action-resign",
    "undo-allow": "undo-allow",
    "undo-decline": "undo-decline",
    leave: "action-leave",
  };
  for (const [id, key] of Object.entries(text)) $(id).textContent = L(key);
  $("name").placeholder = L("lobby-name-hint");
  $("code").placeholder = L("lobby-code-hint");
  $("close").title = L("page-close");
  $("close").setAttribute("aria-label", L("page-close"));
  $("board").setAttribute("aria-label", L("board-label"));
}

/** Copies the room code, or selects it for the user to copy when the page may not. */
async function copyCode() {
  const field = $("room-code");
  try {
    await navigator.clipboard.writeText(field.value);
    $("copy").textContent = L("waiting-copied");
    setTimeout(() => ($("copy").textContent = L("waiting-copy")), 2000);
  } catch {
    field.focus();
    field.select();
  }
}

/** Sets the page up from the tile's `setup`. */
function setup(m) {
  labels = m.labels ?? {};
  document.documentElement.lang = String(labels["page-lang"] ?? "en");
  document.documentElement.dir = labels["page-dir"] === "rtl" ? "rtl" : "ltr";
  applyLabels();
  player = typeof m.player === "string" && m.player ? m.player : newPlayerId();
  $("name").value = typeof m.name === "string" ? m.name.slice(0, NAME_MAX) : "";
  if (match) return render(match.view());

  const relay = createRelay({
    url: m.relay,
    WebSocket: window.WebSocket,
    onEvent: (e) => match.relayEvent(e),
  });
  match = createMatch({
    relay,
    player,
    onChange: render,
    onSave: keep,
    onNotice: notice,
  });
  versus = createVersus({
    agentName: L("agent-name"),
    onChange: render,
    onSave: keep,
    onNotice: notice,
  });
  keep(m.saved ?? null);
  if (m.saved?.mode === "agent") {
    if (!versus.resume(m.saved)) render(match.view());
  } else if (m.saved) match.resume(m.saved);
  else render(match.view());
  send({ type: "ready" });
}

/** Leaves the game against the agent, so the match's lobby shows again. */
function leaveVersus() {
  versus.leave();
  render(match.view());
}

/** Starts a game against the agent (the lobby's button, or the tile's command). */
function startVersus() {
  if (!versus || view?.room) return false;
  versus.start($("name").value);
  event("agent-game");
  return true;
}

/** What the page answers an agent's request with, once it can. */
function answerAgent(m) {
  const reply = (extra = {}) =>
    send({ type: "agent", id: m.id, reply: { ...extra, board: agentBoard(versusOrView()) } });
  if (!versus)
    return send({ type: "agent", id: m.id, reply: { error: "The board isn't ready yet." } });
  if (m.ask === "versus") {
    if (!startVersus())
      return reply({ error: "A game with another person is open; it must end first." });
    return reply({ ok: true });
  }
  if (m.ask === "play") {
    const point = parseCell(m.input);
    if (!point) return reply({ error: "Name a point such as H8: a column A-O and a row 1-15." });
    const why = playForAgent(point[0], point[1]);
    if (why) return reply({ error: AGENT_REFUSALS[why] ?? why });
    send({ type: "event", action: "agent-moved" });
    return reply({ ok: true, played: m.input.cell ?? m.input });
  }
  // "board": now, or once it's the agent's turn (or the game ends) when asked to wait.
  const ready = () => {
    const b = agentBoard(versusOrView());
    return !(m.input && m.input.wait === true) || b.yourTurn || b.phase !== "playing";
  };
  if (ready()) return reply();
  const w = {
    check() {
      if (!ready()) return;
      clearTimeout(w.timer);
      waiting.delete(w);
      reply();
    },
  };
  w.timer = setTimeout(() => {
    waiting.delete(w);
    reply({ waited: true });
  }, WAIT_MS);
  waiting.add(w);
}

/** The view an agent reads: the game against it while open, else the match's. */
const versusOrView = () =>
  versus && versus.view().phase !== "lobby" ? versus.view() : (match?.view() ?? null);

/** Why an agent's move was refused, in words it can act on. */
const AGENT_REFUSALS = {
  "no-game": 'No game is open. Run Gomoku\'s "Play against an agent" command first.',
  "not-your-turn": 'It isn\'t your turn. Read the board with { "wait": true } to wait for it.',
  "not-playing": "The game isn't being played right now (it's over, or waiting for a player).",
  taken: "That point already has a stone. Pick an empty one.",
  "off-board": "That point isn't on the board.",
  over: "The game is over.",
};

/** Plays (x, y) for the agent: its own color against the user, or the user's in a match. */
function playForAgent(x, y) {
  if (versus.view().phase !== "lobby") return versus.agentPlay(x, y);
  const v = match.view();
  if (v.phase === "lobby" || v.phase === "connecting") return "no-game";
  if (v.phase !== "playing") return "not-playing";
  if (!v.myTurn) return "not-your-turn";
  return match.play(x, y) ? null : "taken";
}

/** Wires the page's buttons and fields. */
function wire() {
  board = createBoard($("board"), { onPlay: (x, y) => active()?.play(x, y) });
  $("versus").addEventListener("click", () => startVersus());
  $("new").addEventListener("click", () => match?.create($("name").value));
  const join = () => match?.join($("code").value, $("name").value);
  $("join").addEventListener("click", join);
  $("code").addEventListener("keydown", (e) => {
    if (e.key === "Enter") join();
  });
  $("name").addEventListener("change", () => keep(undefined));
  $("name").maxLength = NAME_MAX;
  $("copy").addEventListener("click", () => void copyCode());
  $("cancel").addEventListener("click", () => match?.leave());
  $("cancel-connect").addEventListener("click", () => match?.leave());
  $("resign").addEventListener("click", () => active()?.resign());
  $("undo").addEventListener("click", () => {
    const against = active() === versus;
    // Every undo is recorded (not only the first in a row, as event() would).
    if (active()?.undo()) send({ type: "event", action: against ? "undid" : "undo-asked" });
  });
  $("undo-allow").addEventListener("click", () => match?.allowUndo());
  $("undo-decline").addEventListener("click", () => match?.declineUndo());
  $("rematch").addEventListener("click", () => active()?.rematch());
  $("leave").addEventListener("click", () => {
    if (active() === versus) leaveVersus();
    else match?.leave();
    event("left");
  });
  $("close").addEventListener("click", () => send({ type: "close" }));
  for (const id of ["name", "code"]) $(id).addEventListener("input", () => match?.dismiss());
}

wire();
bridge?.onMessage((m) => {
  if (!m || typeof m !== "object") return;
  if (m.do === "setup") setup(m);
  if (m.do === "agent" && typeof m.id === "string") answerAgent(m);
  if (m.do === "leave" && active() === versus) {
    leaveVersus();
    event("left");
  } else if (m.do === "leave" && view?.room) {
    match.leave();
    event("left");
  }
});
send({ type: "hello" });
