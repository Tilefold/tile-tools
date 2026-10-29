/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo page
 *
 * The board and everything around it: the lobby (your name, the board
 * size, Start a game, Play against an agent, Join with a code), the code to
 * send while waiting for the other player, and the game itself: the board
 * with its coordinates round it and a rough guess at who's ahead above it,
 * whose turn it is, Pass, Undo, Resign, and once both passed the marking of
 * dead stones with the score and Accept; then Play again and Leave. The page
 * holds the connection to the relay (a tile page may keep a WebSocket open
 * to a host its tile asks for; the tile itself can't), and runs the match
 * (match.js) or the game against an agent (versus.js) in the open.
 *
 * Messages with the tile: the page says `hello` when it loads and gets
 * `setup` (the labels in the user's language, the relay's address, the
 * player's id and name, and the game to resume, if any). It sends `keep`
 * (what to keep for next time: the player's id and name, and the game, or
 * null), `notice` (something the other player or the agent did, only while
 * this page doesn't have the focus, for the tile to show as a notice),
 * `event` (one word for the tile's activity log), `ready`, `agent` (the
 * answer to an agent's request, agent-requests.js) and `close`. The tile
 * sends `leave` for its Leave command and `agent` for an agent's command.
 * Labels hold `{name}`, `{code}`, `{cell}`, `{black}`, `{white}` or
 * `{margin}` where those go.
 *
 * Built into page/main.js with `npx @tilefold/tile-tools build`.
 */
import { createAgentRequests } from "./agent-requests.js";
import { createBoard } from "./board.js";
import { showCode } from "./code.js";
import { isPass, otherColor, positionOf } from "./game.js";
import { DEFAULT_SIZE, NAME_MAX, createMatch } from "./match.js";
import { createRelay } from "./relay.js";
import { areaOf, scoreOf } from "./score.js";
import { estimateOf, percentOf } from "./estimate.js";
import { createVersus } from "./versus.js";

const bridge = window.tilefold;
const $ = (id) => document.getElementById(id);

/** Sends a message to the tile; a refused one (the tile is off) is dropped. */
const send = (message) => {
  if (bridge) bridge.post(message).catch(() => {});
};

/** The labels from the tile, by message key. */
let labels = {};

/** A number as the user's language writes it (7.5, or 7,5). */
const num = (n) => {
  try {
    return new Intl.NumberFormat(document.documentElement.lang || "en").format(n);
  } catch {
    return String(n);
  }
};

/** A label with its `{placeholders}` filled in. */
const L = (key, vars = {}) =>
  String(labels[key] ?? "").replace(/\{(name|code|cell|black|white|margin)\}/g, (_, k) =>
    typeof vars[k] === "number" ? num(vars[k]) : String(vars[k] ?? ""),
  );

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
let agent = null;
/** The view last drawn. */
let view = null;
/** The last thing told to the tile for its activity log, so each is said once. */
let lastEvent = null;

/** A new random id for this player. */
const newPlayerId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

/** The board size picked in the lobby. */
const pickedSize = () => Number($("size").value) || DEFAULT_SIZE;

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

/** Something the other player or the agent did, as a notice, while the user is looking elsewhere. */
function notice(n) {
  if (document.hasFocus()) return;
  send({ type: "notice", kind: n.kind, name: n.name, cell: n.cell ?? "" });
}

/** Shows one of the page's screens. */
function screen(name) {
  for (const id of ["lobby", "waiting", "game"]) $(id).hidden = id !== name;
}

/** The status line of a game in progress, being marked, or over. */
function status(v) {
  const name = v.opponent?.name ?? "";
  if (v.room && !v.online) return L(v.offline ? "error-offline" : "status-reconnecting");
  if (v.phase === "over") {
    const r = v.result;
    const margin = r.score?.margin;
    if (r.winner === v.color)
      return L(r.resigned ? "result-they-resigned" : "status-won", { name, margin });
    return L(r.resigned ? "result-you-resigned" : "status-lost", { name, margin });
  }
  if (v.mode !== "agent" && v.opponent?.gone) return L("status-gone", { name });
  if (v.mode !== "agent" && !v.opponent?.here) return L("status-away", { name });
  if (v.phase === "scoring") return L("status-scoring");
  const theyPassed = v.myTurn && isPass(v.moves.at(-1));
  if (v.mode === "agent") {
    if (!v.myTurn) return L("status-agent-turn");
    return L(theyPassed ? "status-agent-passed" : "status-your-turn");
  }
  if (!v.myTurn) return L("status-their-turn", { name });
  return theyPassed ? L("status-they-passed", { name }) : L("status-your-turn");
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

/** How a point reads to a screen reader. */
function pointLabel(cell, stone, dead, owner) {
  if (stone) return L(dead ? `cell-${stone}-dead` : `cell-${stone}`, { cell });
  return owner ? L(`cell-${owner}-area`, { cell }) : L("cell-empty", { cell });
}

/** Draws the board of `v`, with the dead stones and the areas while they're marked. */
function drawBoard(v) {
  const pos = positionOf(v.moves, v.size);
  const scoring = v.phase === "scoring";
  const dead = scoring ? v.marks.dead : [];
  const last = v.moves.at(-1);
  board.draw({
    size: v.size,
    board: pos.board,
    last: last && !isPass(last) ? last[1] * v.size + last[0] : null,
    playable: v.myTurn,
    marking: !!v.marking,
    dead: new Set(dead),
    area: scoring ? areaOf(pos.board, v.size, dead) : null,
    label: pointLabel,
  });
  $("scoring").hidden = !scoring;
  if (!scoring) return;
  const score = scoreOf(pos.board, v.size, dead);
  const name = v.opponent?.name ?? "";
  $("scoring-hint").textContent = L(v.mode === "agent" ? "scoring-hint-agent" : "scoring-hint");
  $("score-line").textContent = L("score-line", { black: score.black, white: score.white });
  $("accept-status").textContent = v.marks.mine
    ? L("accept-waiting", { name })
    : v.marks.theirs
      ? L("accept-theirs", { name })
      : "";
}

/**
 * The bar for who's ahead while the game is played or marked: black's
 * winning chances as its share of the bar, and the chances and the lead in
 * words. Hidden once the game is over, when the status line says who won.
 */
function drawLead(v) {
  $("lead").hidden = v.phase !== "playing" && v.phase !== "scoring";
  if ($("lead").hidden) return;
  const scoring = v.phase === "scoring";
  const guess = estimateOf(positionOf(v.moves, v.size).board, v.size, {
    dead: scoring ? v.marks.dead : [],
    ended: scoring,
  });
  const black = percentOf(guess.blackChance);
  $("lead-black").style.width = `${black}%`;
  $("lead-line").textContent = `${L("lead-chances", { black, white: 100 - black })} · ${L(
    `lead-${guess.leader}`,
    { margin: guess.margin },
  )}`;
}

/** Draws `v`, the match's view or the game against the agent's. */
function render(v) {
  // A game against the agent draws over the match, which waits in its lobby meanwhile.
  if (v.mode !== "agent" && versus && versus.view().phase !== "lobby") return;
  view = v;
  agent?.changed();
  const busy = v.phase === "connecting" && !v.room;
  $("conn").textContent = v.room && !v.online ? "●" : "";
  $("conn").title = v.room && !v.online ? L("status-reconnecting") : "";

  if (v.phase === "lobby" || busy) {
    screen("lobby");
    for (const id of ["new", "join", "name", "code", "versus", "size"]) $(id).disabled = busy;
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
  const other = otherColor(v.color);
  playerLine($("me"), v.color, L("player-you"), v.phase === "playing" && v.turn === v.color);
  playerLine($("them"), other, them, v.phase === "playing" && v.turn === other);
  $("status").textContent = status(v);
  drawLead(v);
  drawBoard(v);
  const playing = v.phase === "playing";
  const scoring = v.phase === "scoring";
  $("pass").hidden = !playing;
  $("pass").disabled = !v.myTurn;
  $("accept").hidden = !scoring;
  $("accept").disabled = !v.marking || v.marks.mine;
  $("resign").hidden = !playing && !scoring;
  $("undo").hidden = !playing && !scoring;
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
  if (over) event(v.result.winner === v.color ? "won" : "lost");
  else if (scoring) event("scoring");
  else if (playing) event("started");
}

/** Puts the labels from the tile on the page's fixed parts. */
function applyLabels() {
  const text = {
    title: "page-title",
    intro: "lobby-intro",
    "name-label": "lobby-name",
    "size-label": "lobby-size",
    "size-9": "size-nine",
    "size-13": "size-thirteen",
    "size-19": "size-nineteen",
    new: "lobby-new",
    versus: "lobby-agent",
    "code-label": "lobby-code",
    join: "lobby-join",
    "cancel-connect": "action-cancel",
    "waiting-title": "waiting-title",
    "waiting-hint": "waiting-hint",
    copy: "waiting-copy",
    cancel: "action-cancel",
    pass: "action-pass",
    accept: "action-accept",
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
  $("lead").title = L("lead-hint");
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

/** Starts a game against the agent (the lobby's button, or the tile's command). */
function startVersus() {
  if (!versus || view?.room) return false;
  // Recorded first, so the game's own "started" follows it once.
  event("agent-game");
  versus.start($("name").value, pickedSize());
  return true;
}

/** Leaves the game against the agent, so the match's lobby shows again. */
function leaveVersus() {
  versus.leave();
  render(match.view());
}

/** The view an agent reads: the game against it while open, else the match's. */
const agentView = () =>
  versus && versus.view().phase !== "lobby" ? versus.view() : (match?.view() ?? null);

/** What an agent may do: against the user, its own color; in a match, the user's. */
const forAgent = {
  play(move) {
    if (versus.view().phase !== "lobby") {
      const why = versus.agentPlay(move);
      if (!why) send({ type: "event", action: "agent-moved" });
      return why;
    }
    const v = match.view();
    if (v.phase === "lobby" || v.phase === "connecting") return "no-game";
    if (v.phase !== "playing") return v.phase === "scoring" ? "ended" : "not-playing";
    if (!v.myTurn) return "not-your-turn";
    const played = isPass(move) ? match.pass() : match.play(move[0], move[1]);
    if (played) send({ type: "event", action: "agent-moved" });
    return played ? null : "taken";
  },
  mark(points) {
    if (versus.view().phase !== "lobby") return versus.agentDead(points);
    if (!match.view().marking) return "not-scoring";
    match.setDead(points);
    return null;
  },
  accept() {
    if (versus.view().phase !== "lobby") return versus.agentAccept();
    if (!match.view().marking) return "not-scoring";
    match.accept();
    return null;
  },
};

/** Sets the page up from the tile's `setup`. */
function setup(m) {
  labels = m.labels ?? {};
  document.documentElement.lang = String(labels["page-lang"] ?? "en");
  document.documentElement.dir = labels["page-dir"] === "rtl" ? "rtl" : "ltr";
  applyLabels();
  player = typeof m.player === "string" && m.player ? m.player : newPlayerId();
  $("name").value = typeof m.name === "string" ? m.name.slice(0, NAME_MAX) : "";
  if (match) return render(active().view());

  const relay = createRelay({
    url: m.relay,
    WebSocket: window.WebSocket,
    onEvent: (e) => match.relayEvent(e),
  });
  match = createMatch({ relay, player, onChange: render, onSave: keep, onNotice: notice });
  versus = createVersus({
    agentName: L("agent-name"),
    onChange: render,
    onSave: keep,
    onNotice: notice,
  });
  agent = createAgentRequests({ send, view: agentView, start: startVersus, ...forAgent });
  keep(m.saved ?? null);
  if (m.saved?.mode === "agent") {
    if (!versus.resume(m.saved)) render(match.view());
  } else if (m.saved) match.resume(m.saved);
  else render(match.view());
  send({ type: "ready" });
}

/** A click (or Enter) on a point: a stone while playing, a dead chain while marking. */
function onPoint(x, y) {
  const game = active();
  const v = game?.view();
  if (!v) return;
  if (v.phase === "scoring") game.mark(y * v.size + x);
  else game.play(x, y);
}

/** Wires the page's buttons and fields. */
function wire() {
  board = createBoard($("board"), { onPoint, frame: $("board-frame") });
  $("versus").addEventListener("click", () => startVersus());
  $("new").addEventListener("click", () => match?.create($("name").value, pickedSize()));
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
  $("pass").addEventListener("click", () => active()?.pass());
  $("accept").addEventListener("click", () => active()?.accept());
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
  if (m.do === "agent" && typeof m.id === "string") {
    if (!agent) send({ type: "agent", id: m.id, reply: { error: "The board isn't ready yet." } });
    else agent.answer(m);
  }
  if (m.do === "leave" && active() === versus) {
    leaveVersus();
    event("left");
  } else if (m.do === "leave" && view?.room) {
    match.leave();
    event("left");
  }
});
send({ type: "hello" });
