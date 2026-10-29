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
 *
 * Built into page/main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from page-src/main.js. Edit the sources, then rebuild.
(() => {
  // page-src/game.js
  var SIZE = 15;
  var FIVE = 5;
  var COLUMNS = "ABCDEFGHIJKLMNO";
  var DIRECTIONS = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];
  var colorOfMove = (n) => n % 2 === 0 ? "black" : "white";
  var turnOf = (moves) => colorOfMove(moves.length);
  var onBoard = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  var cellName = (x, y) => `${COLUMNS[x]}${SIZE - y}`;
  function boardOf(moves) {
    const board2 = Array.from({ length: SIZE * SIZE }, () => null);
    moves.forEach(([x, y], n) => {
      board2[y * SIZE + x] = colorOfMove(n);
    });
    return board2;
  }
  var stoneAt = (board2, x, y) => onBoard(x, y) ? board2[y * SIZE + x] : null;
  function lineThrough(board2, x, y) {
    const color = stoneAt(board2, x, y);
    if (!color) return null;
    let best = null;
    for (const [dx, dy] of DIRECTIONS) {
      const line = [[x, y]];
      for (let i = 1; stoneAt(board2, x + dx * i, y + dy * i) === color; i++) {
        line.push([x + dx * i, y + dy * i]);
      }
      for (let i = 1; stoneAt(board2, x - dx * i, y - dy * i) === color; i++) {
        line.unshift([x - dx * i, y - dy * i]);
      }
      if (line.length >= FIVE && (!best || line.length > best.length)) best = line;
    }
    return best;
  }
  function refusal(moves, x, y) {
    if (resultOf(moves)) return "over";
    if (!onBoard(x, y)) return "off-board";
    if (boardOf(moves)[y * SIZE + x]) return "taken";
    return null;
  }
  function resultOf(moves) {
    if (moves.length === 0) return null;
    const board2 = boardOf(moves);
    const [x, y] = moves[moves.length - 1];
    const line = lineThrough(board2, x, y);
    if (line) return { winner: colorOfMove(moves.length - 1), line };
    if (moves.length >= SIZE * SIZE) return { winner: null, line: null };
    return null;
  }
  function isValidGame(moves) {
    if (!Array.isArray(moves) || moves.length > SIZE * SIZE) return false;
    const played = [];
    for (const move of moves) {
      if (!Array.isArray(move) || move.length !== 2) return false;
      const [x, y] = move;
      if (refusal(played, x, y)) return false;
      played.push([x, y]);
    }
    return true;
  }

  // page-src/board.js
  function createBoard(root, { onPlay }) {
    const points = [];
    let focusIndex = Math.floor(SIZE * SIZE / 2);
    root.setAttribute("role", "grid");
    for (let y = 0; y < SIZE; y++) {
      const row = document.createElement("div");
      row.setAttribute("role", "row");
      row.className = "board-row";
      for (let x = 0; x < SIZE; x++) {
        const point = document.createElement("button");
        point.type = "button";
        point.className = "point";
        point.setAttribute("role", "gridcell");
        point.dataset.x = String(x);
        point.dataset.y = String(y);
        if (x === 0) point.classList.add("edge-left");
        if (x === SIZE - 1) point.classList.add("edge-right");
        if (y === 0) point.classList.add("edge-top");
        if (y === SIZE - 1) point.classList.add("edge-bottom");
        point.tabIndex = -1;
        point.addEventListener("click", () => onPlay(x, y));
        points.push(point);
        row.append(point);
      }
      root.append(row);
    }
    points[focusIndex].tabIndex = 0;
    const focusOn = (index) => {
      points[focusIndex].tabIndex = -1;
      focusIndex = index;
      points[index].tabIndex = 0;
      points[index].focus();
    };
    root.addEventListener("keydown", (e) => {
      const x = focusIndex % SIZE;
      const y = Math.floor(focusIndex / SIZE);
      const to = {
        ArrowLeft: [Math.max(0, x - 1), y],
        ArrowRight: [Math.min(SIZE - 1, x + 1), y],
        ArrowUp: [x, Math.max(0, y - 1)],
        ArrowDown: [x, Math.min(SIZE - 1, y + 1)],
        Home: [0, y],
        End: [SIZE - 1, y]
      }[e.key];
      if (!to) return;
      e.preventDefault();
      focusOn(to[1] * SIZE + to[0]);
    });
    root.addEventListener("focusin", (e) => {
      const index = points.indexOf(
        /** @type {any} */
        e.target
      );
      if (index >= 0 && index !== focusIndex) {
        points[focusIndex].tabIndex = -1;
        focusIndex = index;
        points[index].tabIndex = 0;
      }
    });
    return {
      /**
       * Draws `moves`, ringing the last one and marking `line` (a win), with
       * points clickable only when `playable`. `label(name, stone)` words a
       * point for screen readers; `stone` is "black", "white" or null.
       */
      draw({ moves, line, playable, label }) {
        const board2 = boardOf(moves);
        const last = moves.length ? moves[moves.length - 1] : null;
        const winning = new Set((line ?? []).map(([x, y]) => y * SIZE + x));
        root.classList.toggle("playable", playable);
        points.forEach((point, i) => {
          const x = i % SIZE;
          const y = Math.floor(i / SIZE);
          const stone = board2[i];
          point.dataset.stone = stone ?? "";
          point.classList.toggle("last", !!last && last[0] === x && last[1] === y);
          point.classList.toggle("win", winning.has(i));
          point.setAttribute("aria-label", label(cellName(x, y), stone));
          point.setAttribute("aria-disabled", String(!playable || !!stone));
        });
      }
    };
  }

  // page-src/code.js
  var CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
  var CODE_LENGTH = 6;
  function parseCode(text) {
    if (typeof text !== "string") return null;
    const code = text.toUpperCase().replace(/[\s-]/g, "");
    if (code.length !== CODE_LENGTH) return null;
    for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
    return code;
  }
  var showCode = (code) => `${code.slice(0, 3)}-${code.slice(3)}`;

  // page-src/match.js
  var APP = "gomoku";
  var V = 1;
  var NAME_MAX = 24;
  var FULL_RETRIES = 5;
  var FULL_WAIT = 3e3;
  var cleanName = (name) => typeof name === "string" ? [...name.trim().replace(/\s+/g, " ")].slice(0, NAME_MAX).join("") : "";
  var makerColor = (game) => game % 2 === 1 ? "black" : "white";
  var myColor = (creator, game) => creator ? makerColor(game) : makerColor(game) === "black" ? "white" : "black";
  function createMatch({ relay, player: player2, timers = globalThis, onChange, onSave, onNotice }) {
    let state = {
      phase: "lobby",
      // lobby | connecting | waiting | playing | over
      error: null,
      // a relay or join error code, shown in the lobby
      online: false,
      offline: false,
      // several tries to reach the relay failed in a row
      room: null,
      creator: false,
      name: "",
      opponent: null,
      // { player, name, here, gone }
      game: 1,
      moves: [],
      result: null,
      // { winner, line, resigned }
      rematch: { mine: false, theirs: false }
    };
    let pending = null;
    let fullTries = 0;
    let fullTimer = null;
    const update = (changes) => {
      state = { ...state, ...changes };
      onChange(view2());
    };
    function view2() {
      const color = myColor(state.creator, state.game);
      const turn = turnOf(state.moves);
      return {
        ...state,
        color,
        turn,
        myTurn: state.phase === "playing" && turn === color && !!state.opponent?.here
      };
    }
    const save = () => {
      if (!state.room) return onSave(null);
      onSave({
        room: state.room,
        creator: state.creator,
        name: state.name,
        opponent: state.opponent ? { player: state.opponent.player, name: state.opponent.name } : null,
        game: state.game,
        moves: state.moves,
        resigned: state.result?.resigned ?? null
      });
    };
    const tell = (data) => relay.send({ op: "send", data: { v: V, ...data } });
    const hi = () => tell({ t: "hi", player: player2, name: state.name, creator: state.creator });
    const sync = () => tell({
      t: "sync",
      game: state.game,
      moves: state.moves,
      resigned: state.result?.resigned ?? null,
      rematch: state.rematch.mine
    });
    const resultFor2 = (moves, resigned) => resultOf(moves) ?? (resigned ? { winner: resigned === "black" ? "white" : "black", line: null, resigned } : null);
    const phaseFor = (result) => result ? "over" : state.opponent ? "playing" : "waiting";
    function newGame(game) {
      update({ game, moves: [], result: null, rematch: { mine: false, theirs: false } });
      update({ phase: phaseFor(null) });
      save();
    }
    function toLobby(error = null) {
      pending = null;
      relay.close();
      if (fullTimer !== null) timers.clearTimeout(fullTimer);
      fullTimer = null;
      update({
        phase: "lobby",
        error,
        online: false,
        offline: false,
        room: null,
        creator: false,
        opponent: null,
        game: 1,
        moves: [],
        result: null,
        rematch: { mine: false, theirs: false }
      });
      save();
    }
    function create(name) {
      const clean = cleanName(name);
      if (!clean) return update({ error: "no-name" });
      pending = "create";
      update({ phase: "connecting", error: null, name: clean, creator: true });
      relay.connect();
    }
    function join(code, name) {
      const clean = cleanName(name);
      if (!clean) return update({ error: "no-name" });
      const room = parseCode(code);
      if (!room) return update({ error: "bad-code" });
      pending = "join";
      update({ phase: "connecting", error: null, name: clean, room, creator: false });
      relay.connect();
    }
    function resume(saved) {
      if (!saved || !parseCode(saved.room) || !isValidGame(saved.moves)) return;
      pending = null;
      const opponent = saved.opponent ? { ...saved.opponent, here: false, gone: false } : null;
      const result = resultFor2(saved.moves, saved.resigned);
      update({
        phase: "connecting",
        error: null,
        room: saved.room,
        creator: !!saved.creator,
        name: cleanName(saved.name),
        opponent,
        game: Number.isInteger(saved.game) && saved.game > 0 ? saved.game : 1,
        moves: saved.moves,
        result
      });
      relay.connect();
    }
    function play(x, y) {
      if (!view2().myTurn || refusal(state.moves, x, y)) return false;
      const n = state.moves.length;
      const moves = [...state.moves, [x, y]];
      const result = resultOf(moves);
      update({ moves, result, phase: phaseFor(result) });
      tell({ t: "move", game: state.game, n, x, y });
      save();
      return true;
    }
    function resign() {
      if (state.phase !== "playing") return;
      const color = myColor(state.creator, state.game);
      update({ result: resultFor2(state.moves, color), phase: "over" });
      tell({ t: "resign", game: state.game });
      save();
    }
    function rematch() {
      if (state.phase !== "over" || state.rematch.mine || state.opponent?.gone) return;
      tell({ t: "rematch", game: state.game });
      if (state.rematch.theirs) return newGame(state.game + 1);
      update({ rematch: { ...state.rematch, mine: true } });
    }
    function leave() {
      if (state.room) {
        tell({ t: "bye" });
        relay.send({ op: "leave" });
      }
      toLobby();
    }
    const dismiss = () => update({ error: null });
    function relayEvent(e) {
      if (e.type === "open") {
        update({ online: true, offline: false });
        if (pending === "create") relay.send({ op: "create", app: APP, size: 2, name: state.name });
        else if (state.room) relay.send({ op: "join", room: state.room, app: APP, name: state.name });
        return;
      }
      if (e.type === "close") {
        return update({
          online: false,
          opponent: state.opponent && { ...state.opponent, here: false }
        });
      }
      if (e.type === "offline") return update({ offline: true });
      if (e.type === "message") hear(e.message);
    }
    function hear(m) {
      switch (m.op) {
        case "created":
          pending = null;
          update({ room: m.room, phase: "waiting" });
          return save();
        case "joined":
          pending = null;
          fullTries = 0;
          if (state.phase === "connecting") update({ phase: state.result ? "over" : "waiting" });
          save();
          if (Array.isArray(m.members) && m.members.length > 0) hi();
          return;
        case "member-joined":
          return hi();
        case "member-left":
          if (!state.opponent) return;
          return update({ opponent: { ...state.opponent, here: false } });
        case "message":
          return heardPlayer(m.data);
        case "error":
          return refused(m.code);
        default:
          return;
      }
    }
    function refused(code) {
      if (code === "room-full" && pending === null && state.room && fullTries < FULL_RETRIES) {
        fullTries += 1;
        fullTimer = timers.setTimeout(() => {
          fullTimer = null;
          relay.send({ op: "join", room: state.room, app: APP, name: state.name });
        }, FULL_WAIT);
        return;
      }
      if (code === "no-room" && pending === null) return toLobby("room-gone");
      if (code === "too-fast" || code === "too-large") return;
      toLobby(typeof code === "string" ? code : "server");
    }
    function heardPlayer(d) {
      if (!d || typeof d !== "object" || d.v !== V) return;
      if (d.t === "hi") return heardHi(d);
      if (!state.opponent) return;
      if (d.t === "sync") return heardSync(d);
      if (d.t === "sync-ask") return sync();
      if (d.t === "move") return heardMove(d);
      if (d.t === "resign" && d.game === state.game && state.phase === "playing") {
        const color = myColor(state.creator, state.game) === "black" ? "white" : "black";
        update({ result: resultFor2(state.moves, color), phase: "over" });
        onNotice({ kind: "over", name: state.opponent.name });
        return save();
      }
      if (d.t === "rematch" && d.game === state.game) return heardRematch();
      if (d.t === "bye") {
        update({ opponent: { ...state.opponent, here: false, gone: true } });
        return onNotice({ kind: "left", name: state.opponent.name });
      }
    }
    function heardRematch() {
      if (state.phase !== "over" || state.rematch.theirs) return;
      if (state.rematch.mine) {
        newGame(state.game + 1);
        return sync();
      }
      update({ rematch: { ...state.rematch, theirs: true } });
      onNotice({ kind: "rematch", name: state.opponent.name });
    }
    function heardHi(d) {
      if (typeof d.player !== "string" || d.player === player2 || !!d.creator === state.creator)
        return;
      if (state.opponent && state.opponent.player !== d.player) return;
      const first = !state.opponent;
      const opponent = { player: d.player, name: cleanName(d.name) || "?", here: true, gone: false };
      update({ opponent, phase: state.result ? "over" : "playing" });
      if (first) onNotice({ kind: "joined", name: opponent.name });
      sync();
      save();
    }
    function heardSync(d) {
      if (!Number.isInteger(d.game) || d.game < state.game || !isValidGame(d.moves)) return;
      if (d.game > state.game) {
        update({ game: d.game, rematch: { mine: false, theirs: false } });
        return adopt(d.moves, null);
      }
      const mine = state.moves;
      const agrees = mine.every(([x, y], i) => d.moves[i]?.[0] === x && d.moves[i]?.[1] === y);
      if (agrees && d.moves.length > mine.length) adopt(d.moves, state.result?.resigned ?? null);
      const resigned = d.resigned === "black" || d.resigned === "white" ? d.resigned : null;
      if (resigned && !state.result && d.moves.length === state.moves.length) {
        adopt(state.moves, resigned);
      }
      if (d.rematch === true) heardRematch();
    }
    function adopt(moves, resigned) {
      const result = resultFor2(moves, resigned);
      update({ moves, result, phase: phaseFor(result) });
      save();
    }
    function heardMove(d) {
      if (d.game !== state.game || state.phase !== "playing") return;
      const theirs = myColor(state.creator, state.game) === "black" ? "white" : "black";
      if (d.n !== state.moves.length || colorOfMove(d.n) !== theirs) {
        if (d.n > state.moves.length) tell({ t: "sync-ask" });
        return;
      }
      if (refusal(state.moves, d.x, d.y)) return;
      const moves = [...state.moves, [d.x, d.y]];
      const result = resultOf(moves);
      update({ moves, result, phase: phaseFor(result) });
      onNotice(
        result ? { kind: "over", name: state.opponent.name } : { kind: "moved", name: state.opponent.name, x: d.x, y: d.y }
      );
      save();
    }
    return {
      relayEvent,
      create,
      join,
      resume,
      play,
      resign,
      rematch,
      leave,
      dismiss,
      /** The view as it is now. */
      view: view2
    };
  }

  // page-src/relay.js
  var BACKOFF = [1e3, 2e3, 4e3, 8e3, 15e3];
  var PING_EVERY = 6e4;
  var OFFLINE_AFTER = 3;
  function createRelay({ url, WebSocket, onEvent, timers = globalThis }) {
    let socket = null;
    let wanted = false;
    let failures = 0;
    let retry = null;
    let ping = null;
    const emit = (e) => {
      try {
        onEvent(e);
      } catch {
      }
    };
    const stopTimers = () => {
      if (retry !== null) timers.clearTimeout(retry);
      if (ping !== null) timers.clearInterval(ping);
      retry = null;
      ping = null;
    };
    function dial() {
      if (!wanted || socket) return;
      let ws;
      try {
        ws = new WebSocket(url);
      } catch {
        return lost(null);
      }
      socket = ws;
      ws.onopen = () => {
        if (socket !== ws) return;
        failures = 0;
        ping = timers.setInterval(() => send2({ op: "ping" }), PING_EVERY);
        emit({ type: "open" });
      };
      ws.onmessage = (event2) => {
        if (socket !== ws) return;
        let message;
        try {
          message = JSON.parse(String(event2.data));
        } catch {
          return;
        }
        if (message && typeof message === "object" && typeof message.op === "string") {
          emit({ type: "message", message });
        }
      };
      ws.onclose = () => lost(ws);
      ws.onerror = () => {
      };
    }
    function lost(ws) {
      if (ws && socket !== ws) return;
      const wasOpen = ws !== null && failures === 0 && ping !== null;
      socket = null;
      stopTimers();
      if (wasOpen) emit({ type: "close" });
      if (!wanted) return;
      failures += 1;
      if (failures === OFFLINE_AFTER) emit({ type: "offline" });
      const wait = BACKOFF[Math.min(failures - 1, BACKOFF.length - 1)];
      retry = timers.setTimeout(() => {
        retry = null;
        dial();
      }, wait);
    }
    function send2(message) {
      if (!socket || socket.readyState !== 1) return false;
      try {
        socket.send(JSON.stringify(message));
        return true;
      } catch {
        return false;
      }
    }
    return {
      /** Starts connecting (and reconnecting) until close(). */
      connect() {
        wanted = true;
        failures = 0;
        dial();
      },
      send: send2,
      /** Whether the connection is open now. */
      isOpen: () => !!socket && socket.readyState === 1,
      /** Closes the connection for good (until connect() again). */
      close() {
        wanted = false;
        stopTimers();
        const ws = socket;
        socket = null;
        if (ws) {
          try {
            ws.close();
          } catch {
          }
        }
      }
    };
  }

  // page-src/agent-view.js
  var COLUMNS2 = "ABCDEFGHIJKLMNO";
  var RULES = "15x15 board. Black moves first, then turns alternate. Five or more stones in an unbroken line (across, down or diagonal) wins; a full board is a draw. Points are named by column A-O (left to right) and row 1-15 (bottom to top), such as H8 for the center.";
  function parseCell(input) {
    const text = typeof input === "string" ? input : input && typeof input.cell === "string" ? input.cell : "";
    const m = text.replace(/\s+/g, "").toUpperCase().match(/^([A-O])(\d{1,2})$/);
    if (!m) return null;
    const row = Number(m[2]);
    if (row < 1 || row > SIZE) return null;
    return [COLUMNS2.indexOf(m[1]), SIZE - row];
  }
  function boardRows(moves) {
    const board2 = boardOf(moves);
    const rows = [];
    for (let y = 0; y < SIZE; y++) {
      let line = `${String(SIZE - y).padStart(2)} `;
      for (let x = 0; x < SIZE; x++) {
        const stone = board2[y * SIZE + x];
        line += ` ${stone === "black" ? "X" : stone === "white" ? "O" : "."}`;
      }
      rows.push(line);
    }
    rows.push(`   ${[...COLUMNS2].map((c) => ` ${c}`).join("")}`);
    return rows;
  }
  function agentBoard(view2) {
    if (!view2 || view2.phase === "lobby" || view2.phase === "connecting") {
      return {
        mode: "none",
        phase: "none",
        rules: RULES,
        next: `No game is open. Run Gomoku's "Play against an agent" command to start one with the user, or ask them to start or join a game.`
      };
    }
    const versus2 = view2.mode === "agent";
    const you = versus2 ? view2.color === "black" ? "white" : "black" : view2.color;
    const yourTurn = versus2 ? !!view2.agentTurn : !!view2.myTurn;
    const moves = view2.moves.map(([x, y]) => cellName(x, y));
    const result = view2.result ? {
      winner: view2.result.winner,
      line: view2.result.line ? view2.result.line.map(([x, y]) => cellName(x, y)) : null,
      resigned: view2.result.resigned ?? null,
      youWon: view2.result.winner === you
    } : null;
    let next;
    if (view2.phase === "waiting") next = "Waiting for the other player to join with the game's code.";
    else if (result)
      next = versus2 ? "The game is over. The user can press Play again for another, with colors swapped." : "The game is over.";
    else if (yourTurn)
      next = `Your move: run Gomoku's "Play a point" command with { cell }, such as { "cell": "H8" }.`;
    else
      next = versus2 ? `The user's move. Read the board again with { "wait": true } to wait for it.` : `${view2.opponent?.name || "The other player"}'s move. Read the board again with { "wait": true } to wait for it.`;
    return {
      mode: versus2 ? "agent" : "online",
      phase: view2.phase,
      you,
      turn: view2.turn,
      yourTurn,
      opponent: versus2 ? "the user" : view2.opponent?.name || null,
      game: view2.game,
      moves,
      last: moves.at(-1) ?? null,
      board: boardRows(view2.moves),
      result,
      rules: RULES,
      next
    };
  }

  // page-src/versus.js
  var userColor = (game) => game % 2 === 1 ? "black" : "white";
  var resultFor = (moves, resigned) => resultOf(moves) ?? (resigned ? { winner: resigned === "black" ? "white" : "black", line: null, resigned } : null);
  function createVersus({ agentName, onChange, onSave, onNotice = () => {
  } }) {
    let state = { phase: "lobby", name: "", game: 1, moves: [], result: null };
    function view2() {
      const color = userColor(state.game);
      const turn = turnOf(state.moves);
      const playing = state.phase === "playing";
      return {
        mode: "agent",
        phase: state.phase,
        error: null,
        online: true,
        offline: false,
        room: null,
        creator: true,
        name: state.name,
        opponent: { player: "agent", name: agentName, here: true, gone: false },
        game: state.game,
        moves: state.moves,
        result: state.result,
        rematch: { mine: false, theirs: true },
        color,
        turn,
        myTurn: playing && turn === color,
        agentTurn: playing && turn !== color
      };
    }
    const update = (changes) => {
      state = { ...state, ...changes };
      onChange(view2());
    };
    const save = () => onSave(
      state.phase === "lobby" ? null : {
        mode: "agent",
        name: state.name,
        game: state.game,
        moves: state.moves,
        resigned: state.result?.resigned ?? null
      }
    );
    function place(x, y) {
      if (state.phase !== "playing") return "not-playing";
      const why = refusal(state.moves, x, y);
      if (why) return why;
      const moves = [...state.moves, [x, y]];
      const result = resultOf(moves);
      update({ moves, result, phase: result ? "over" : "playing" });
      save();
      return null;
    }
    return {
      view: view2,
      /** Starts a game against the agent, the user playing black. */
      start(name) {
        update({ phase: "playing", name: cleanName(name), game: 1, moves: [], result: null });
        save();
      },
      /** The user's move; true when it was played. */
      play(x, y) {
        return view2().myTurn && place(x, y) === null;
      },
      /** The agent's move: null when played, else why not ("not-your-turn", "taken", …). */
      agentPlay(x, y) {
        if (state.phase === "playing" && !view2().agentTurn) return "not-your-turn";
        const why = place(x, y);
        if (!why) onNotice({ kind: "agent-moved", name: agentName, x, y });
        return why;
      },
      /** The user gives the game up. */
      resign() {
        if (state.phase !== "playing") return;
        update({ result: resultFor(state.moves, userColor(state.game)), phase: "over" });
        save();
      },
      /** Another game, colors swapped; the agent always says yes. */
      rematch() {
        if (state.phase !== "over") return;
        update({ phase: "playing", game: state.game + 1, moves: [], result: null });
        save();
      },
      /** Back to the lobby; the game is forgotten. */
      leave() {
        update({ phase: "lobby", game: 1, moves: [], result: null });
        save();
      },
      dismiss() {
      },
      /** Picks up a kept game; false (nothing changes) when it couldn't have been played. */
      resume(saved) {
        if (!saved || saved.mode !== "agent" || !isValidGame(saved.moves)) return false;
        const game = Number.isInteger(saved.game) && saved.game > 0 ? saved.game : 1;
        const resigned = saved.resigned === "black" || saved.resigned === "white" ? saved.resigned : null;
        const result = resultFor(saved.moves, resigned);
        update({
          phase: result ? "over" : "playing",
          name: cleanName(saved.name),
          game,
          moves: saved.moves,
          result
        });
        return true;
      }
    };
  }

  // page-src/main.js
  var WAIT_MS = 7e3;
  var bridge = window.tilefold;
  var $ = (id) => document.getElementById(id);
  var send = (message) => {
    if (bridge) bridge.post(message).catch(() => {
    });
  };
  var labels = {};
  var L = (key, vars = {}) => String(labels[key] ?? "").replace(/\{(name|code|cell)\}/g, (_, k) => String(vars[k] ?? ""));
  var ERRORS = {
    "no-name": "error-no-name",
    "bad-code": "error-bad-code",
    "no-room": "error-no-room",
    "wrong-app": "error-no-room",
    "room-full": "error-room-full",
    "room-gone": "error-room-gone"
  };
  var player = null;
  var match = null;
  var versus = null;
  var board = null;
  var waiting = /* @__PURE__ */ new Set();
  var view = null;
  var lastEvent = null;
  var newPlayerId = () => Array.from(
    crypto.getRandomValues(new Uint8Array(12)),
    (b) => b.toString(16).padStart(2, "0")
  ).join("");
  var keep = (saved) => send({
    type: "keep",
    player,
    name: $("name").value.trim(),
    ...saved === void 0 ? {} : { saved }
  });
  var event = (action) => {
    if (action === lastEvent) return;
    lastEvent = action;
    send({ type: "event", action });
  };
  var active = () => versus && versus.view().phase !== "lobby" ? versus : match;
  function notice(n) {
    if (document.hasFocus()) return;
    const cell = n.kind === "moved" || n.kind === "agent-moved" ? cellName(n.x, n.y) : "";
    send({ type: "notice", kind: n.kind, name: n.name, cell });
  }
  function screen(name) {
    for (const id of ["lobby", "waiting", "game"]) $(id).hidden = id !== name;
  }
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
  function playerLine(el, color, name, turn) {
    el.textContent = "";
    const stone = document.createElement("span");
    stone.className = `stone-chip ${color}`;
    stone.setAttribute("aria-hidden", "true");
    el.append(stone, document.createTextNode(`${name} \xB7 ${L(`stone-${color}`)}`));
    el.classList.toggle("to-move", turn);
  }
  function render(v) {
    if (v.mode !== "agent" && versus && versus.view().phase !== "lobby") return;
    view = v;
    for (const w of [...waiting]) w.check();
    const busy = v.phase === "connecting" && !v.room;
    $("conn").textContent = v.room && !v.online ? "\u25CF" : "";
    $("conn").title = v.room && !v.online ? L("status-reconnecting") : "";
    if (v.phase === "lobby" || busy) {
      screen("lobby");
      for (const id of ["new", "join", "name", "code", "versus"]) $(id).disabled = busy;
      $("error").hidden = !v.error && !busy;
      $("error").textContent = busy ? L(v.offline ? "error-offline" : "status-connecting") : v.error ? L(ERRORS[v.error] ?? "error-server") : "";
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
      label: (cell, stone) => stone ? L(`cell-${stone}`, { cell }) : L("cell-empty", { cell })
    });
    $("resign").hidden = v.phase !== "playing";
    const over = v.phase === "over";
    $("rematch").hidden = !over || !!v.opponent?.gone;
    $("rematch").disabled = v.rematch.mine;
    $("rematch").textContent = v.mode === "agent" ? L("action-rematch") : v.rematch.mine ? L("rematch-waiting", { name: them }) : v.rematch.theirs ? L("rematch-accept") : L("action-rematch");
    $("offer").hidden = v.mode === "agent" || !(over && v.rematch.theirs && !v.rematch.mine);
    $("offer").textContent = L("rematch-offered", { name: them });
    if (over) {
      const r = v.result;
      event(!r.winner ? "draw" : r.winner === v.color ? "won" : "lost");
    } else if (v.phase === "playing") {
      event("started");
    }
  }
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
      leave: "action-leave"
    };
    for (const [id, key] of Object.entries(text)) $(id).textContent = L(key);
    $("name").placeholder = L("lobby-name-hint");
    $("code").placeholder = L("lobby-code-hint");
    $("close").title = L("page-close");
    $("close").setAttribute("aria-label", L("page-close"));
    $("board").setAttribute("aria-label", L("board-label"));
  }
  async function copyCode() {
    const field = $("room-code");
    try {
      await navigator.clipboard.writeText(field.value);
      $("copy").textContent = L("waiting-copied");
      setTimeout(() => $("copy").textContent = L("waiting-copy"), 2e3);
    } catch {
      field.focus();
      field.select();
    }
  }
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
      onEvent: (e) => match.relayEvent(e)
    });
    match = createMatch({
      relay,
      player,
      onChange: render,
      onSave: keep,
      onNotice: notice
    });
    versus = createVersus({
      agentName: L("agent-name"),
      onChange: render,
      onSave: keep,
      onNotice: notice
    });
    keep(m.saved ?? null);
    if (m.saved?.mode === "agent") {
      if (!versus.resume(m.saved)) render(match.view());
    } else if (m.saved) match.resume(m.saved);
    else render(match.view());
    send({ type: "ready" });
  }
  function leaveVersus() {
    versus.leave();
    render(match.view());
  }
  function startVersus() {
    if (!versus || view?.room) return false;
    versus.start($("name").value);
    event("agent-game");
    return true;
  }
  function answerAgent(m) {
    const reply = (extra = {}) => send({ type: "agent", id: m.id, reply: { ...extra, board: agentBoard(versusOrView()) } });
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
      }
    };
    w.timer = setTimeout(() => {
      waiting.delete(w);
      reply({ waited: true });
    }, WAIT_MS);
    waiting.add(w);
  }
  var versusOrView = () => versus && versus.view().phase !== "lobby" ? versus.view() : match?.view() ?? null;
  var AGENT_REFUSALS = {
    "no-game": `No game is open. Run Gomoku's "Play against an agent" command first.`,
    "not-your-turn": `It isn't your turn. Read the board with { "wait": true } to wait for it.`,
    "not-playing": "The game isn't being played right now (it's over, or waiting for a player).",
    taken: "That point already has a stone. Pick an empty one.",
    "off-board": "That point isn't on the board.",
    over: "The game is over."
  };
  function playForAgent(x, y) {
    if (versus.view().phase !== "lobby") return versus.agentPlay(x, y);
    const v = match.view();
    if (v.phase === "lobby" || v.phase === "connecting") return "no-game";
    if (v.phase !== "playing") return "not-playing";
    if (!v.myTurn) return "not-your-turn";
    return match.play(x, y) ? null : "taken";
  }
  function wire() {
    board = createBoard($("board"), { onPlay: (x, y) => active()?.play(x, y) });
    $("versus").addEventListener("click", () => startVersus());
    $("new").addEventListener("click", () => match?.create($("name").value));
    const join = () => match?.join($("code").value, $("name").value);
    $("join").addEventListener("click", join);
    $("code").addEventListener("keydown", (e) => {
      if (e.key === "Enter") join();
    });
    $("name").addEventListener("change", () => keep(void 0));
    $("name").maxLength = NAME_MAX;
    $("copy").addEventListener("click", () => void copyCode());
    $("cancel").addEventListener("click", () => match?.leave());
    $("cancel-connect").addEventListener("click", () => match?.leave());
    $("resign").addEventListener("click", () => active()?.resign());
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
})();
