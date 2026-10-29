/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo page
 *
 * The board and everything around it: the lobby (your name, the board
 * size, Start a game, Play against an agent, Join with a code), the code to
 * send while waiting for the other player, and the game itself with whose
 * turn it is, Pass, Undo, Resign, and once both passed the marking of dead
 * stones with the score and Accept; then Play again and Leave. The page
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
// Built by @tilefold/tile-tools from page-src/main.js. Edit the sources, then rebuild.
(() => {
  // page-src/game.js
  var SIZES = [9, 13, 19];
  var PASS = "pass";
  var COLUMNS = "ABCDEFGHJKLMNOPQRST";
  var isSize = (size) => SIZES.includes(size);
  var colorOfMove = (n) => n % 2 === 0 ? "black" : "white";
  var otherColor = (color) => color === "black" ? "white" : "black";
  var turnOf = (moves) => colorOfMove(moves.length);
  var isPass = (move) => move === PASS;
  var playEnded = (moves) => moves.length >= 2 && isPass(moves[moves.length - 1]) && isPass(moves[moves.length - 2]);
  var maxMoves = (size) => size * size * 3;
  var onBoard = (size, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;
  var cellName = (size, x, y) => `${COLUMNS[x]}${size - y}`;
  var moveName = (size, move) => isPass(move) ? PASS : cellName(size, move[0], move[1]);
  function neighbors(size, i) {
    const x = i % size;
    const y = Math.floor(i / size);
    const out = [];
    if (x > 0) out.push(i - 1);
    if (x < size - 1) out.push(i + 1);
    if (y > 0) out.push(i - size);
    if (y < size - 1) out.push(i + size);
    return out;
  }
  function chainAt(board2, size, i) {
    const color = board2[i];
    if (!color) return { stones: [], liberties: 0 };
    const stones = [i];
    const seen = new Set(stones);
    const free = /* @__PURE__ */ new Set();
    for (let k = 0; k < stones.length; k++) {
      for (const n of neighbors(size, stones[k])) {
        if (board2[n] === null) free.add(n);
        else if (board2[n] === color && !seen.has(n)) {
          seen.add(n);
          stones.push(n);
        }
      }
    }
    return { stones, liberties: free.size };
  }
  var emptyBoard = (size) => Array.from({ length: size * size }, () => null);
  var startPosition = (size) => ({
    board: emptyBoard(size),
    ko: null,
    captured: { black: 0, white: 0 }
  });
  function playMove(pos, size, color, move) {
    if (isPass(move)) return { pos: { ...pos, ko: null } };
    if (!Array.isArray(move) || move.length !== 2) return { why: "off-board" };
    const [x, y] = move;
    if (!onBoard(size, x, y)) return { why: "off-board" };
    const i = y * size + x;
    if (pos.board[i]) return { why: "taken" };
    if (pos.ko === i) return { why: "ko" };
    const board2 = pos.board.slice();
    board2[i] = color;
    const taken = [];
    for (const n of neighbors(size, i)) {
      if (board2[n] !== otherColor(color)) continue;
      const chain = chainAt(board2, size, n);
      if (chain.liberties > 0) continue;
      for (const s of chain.stones) board2[s] = null;
      taken.push(...chain.stones);
    }
    const own = chainAt(board2, size, i);
    if (own.liberties === 0) return { why: "suicide" };
    const ko = taken.length === 1 && own.stones.length === 1 && own.liberties === 1 ? taken[0] : null;
    return {
      pos: {
        board: board2,
        ko,
        captured: { ...pos.captured, [color]: pos.captured[color] + taken.length }
      }
    };
  }
  var memo = { moves: null, size: 0, result: null };
  function replay(moves, size) {
    if (memo.moves === moves && memo.size === size) return memo.result;
    let pos = startPosition(size);
    let bad = null;
    for (let n = 0; n < moves.length; n++) {
      const ended = n >= 2 && isPass(moves[n - 1]) && isPass(moves[n - 2]);
      const next = ended ? { why: "ended" } : playMove(pos, size, colorOfMove(n), moves[n]);
      if (next.why) {
        bad = n;
        break;
      }
      pos = next.pos;
    }
    const result = { pos, bad };
    memo = { moves, size, result };
    return result;
  }
  var positionOf = (moves, size) => replay(moves, size).pos;
  function refusal(moves, size, move) {
    if (playEnded(moves)) return "ended";
    if (moves.length >= maxMoves(size)) return "ended";
    const next = playMove(positionOf(moves, size), size, turnOf(moves), move);
    return next.why ?? null;
  }
  function isValidGame(moves, size) {
    if (!isSize(size) || !Array.isArray(moves) || moves.length > maxMoves(size)) return false;
    for (const move of moves) {
      if (isPass(move)) continue;
      if (!Array.isArray(move) || move.length !== 2) return false;
    }
    return replay(moves, size).bad === null;
  }

  // page-src/score.js
  var KOMI = 7.5;
  var NO_MARKS = Object.freeze({ dead: [], v: 0, mine: false, theirs: false });
  var sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((p, i) => p === b[i]);
  function toggleChain(board2, size, dead, i) {
    const { stones } = chainAt(board2, size, i);
    if (stones.length === 0) return dead;
    const marked = new Set(dead);
    const wasDead = marked.has(i);
    for (const s of stones) {
      if (wasDead) marked.delete(s);
      else marked.add(s);
    }
    return [...marked].sort((a, b) => a - b);
  }
  function cleanDead(board2, size, dead) {
    if (!Array.isArray(dead)) return [];
    const out = /* @__PURE__ */ new Set();
    for (const i of dead) {
      if (!Number.isInteger(i) || i < 0 || i >= size * size || !board2[i] || out.has(i)) continue;
      for (const s of chainAt(board2, size, i).stones) out.add(s);
    }
    return [...out].sort((a, b) => a - b);
  }
  function areaOf(board2, size, dead) {
    const gone = new Set(dead);
    const alive = board2.map((stone, i) => stone && !gone.has(i) ? stone : null);
    const owner = alive.slice();
    const seen = /* @__PURE__ */ new Set();
    for (let start = 0; start < alive.length; start++) {
      if (alive[start] || seen.has(start)) continue;
      const region = [start];
      const borders = /* @__PURE__ */ new Set();
      seen.add(start);
      for (let k = 0; k < region.length; k++) {
        for (const n of neighbors(size, region[k])) {
          if (alive[n]) borders.add(alive[n]);
          else if (!seen.has(n)) {
            seen.add(n);
            region.push(n);
          }
        }
      }
      const color = borders.size === 1 ? [...borders][0] : null;
      for (const p of region) owner[p] = color;
    }
    return owner;
  }
  function scoreOf(board2, size, dead) {
    const owner = areaOf(board2, size, dead);
    let black = 0;
    let white = KOMI;
    for (const color of owner) {
      if (color === "black") black += 1;
      else if (color === "white") white += 1;
    }
    const winner = black > white ? "black" : "white";
    return { black, white, winner, margin: Math.abs(black - white) };
  }
  function scoredResult(moves, size, dead) {
    const { black, white, winner, margin } = scoreOf(positionOf(moves, size).board, size, dead);
    return { winner, resigned: null, score: { black, white, margin } };
  }
  var resignedResult = (resigned) => ({
    winner: resigned === "black" ? "white" : "black",
    resigned,
    score: null
  });

  // page-src/agent-view.js
  var rulesFor = (size) => `Go on a ${size}x${size} board, area scoring (Chinese rules), komi ${KOMI} for white. Black moves first, then turns alternate; a turn is one stone on an empty point, or a pass. A chain (stones of one color joined across or down) with no empty point next to it is captured. No suicide; simple ko (a single stone that just took a single stone can't be taken back at once). Two passes in a row end play: both sides then mark the dead stones and accept the score: each side's stones plus the empty points only it surrounds. Points are a column ${COLUMNS[0]}-${COLUMNS[size - 1]} (left to right, no I) and a row 1-${size} (bottom to top), such as ${cellName(size, Math.floor(size / 2), Math.floor(size / 2))} for the center.`;
  function parsePoint(size, text) {
    if (typeof text !== "string") return null;
    const m = text.replace(/\s+/g, "").toUpperCase().match(/^([A-HJ-T])(\d{1,2})$/);
    if (!m) return null;
    const x = COLUMNS.indexOf(m[1]);
    const row = Number(m[2]);
    if (x >= size || row < 1 || row > size) return null;
    return [x, size - row];
  }
  function parseMove(size, input) {
    const text = typeof input === "string" ? input : input && typeof input.cell === "string" ? input.cell : "";
    if (text.trim().toLowerCase() === PASS) return PASS;
    return parsePoint(size, text);
  }
  function parsePoints(size, list) {
    if (!Array.isArray(list)) return null;
    const out = [];
    for (const name of list) {
      const p = parsePoint(size, name);
      if (!p) return null;
      out.push(p[1] * size + p[0]);
    }
    return out;
  }
  function boardRows(board2, size, dead = []) {
    const gone = new Set(dead);
    const rows = [];
    for (let y = 0; y < size; y++) {
      let line = `${String(size - y).padStart(2)} `;
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const stone = board2[i];
        const mark = stone === "black" ? "X" : stone === "white" ? "O" : ".";
        line += ` ${gone.has(i) ? mark.toLowerCase() : mark}`;
      }
      rows.push(line);
    }
    rows.push(`   ${[...COLUMNS.slice(0, size)].map((c) => ` ${c}`).join("")}`);
    return rows;
  }
  var names = (size, points) => points.map((i) => cellName(size, i % size, Math.floor(i / size)));
  function nextStep(view2, b, versus2) {
    const opponent = versus2 ? "the user" : view2.opponent?.name || "the other player";
    if (view2.phase === "waiting") return "Waiting for the other player to join with the game's code.";
    if (b.result)
      return versus2 ? "The game is over. The user can press Play again for another, with colors swapped." : "The game is over.";
    if (view2.phase === "scoring") {
      if (b.accepted.you)
        return `You accepted these dead stones. Waiting for ${opponent} to accept, or to change them (which takes your acceptance back).`;
      return `Both players passed. Mark the dead stones with TileGo's "Mark dead stones" command: { "dead": ["C3", "G7"] } names one stone of each dead chain (the whole chain is marked; [] for none). Then accept with { "accept": true }. "score" counts the stones marked now. ${opponent} can mark stones too; any change takes both acceptances back. To play on instead, ask the user to press Undo.`;
    }
    if (b.yourTurn)
      return `Your move: run TileGo's "Play a point" command with { cell }, such as { "cell": "${cellName(view2.size, Math.floor(view2.size / 2), Math.floor(view2.size / 2))}" }, or { "cell": "pass" } to pass when no move gains anything.`;
    return `${versus2 ? "The user" : opponent}'s move. Read the board again with { "wait": true } to wait for it.`;
  }
  function agentBoard(view2) {
    if (!view2 || view2.phase === "lobby" || view2.phase === "connecting") {
      return {
        mode: "none",
        phase: "none",
        rules: rulesFor(9),
        next: `No game is open. Run TileGo's "Play against an agent" command to start one with the user, or ask them to start or join a game.`
      };
    }
    const versus2 = view2.mode === "agent";
    const { size } = view2;
    const you = versus2 ? view2.color === "black" ? "white" : "black" : view2.color;
    const pos = positionOf(view2.moves, size);
    const scoring = view2.phase === "scoring";
    const dead = scoring ? view2.marks.dead : [];
    const moves = view2.moves.map((move) => moveName(size, move));
    const b = {
      mode: versus2 ? "agent" : "online",
      phase: view2.phase,
      size,
      you,
      turn: view2.turn,
      yourTurn: versus2 ? !!view2.agentTurn : !!view2.myTurn,
      opponent: versus2 ? "the user" : view2.opponent?.name || null,
      game: view2.game,
      moves,
      last: moves.at(-1) ?? null,
      board: boardRows(pos.board, size, dead),
      captured: pos.captured,
      ko: pos.ko === null ? null : names(size, [pos.ko])[0],
      komi: KOMI,
      result: view2.result ? {
        winner: view2.result.winner,
        resigned: view2.result.resigned ?? null,
        score: view2.result.score ?? null,
        youWon: view2.result.winner === you
      } : null
    };
    if (scoring) {
      b.dead = names(size, dead);
      b.score = scoreOf(pos.board, size, dead);
      b.accepted = versus2 ? { you: !!view2.marks.theirs, opponent: !!view2.marks.mine } : { you: !!view2.marks.mine, opponent: !!view2.marks.theirs };
    }
    b.rules = rulesFor(size);
    b.next = nextStep(view2, { ...b, accepted: b.accepted ?? {} }, versus2);
    return b;
  }

  // page-src/agent-requests.js
  var WAIT_MS = 7e3;
  var AGENT_REFUSALS = {
    "no-game": `No game is open. Run TileGo's "Play against an agent" command first.`,
    "not-your-turn": `It isn't your turn. Read the board with { "wait": true } to wait for it.`,
    "not-playing": "The game isn't being played right now (it's over, marking, or waiting for a player).",
    "not-scoring": 'Dead stones are marked only after both players pass. Play on, or pass with { "cell": "pass" }.',
    taken: "That point already has a stone. Pick an empty one.",
    "off-board": "That point isn't on the board.",
    ko: "That's a ko: the stone just taken can't be taken back at once. Play elsewhere first.",
    suicide: "That stone would have no liberty and capture nothing (suicide). Pick another point.",
    ended: "Both players passed; play has ended. Mark the dead stones instead.",
    over: "The game is over.",
    busy: "A game with another person is open; it must end first.",
    "bad-cell": 'Name a point such as E5 (a column letter without I, and a row number), or "pass".',
    "bad-dead": 'Name the dead stones as points, such as { "dead": ["C3", "G7"] }, or [] for none.',
    "no-score": 'Say what to do: { "dead": [...] } to mark the dead stones, { "accept": true } to accept.'
  };
  function createAgentRequests(page) {
    const waiting = /* @__PURE__ */ new Set();
    const reply = (m, extra = {}) => page.send({ type: "agent", id: m.id, reply: { ...extra, board: agentBoard(page.view()) } });
    const refuse = (m, why) => reply(m, { error: AGENT_REFUSALS[why] ?? why });
    function score(m) {
      const input = m.input && typeof m.input === "object" ? m.input : {};
      const v = page.view();
      if (!v) return refuse(m, "no-game");
      if (!("dead" in input) && input.accept !== true) return refuse(m, "no-score");
      if ("dead" in input) {
        const points = parsePoints(v.size, input.dead);
        if (!points) return refuse(m, "bad-dead");
        const why = page.mark(points);
        if (why) return refuse(m, why);
      }
      if (input.accept === true) {
        const why = page.accept();
        if (why) return refuse(m, why);
      }
      return reply(m, { ok: true });
    }
    function board2(m) {
      const ready = () => {
        const b = agentBoard(page.view());
        return !(m.input && m.input.wait === true) || b.yourTurn || b.phase !== "playing";
      };
      if (ready()) return reply(m);
      const w = {
        check() {
          if (!ready()) return;
          clearTimeout(w.timer);
          waiting.delete(w);
          reply(m);
        }
      };
      w.timer = setTimeout(() => {
        waiting.delete(w);
        reply(m, { waited: true });
      }, WAIT_MS);
      waiting.add(w);
    }
    return {
      /** Answers one request from the tile. */
      answer(m) {
        if (m.ask === "versus") return page.start() ? reply(m, { ok: true }) : refuse(m, "busy");
        if (m.ask === "play") {
          const v = page.view();
          if (!v) return refuse(m, "no-game");
          const move = parseMove(v.size, m.input);
          if (!move) return refuse(m, "bad-cell");
          const why = page.play(move);
          if (why) return refuse(m, why);
          return reply(m, { ok: true, played: typeof m.input === "string" ? m.input : m.input.cell });
        }
        if (m.ask === "score") return score(m);
        return board2(m);
      },
      /** The game changed: answer the requests that were waiting for it. */
      changed() {
        for (const w of [...waiting]) w.check();
      }
    };
  }

  // page-src/board.js
  var STARS = {
    9: [2, 6].flatMap((a) => [2, 6].map((b) => [a, b])).concat([[4, 4]]),
    13: [3, 6, 9].flatMap((a) => [3, 6, 9].map((b) => [a, b])),
    19: [3, 9, 15].flatMap((a) => [3, 9, 15].map((b) => [a, b]))
  };
  function createBoard(root, { onPoint: onPoint2 }) {
    let points = [];
    let size = 0;
    let focusIndex = 0;
    root.setAttribute("role", "grid");
    function build(n) {
      size = n;
      points = [];
      root.textContent = "";
      root.style.setProperty("--n", String(n));
      const stars = new Set((STARS[n] ?? []).map(([x, y]) => y * n + x));
      for (let y = 0; y < n; y++) {
        const row = document.createElement("div");
        row.setAttribute("role", "row");
        row.className = "board-row";
        for (let x = 0; x < n; x++) {
          const point = document.createElement("button");
          point.type = "button";
          point.className = "point";
          point.setAttribute("role", "gridcell");
          point.dataset.x = String(x);
          point.dataset.y = String(y);
          if (x === 0) point.classList.add("edge-left");
          if (x === n - 1) point.classList.add("edge-right");
          if (y === 0) point.classList.add("edge-top");
          if (y === n - 1) point.classList.add("edge-bottom");
          if (stars.has(y * n + x)) point.classList.add("star");
          point.tabIndex = -1;
          point.addEventListener("click", () => onPoint2(x, y));
          points.push(point);
          row.append(point);
        }
        root.append(row);
      }
      focusIndex = Math.floor(n * n / 2);
      points[focusIndex].tabIndex = 0;
    }
    const focusOn = (index) => {
      points[focusIndex].tabIndex = -1;
      focusIndex = index;
      points[index].tabIndex = 0;
      points[index].focus();
    };
    root.addEventListener("keydown", (e) => {
      if (!size) return;
      const x = focusIndex % size;
      const y = Math.floor(focusIndex / size);
      const to = {
        ArrowLeft: [Math.max(0, x - 1), y],
        ArrowRight: [Math.min(size - 1, x + 1), y],
        ArrowUp: [x, Math.max(0, y - 1)],
        ArrowDown: [x, Math.min(size - 1, y + 1)],
        Home: [0, y],
        End: [size - 1, y]
      }[e.key];
      if (!to) return;
      e.preventDefault();
      focusOn(to[1] * size + to[0]);
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
       * Draws `board` (one entry per point: "black", "white" or null) on a
       * board of `n`, ringing point `last`. Points can be played when
       * `playable`, and stones clicked to mark them when `marking`; `dead` is
       * the set of points marked dead, `area` (while marking) whose area each
       * point is. `label(name, stone, dead, owner)` words a point for screen
       * readers.
       */
      draw({ size: n, board: board2, last, playable, marking, dead, area, label }) {
        if (n !== size) build(n);
        root.classList.toggle("playable", playable);
        root.classList.toggle("marking", marking);
        points.forEach((point, i) => {
          const stone = board2[i];
          const isDead = dead.has(i);
          const owner = area ? area[i] : null;
          point.dataset.stone = stone ?? "";
          point.dataset.area = owner && (!stone || isDead) ? owner : "";
          point.classList.toggle("last", last === i);
          point.classList.toggle("dead", isDead);
          point.setAttribute(
            "aria-label",
            label(cellName(n, i % n, Math.floor(i / n)), stone, isDead, owner)
          );
          const usable = playable && !stone || marking && !!stone;
          point.setAttribute("aria-disabled", String(!usable));
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

  // page-src/undo.js
  function undoTarget(moves, color) {
    for (let i = moves.length - 1; i >= 0 && i >= moves.length - 2; i--) {
      if (colorOfMove(i) === color) return i;
    }
    return null;
  }
  function undoFits(moves, n, to, color) {
    return Number.isInteger(n) && Number.isInteger(to) && n === moves.length && to >= 0 && to < n && n - to <= 2 && colorOfMove(to) === color;
  }
  var NO_UNDO = Object.freeze({ mine: null, theirs: null, declined: false });
  var undoPhase = (phase) => phase === "playing" || phase === "scoring";
  function undoActions(ctx) {
    const { update, tell, save, onNotice } = ctx;
    const theirColor = () => ctx.mine() === "black" ? "white" : "black";
    function goBack(to) {
      const s = ctx.state();
      const moves = s.moves.slice(0, to);
      update({
        moves,
        result: null,
        phase: ctx.phaseFor(null, moves),
        undo: NO_UNDO,
        undone: s.undone + 1,
        marks: NO_MARKS
      });
      save();
    }
    return {
      /** Asks the other player to let this side take its last move back. */
      ask() {
        if (!ctx.canAsk()) return false;
        const s = ctx.state();
        const to = undoTarget(s.moves, ctx.mine());
        tell({ t: "undo-ask", game: s.game, n: s.moves.length, to });
        update({ undo: { ...NO_UNDO, mine: to } });
        return true;
      },
      /** Allows the undo the other player asked for. */
      allow() {
        const s = ctx.state();
        const asked = s.undo.theirs;
        if (!asked || !undoPhase(s.phase)) return;
        tell({ t: "undo-yes", game: s.game, n: asked.n, to: asked.to });
        goBack(asked.to);
      },
      /** Turns down the undo the other player asked for. */
      decline() {
        const s = ctx.state();
        if (!s.undo.theirs) return;
        tell({ t: "undo-no", game: s.game, n: s.undo.theirs.n });
        update({ undo: NO_UNDO });
      },
      /** What the other player said about an undo (`undo-ask`, `undo-yes`, `undo-no`). */
      heard(d) {
        const s = ctx.state();
        if (d.t === "undo-ask") {
          if (!undoPhase(s.phase) || !undoFits(s.moves, d.n, d.to, theirColor())) return;
          update({ undo: { ...NO_UNDO, theirs: { n: d.n, to: d.to } } });
          onNotice({ kind: "undo", name: s.opponent.name });
        } else if (d.t === "undo-yes") {
          if (s.undo.mine === null || d.to !== s.undo.mine || d.n !== s.moves.length) return;
          goBack(d.to);
        } else if (d.t === "undo-no" && s.undo.mine !== null) {
          update({ undo: { ...NO_UNDO, declined: true } });
        }
      }
    };
  }

  // page-src/follow.js
  var colorOr = (c) => c === "black" || c === "white" ? c : null;
  var sameMove = (a, b) => isPass(a) ? isPass(b) : Array.isArray(b) && a[0] === b[0] && a[1] === b[1];
  function followActions(ctx) {
    const { update, tell, save, onNotice } = ctx;
    function adopt(moves, resigned) {
      const s = ctx.state();
      const result = resigned ? resignedResult(resigned) : null;
      const changed = moves !== s.moves;
      update({
        moves,
        result,
        phase: ctx.phaseFor(result, moves),
        ...changed ? { marks: NO_MARKS } : {}
      });
      save();
    }
    return {
      /** The other board's whole game: catch up when it's newer. */
      heardSync(d) {
        ctx.takeSize(d.size);
        const s = ctx.state();
        if (d.size !== s.size) return;
        if (!Number.isInteger(d.game) || d.game < s.game || !isValidGame(d.moves, s.size)) return;
        if (d.game > s.game) {
          update(ctx.freshGame(d.game));
          return adopt(d.moves, null);
        }
        const undone = Number.isInteger(d.undone) && d.undone > 0 ? d.undone : 0;
        if (undone > s.undone) {
          update({ undone, undo: NO_UNDO });
          return adopt(d.moves, null);
        }
        if (undone < s.undone) return;
        const agrees = s.moves.every((move, i) => sameMove(move, d.moves[i]));
        if (agrees && d.moves.length > s.moves.length) adopt(d.moves, s.result?.resigned ?? null);
        const now = ctx.state();
        const resigned = colorOr(d.resigned);
        if (resigned && !now.result && d.moves.length === now.moves.length) {
          adopt(now.moves, resigned);
        }
        if (d.moves.length === ctx.state().moves.length) ctx.mergeMarks(d.marks);
        if (d.rematch === true) ctx.heardRematch();
      },
      /** The other player's move, number `d.n`: a point or a pass. */
      heardMove(d) {
        const s = ctx.state();
        if (s.phase !== "playing") return;
        if (d.n !== s.moves.length || colorOfMove(d.n) !== otherColor(ctx.mine())) {
          if (d.n > s.moves.length) tell({ t: "sync-ask" });
          return;
        }
        const move = isPass(d.move) ? PASS : d.move;
        if (refusal(s.moves, s.size, move)) return;
        const moves = [...s.moves, isPass(move) ? PASS : [move[0], move[1]]];
        const declined = s.undo.mine !== null || s.undo.declined;
        update({
          moves,
          phase: ctx.phaseFor(null, moves),
          undo: { ...NO_UNDO, declined },
          marks: NO_MARKS
        });
        const name = s.opponent.name;
        onNotice(
          playEnded(moves) ? { kind: "scoring", name } : isPass(move) ? { kind: "passed", name } : { kind: "moved", name, cell: moveName(s.size, move) }
        );
        save();
      }
    };
  }

  // page-src/marks.js
  function markActions(ctx) {
    const { update, tell, save, onNotice } = ctx;
    const boardNow = () => {
      const s = ctx.state();
      return positionOf(s.moves, s.size).board;
    };
    function apply(i) {
      const s = ctx.state();
      const dead = toggleChain(boardNow(), s.size, s.marks.dead, i);
      if (dead === s.marks.dead) return false;
      update({ marks: { dead, v: s.marks.v + 1, mine: false, theirs: false } });
      return true;
    }
    function toggle(i) {
      if (!ctx.canMark() || !Number.isInteger(i)) return false;
      const s = ctx.state();
      if (!apply(i)) return false;
      tell({ t: "mark", game: s.game, n: s.moves.length, at: i });
      save();
      return true;
    }
    return {
      toggle,
      /**
       * Makes the dead stones exactly the chains through `points`, toggling
       * each chain that differs (as an agent asks for a whole list at once).
       */
      setDead(points) {
        if (!ctx.canMark()) return false;
        const s = ctx.state();
        const want = new Set(cleanDead(boardNow(), s.size, points));
        for (const p of [.../* @__PURE__ */ new Set([...s.marks.dead, ...want])]) {
          const now = ctx.state().marks.dead.includes(p);
          if (now !== want.has(p)) toggle(p);
        }
        return true;
      },
      /** Accepts the dead stones as marked; the game ends once both have. */
      accept() {
        const s = ctx.state();
        if (!ctx.canMark() || s.marks.mine) return false;
        update({ marks: { ...s.marks, mine: true } });
        tell({ t: "accept", game: s.game, n: s.moves.length, dead: s.marks.dead });
        if (s.marks.theirs) ctx.finish(false);
        else save();
        return true;
      },
      /** What the other player said about the marks (`mark`, `accept`). */
      heard(d) {
        const s = ctx.state();
        if (s.phase !== "scoring" || d.n !== s.moves.length) return;
        if (d.t === "mark" && Number.isInteger(d.at)) {
          if (apply(d.at)) save();
        } else if (d.t === "accept" && sameList(d.dead, s.marks.dead) && !s.marks.theirs) {
          update({ marks: { ...s.marks, theirs: true } });
          onNotice({ kind: "accepted", name: s.opponent.name });
          if (s.marks.mine) ctx.finish(true);
          else save();
        }
      },
      /**
       * The marks from the other side's sync (same game, same moves): a
       * higher version is newer and replaces these; the same version and list
       * tells whether they accepted it.
       */
      merge(m) {
        const s = ctx.state();
        if (s.phase !== "scoring" || !m || typeof m !== "object" || !Number.isInteger(m.v)) return;
        const dead = cleanDead(boardNow(), s.size, m.dead);
        const accepted = m.accepted === true;
        if (m.v > s.marks.v) {
          update({ marks: { dead, v: m.v, mine: false, theirs: accepted } });
          return save();
        }
        if (m.v === s.marks.v && sameList(dead, s.marks.dead) && accepted && !s.marks.theirs) {
          update({ marks: { ...s.marks, theirs: true } });
          if (s.marks.mine) return ctx.finish(true);
          save();
        }
      }
    };
  }
  var marksData = (marks) => ({ dead: marks.dead, v: marks.v, accepted: marks.mine });
  function marksFrom(data, moves, size) {
    if (!data || typeof data !== "object" || !Number.isInteger(data.v) || data.v < 0) return NO_MARKS;
    const dead = cleanDead(positionOf(moves, size).board, size, data.dead);
    return { dead, v: data.v, mine: data.accepted === true, theirs: false };
  }

  // page-src/match.js
  var APP = "tilego";
  var V = 1;
  var NAME_MAX = 24;
  var DEFAULT_SIZE = 9;
  var FULL_RETRIES = 5;
  var FULL_WAIT = 3e3;
  var cleanName = (name) => typeof name === "string" ? [...name.trim().replace(/\s+/g, " ")].slice(0, NAME_MAX).join("") : "";
  var makerColor = (game) => game % 2 === 1 ? "black" : "white";
  var myColor = (creator, game) => creator ? makerColor(game) : otherColor(makerColor(game));
  var freshGame = (game) => ({
    game,
    moves: [],
    result: null,
    rematch: { mine: false, theirs: false },
    undo: NO_UNDO,
    undone: 0,
    marks: NO_MARKS
  });
  function createMatch({ relay, player: player2, timers = globalThis, onChange, onSave, onNotice }) {
    let state = {
      phase: "lobby",
      // lobby | connecting | waiting | playing | scoring | over
      error: null,
      // a relay or join error code, shown in the lobby
      online: false,
      offline: false,
      // several tries to reach the relay failed in a row
      room: null,
      creator: false,
      name: "",
      size: DEFAULT_SIZE,
      opponent: null,
      // { player, name, here, gone }
      ...freshGame(1)
      // game, moves, result, rematch, undo, undone, marks
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
      const { undo, marks: marks2 } = state;
      const here = !!state.opponent?.here;
      return {
        ...state,
        color,
        turn,
        myTurn: state.phase === "playing" && turn === color && here,
        marking: state.phase === "scoring" && here && state.online,
        marks: { dead: marks2.dead, mine: marks2.mine, theirs: marks2.theirs },
        undo: {
          canAsk: undoPhase(state.phase) && here && undo.mine === null && undo.theirs === null && undoTarget(state.moves, color) !== null,
          asked: undo.mine !== null,
          offered: undo.theirs !== null,
          declined: undo.declined
        }
      };
    }
    const gameData = () => ({
      game: state.game,
      size: state.size,
      moves: state.moves,
      resigned: state.result?.resigned ?? null,
      scored: !!state.result?.score,
      undone: state.undone,
      marks: marksData(state.marks)
    });
    const save = () => {
      if (!state.room) return onSave(null);
      const { opponent } = state;
      onSave({
        room: state.room,
        creator: state.creator,
        name: state.name,
        opponent: opponent ? { player: opponent.player, name: opponent.name } : null,
        ...gameData()
      });
    };
    const tell = (data) => relay.send({ op: "send", data: { v: V, ...data } });
    const hi = () => tell({ t: "hi", player: player2, name: state.name, creator: state.creator, size: state.size });
    const sync = () => tell({ t: "sync", ...gameData(), rematch: state.rematch.mine });
    const phaseFor = (result, moves = state.moves) => result ? "over" : !state.opponent ? "waiting" : playEnded(moves) ? "scoring" : "playing";
    function finish(byThem) {
      const result = scoredResult(state.moves, state.size, state.marks.dead);
      update({ result, phase: "over" });
      if (byThem) onNotice({ kind: "over", name: state.opponent.name });
      save();
    }
    const undos = undoActions({
      state: () => state,
      update,
      tell,
      save,
      canAsk: () => view2().undo.canAsk,
      mine: () => myColor(state.creator, state.game),
      phaseFor,
      onNotice
    });
    const marks = markActions({
      state: () => state,
      update,
      tell,
      save,
      canMark: () => view2().marking,
      finish,
      onNotice
    });
    const follow = followActions({
      state: () => state,
      update,
      tell,
      save,
      phaseFor,
      onNotice,
      mine: () => myColor(state.creator, state.game),
      freshGame,
      takeSize: (size) => takeSize(size),
      mergeMarks: (m) => marks.merge(m),
      heardRematch: () => heardRematch()
    });
    function newGame(game) {
      update(freshGame(game));
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
        ...freshGame(1)
      });
      save();
    }
    function create(name, size = DEFAULT_SIZE) {
      const clean = cleanName(name);
      if (!clean) return update({ error: "no-name" });
      pending = "create";
      update({
        phase: "connecting",
        error: null,
        name: clean,
        creator: true,
        size: isSize(size) ? size : DEFAULT_SIZE
      });
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
      if (!saved || !parseCode(saved.room) || !isValidGame(saved.moves, saved.size)) return;
      pending = null;
      const opponent = saved.opponent ? { ...saved.opponent, here: false, gone: false } : null;
      const kept = marksFrom(saved.marks, saved.moves, saved.size);
      const resigned = colorOr(saved.resigned);
      const result = resigned ? resignedResult(resigned) : saved.scored === true && playEnded(saved.moves) ? scoredResult(saved.moves, saved.size, kept.dead) : null;
      update({
        phase: "connecting",
        error: null,
        room: saved.room,
        creator: !!saved.creator,
        name: cleanName(saved.name),
        size: saved.size,
        opponent,
        game: Number.isInteger(saved.game) && saved.game > 0 ? saved.game : 1,
        moves: saved.moves,
        undone: Number.isInteger(saved.undone) && saved.undone > 0 ? saved.undone : 0,
        undo: NO_UNDO,
        marks: playEnded(saved.moves) ? kept : NO_MARKS,
        result
      });
      relay.connect();
    }
    function playMove2(move) {
      if (!view2().myTurn || refusal(state.moves, state.size, move)) return false;
      if (state.undo.theirs) tell({ t: "undo-no", game: state.game, n: state.undo.theirs.n });
      if (state.undo.mine !== null || state.undo.theirs || state.undo.declined)
        update({ undo: NO_UNDO });
      const n = state.moves.length;
      const moves = [...state.moves, move];
      update({ moves, phase: phaseFor(null, moves), marks: NO_MARKS });
      tell({ t: "move", game: state.game, n, move });
      save();
      return true;
    }
    function resign() {
      if (state.phase !== "playing" && state.phase !== "scoring") return;
      const color = myColor(state.creator, state.game);
      update({ result: resignedResult(color), phase: "over" });
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
      if (d.game !== void 0 && d.t !== "sync" && d.game !== state.game) return;
      if (d.t === "sync") return follow.heardSync(d);
      if (d.t === "sync-ask") return sync();
      if (d.t === "move") return follow.heardMove(d);
      if (d.t === "resign" && (state.phase === "playing" || state.phase === "scoring")) {
        const color = otherColor(myColor(state.creator, state.game));
        update({ result: resignedResult(color), phase: "over" });
        onNotice({ kind: "over", name: state.opponent.name });
        return save();
      }
      if (d.t === "rematch") return heardRematch();
      if (d.t === "undo-ask" || d.t === "undo-yes" || d.t === "undo-no") return undos.heard(d);
      if (d.t === "mark" || d.t === "accept") return marks.heard(d);
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
    function takeSize(size) {
      if (state.creator || !isSize(size) || size === state.size || state.moves.length > 0) return;
      update({ size });
    }
    function heardHi(d) {
      if (typeof d.player !== "string" || d.player === player2 || !!d.creator === state.creator)
        return;
      if (state.opponent && state.opponent.player !== d.player) return;
      if (d.creator) takeSize(d.size);
      const first = !state.opponent;
      const opponent = { player: d.player, name: cleanName(d.name) || "?", here: true, gone: false };
      update({ opponent });
      update({ phase: phaseFor(state.result) });
      if (first) onNotice({ kind: "joined", name: opponent.name });
      sync();
      save();
    }
    return {
      relayEvent,
      create,
      join,
      resume,
      play: (x, y) => playMove2([x, y]),
      pass: () => playMove2(PASS),
      resign,
      rematch,
      undo: undos.ask,
      allowUndo: undos.allow,
      declineUndo: undos.decline,
      mark: marks.toggle,
      setDead: marks.setDead,
      accept: marks.accept,
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

  // page-src/versus.js
  var userColor = (game) => game % 2 === 1 ? "black" : "white";
  function createVersus({ agentName, onChange, onSave, onNotice = () => {
  } }) {
    let state = {
      phase: "lobby",
      // lobby | playing | scoring | over
      name: "",
      game: 1,
      size: DEFAULT_SIZE,
      moves: [],
      result: null,
      marks: NO_MARKS
      // dead, mine (the user accepted), theirs (the agent did)
    };
    function view2() {
      const color = userColor(state.game);
      const turn = turnOf(state.moves);
      const playing = state.phase === "playing";
      const { marks } = state;
      return {
        mode: "agent",
        phase: state.phase,
        error: null,
        online: true,
        offline: false,
        room: null,
        creator: true,
        name: state.name,
        size: state.size,
        opponent: { player: "agent", name: agentName, here: true, gone: false },
        game: state.game,
        moves: state.moves,
        result: state.result,
        rematch: { mine: false, theirs: true },
        color,
        turn,
        myTurn: playing && turn === color,
        agentTurn: playing && turn !== color,
        marking: state.phase === "scoring",
        marks: { dead: marks.dead, mine: marks.mine, theirs: marks.theirs },
        undo: {
          canAsk: (playing || state.phase === "scoring") && undoTarget(state.moves, color) !== null,
          asked: false,
          offered: false,
          declined: false
        }
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
        size: state.size,
        moves: state.moves,
        resigned: state.result?.resigned ?? null,
        scored: !!state.result?.score,
        marks: { dead: state.marks.dead, mine: state.marks.mine, theirs: state.marks.theirs }
      }
    );
    const phaseAfter = (moves) => playEnded(moves) ? "scoring" : "playing";
    function place(move) {
      if (state.phase !== "playing") return "not-playing";
      const why = refusal(state.moves, state.size, move);
      if (why) return why;
      const moves = [...state.moves, move];
      update({ moves, phase: phaseAfter(moves), marks: NO_MARKS });
      save();
      return null;
    }
    const setMarks = (dead) => update({ marks: { dead, v: 0, mine: false, theirs: false } });
    function accepted(side) {
      const marks = { ...state.marks, [side]: true };
      if (marks.mine && marks.theirs) {
        update({ marks, result: scoredResult(state.moves, state.size, marks.dead), phase: "over" });
      } else update({ marks });
      save();
    }
    return {
      view: view2,
      /** Starts a game against the agent on a board of `size`, the user playing black. */
      start(name, size = DEFAULT_SIZE) {
        update({
          phase: "playing",
          name: cleanName(name),
          game: 1,
          size: isSize(size) ? size : DEFAULT_SIZE,
          moves: [],
          result: null,
          marks: NO_MARKS
        });
        save();
      },
      /** The user's stone; true when it was played. */
      play(x, y) {
        return view2().myTurn && place([x, y]) === null;
      },
      /** The user passes; true when it counted. */
      pass() {
        return view2().myTurn && place(PASS) === null;
      },
      /**
       * The agent's move, a point [x, y] or "pass": null when played, else
       * why not ("not-your-turn", "not-playing", "taken", "ko", "suicide", …).
       */
      agentPlay(move) {
        if (state.phase === "scoring") return "ended";
        if (state.phase === "playing" && !view2().agentTurn) return "not-your-turn";
        const why = place(move);
        if (why) return why;
        if (playEnded(state.moves)) onNotice({ kind: "scoring", name: agentName });
        else if (isPass(move)) onNotice({ kind: "agent-passed", name: agentName });
        else onNotice({ kind: "agent-moved", name: agentName, cell: moveName(state.size, move) });
        return null;
      },
      /** The user marks the chain through point `i` dead, or alive again. */
      mark(i) {
        if (state.phase !== "scoring") return false;
        const dead = toggleChain(
          positionOf(state.moves, state.size).board,
          state.size,
          state.marks.dead,
          i
        );
        if (dead === state.marks.dead) return false;
        setMarks(dead);
        save();
        return true;
      },
      /** The agent names the dead stones (any point of each dead chain); why not, or null. */
      agentDead(points) {
        if (state.phase !== "scoring") return "not-scoring";
        const dead = cleanDead(positionOf(state.moves, state.size).board, state.size, points);
        if (!sameList(dead, state.marks.dead)) {
          setMarks(dead);
          save();
        }
        return null;
      },
      /** The user accepts the dead stones as marked. */
      accept() {
        if (state.phase !== "scoring" || state.marks.mine) return false;
        accepted("mine");
        return true;
      },
      /** The agent accepts the dead stones as marked; why not, or null. */
      agentAccept() {
        if (state.phase !== "scoring") return "not-scoring";
        if (!state.marks.theirs) {
          onNotice({ kind: "accepted", name: agentName });
          accepted("theirs");
        }
        return null;
      },
      /** Takes the user's last move back (and the agent's reply); true when it did. */
      undo() {
        if (!view2().undo.canAsk) return false;
        const moves = state.moves.slice(0, undoTarget(state.moves, userColor(state.game)));
        update({ moves, phase: phaseAfter(moves), marks: NO_MARKS });
        save();
        return true;
      },
      /** The user gives the game up. */
      resign() {
        if (state.phase !== "playing" && state.phase !== "scoring") return;
        update({ result: resignedResult(userColor(state.game)), phase: "over" });
        save();
      },
      /** Another game on the same size, colors swapped; the agent always says yes. */
      rematch() {
        if (state.phase !== "over") return;
        update({
          phase: "playing",
          game: state.game + 1,
          moves: [],
          result: null,
          marks: NO_MARKS
        });
        save();
      },
      /** Back to the lobby; the game is forgotten. */
      leave() {
        update({ phase: "lobby", game: 1, moves: [], result: null, marks: NO_MARKS });
        save();
      },
      dismiss() {
      },
      /** Picks up a kept game; false (nothing changes) when it couldn't have been played. */
      resume(saved) {
        if (!saved || saved.mode !== "agent" || !isValidGame(saved.moves, saved.size)) return false;
        const { size, moves } = saved;
        const game = Number.isInteger(saved.game) && saved.game > 0 ? saved.game : 1;
        const m = saved.marks && typeof saved.marks === "object" ? saved.marks : {};
        const ended = playEnded(moves);
        const marks = ended ? {
          dead: cleanDead(positionOf(moves, size).board, size, m.dead),
          v: 0,
          mine: m.mine === true,
          theirs: m.theirs === true
        } : NO_MARKS;
        const resigned = saved.resigned === "black" || saved.resigned === "white" ? saved.resigned : null;
        const result = resigned ? resignedResult(resigned) : ended && saved.scored === true ? scoredResult(moves, size, marks.dead) : null;
        update({
          phase: result ? "over" : phaseAfter(moves),
          name: cleanName(saved.name),
          game,
          size,
          moves,
          result,
          marks
        });
        return true;
      }
    };
  }

  // page-src/main.js
  var bridge = window.tilefold;
  var $ = (id) => document.getElementById(id);
  var send = (message) => {
    if (bridge) bridge.post(message).catch(() => {
    });
  };
  var labels = {};
  var num = (n) => {
    try {
      return new Intl.NumberFormat(document.documentElement.lang || "en").format(n);
    } catch {
      return String(n);
    }
  };
  var L = (key, vars = {}) => String(labels[key] ?? "").replace(
    /\{(name|code|cell|black|white|margin)\}/g,
    (_, k) => typeof vars[k] === "number" ? num(vars[k]) : String(vars[k] ?? "")
  );
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
  var agent = null;
  var view = null;
  var lastEvent = null;
  var newPlayerId = () => Array.from(
    crypto.getRandomValues(new Uint8Array(12)),
    (b) => b.toString(16).padStart(2, "0")
  ).join("");
  var pickedSize = () => Number($("size").value) || DEFAULT_SIZE;
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
    send({ type: "notice", kind: n.kind, name: n.name, cell: n.cell ?? "" });
  }
  function screen(name) {
    for (const id of ["lobby", "waiting", "game"]) $(id).hidden = id !== name;
  }
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
  function playerLine(el, color, name, turn) {
    el.textContent = "";
    const stone = document.createElement("span");
    stone.className = `stone-chip ${color}`;
    stone.setAttribute("aria-hidden", "true");
    el.append(stone, document.createTextNode(`${name} \xB7 ${L(`stone-${color}`)}`));
    el.classList.toggle("to-move", turn);
  }
  function pointLabel(cell, stone, dead, owner) {
    if (stone) return L(dead ? `cell-${stone}-dead` : `cell-${stone}`, { cell });
    return owner ? L(`cell-${owner}-area`, { cell }) : L("cell-empty", { cell });
  }
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
      label: pointLabel
    });
    $("scoring").hidden = !scoring;
    if (!scoring) return;
    const score = scoreOf(pos.board, v.size, dead);
    const name = v.opponent?.name ?? "";
    $("scoring-hint").textContent = L(v.mode === "agent" ? "scoring-hint-agent" : "scoring-hint");
    $("score-line").textContent = L("score-line", { black: score.black, white: score.white });
    $("accept-status").textContent = v.marks.mine ? L("accept-waiting", { name }) : v.marks.theirs ? L("accept-theirs", { name }) : "";
  }
  function render(v) {
    if (v.mode !== "agent" && versus && versus.view().phase !== "lobby") return;
    view = v;
    agent?.changed();
    const busy = v.phase === "connecting" && !v.room;
    $("conn").textContent = v.room && !v.online ? "\u25CF" : "";
    $("conn").title = v.room && !v.online ? L("status-reconnecting") : "";
    if (v.phase === "lobby" || busy) {
      screen("lobby");
      for (const id of ["new", "join", "name", "code", "versus", "size"]) $(id).disabled = busy;
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
    const other = otherColor(v.color);
    playerLine($("me"), v.color, L("player-you"), v.phase === "playing" && v.turn === v.color);
    playerLine($("them"), other, them, v.phase === "playing" && v.turn === other);
    $("status").textContent = status(v);
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
    $("undo-text").textContent = offered ? L("undo-offered", { name: them }) : L("undo-declined", { name: them });
    $("undo-allow").hidden = !offered;
    $("undo-decline").hidden = !offered;
    const over = v.phase === "over";
    $("rematch").hidden = !over || !!v.opponent?.gone;
    $("rematch").disabled = v.rematch.mine;
    $("rematch").textContent = v.mode === "agent" ? L("action-rematch") : v.rematch.mine ? L("rematch-waiting", { name: them }) : v.rematch.theirs ? L("rematch-accept") : L("action-rematch");
    $("offer").hidden = v.mode === "agent" || !(over && v.rematch.theirs && !v.rematch.mine);
    $("offer").textContent = L("rematch-offered", { name: them });
    if (over) event(v.result.winner === v.color ? "won" : "lost");
    else if (scoring) event("scoring");
    else if (playing) event("started");
  }
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
  function startVersus() {
    if (!versus || view?.room) return false;
    event("agent-game");
    versus.start($("name").value, pickedSize());
    return true;
  }
  function leaveVersus() {
    versus.leave();
    render(match.view());
  }
  var agentView = () => versus && versus.view().phase !== "lobby" ? versus.view() : match?.view() ?? null;
  var forAgent = {
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
    }
  };
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
      onEvent: (e) => match.relayEvent(e)
    });
    match = createMatch({ relay, player, onChange: render, onSave: keep, onNotice: notice });
    versus = createVersus({
      agentName: L("agent-name"),
      onChange: render,
      onSave: keep,
      onNotice: notice
    });
    agent = createAgentRequests({ send, view: agentView, start: startVersus, ...forAgent });
    keep(m.saved ?? null);
    if (m.saved?.mode === "agent") {
      if (!versus.resume(m.saved)) render(match.view());
    } else if (m.saved) match.resume(m.saved);
    else render(match.view());
    send({ type: "ready" });
  }
  function onPoint(x, y) {
    const game = active();
    const v = game?.view();
    if (!v) return;
    if (v.phase === "scoring") game.mark(y * v.size + x);
    else game.play(x, y);
  }
  function wire() {
    board = createBoard($("board"), { onPoint });
    $("versus").addEventListener("click", () => startVersus());
    $("new").addEventListener("click", () => match?.create($("name").value, pickedSize()));
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
    $("pass").addEventListener("click", () => active()?.pass());
    $("accept").addEventListener("click", () => active()?.accept());
    $("resign").addEventListener("click", () => active()?.resign());
    $("undo").addEventListener("click", () => {
      const against = active() === versus;
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
})();
