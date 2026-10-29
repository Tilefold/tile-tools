/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Room relay — the rooms
 *
 * What a room relay does, without the network: connections make rooms
 * with a short code, others join them with it, and what one member sends
 * goes to the others. The relay knows nothing about what is sent (a game,
 * a chat), only who is in which room. This module is the whole protocol
 * (version 1, JSON text frames); `ws.mjs` and `server.mjs` put it on a
 * WebSocket.
 *
 *   to the relay                        from the relay
 *   { op: "create", app, size, name }   { op: "created", room, you }
 *   { op: "join", room, app, name }     { op: "joined", room, you, members }
 *   { op: "send", data }                { op: "message", from, data }
 *   { op: "leave" }                     { op: "member-joined", member }
 *   { op: "ping" }                      { op: "member-left", member }
 *                                       { op: "pong" }
 *                                       { op: "error", code }
 *
 * - `app` names the kind of room (such as "gomoku"), so a code from one
 *   tile can't put someone in another tile's room (`wrong-app`).
 * - `size` is how many may be in the room at once, 2 to MAX_SIZE; one more
 *   gets `room-full`.
 * - `you` and member ids name connections, not people: someone who
 *   reconnects gets a new id. `members` lists the others as { id, name }.
 * - A connection is in one room at most: creating or joining another
 *   leaves the first.
 * - A room stays while it is used; one nobody has used for ROOM_TTL_MS
 *   expires (`sweep`), and its code then answers `no-room`. An empty room
 *   is kept until then, so a player whose connection dropped can come back.
 * - Error codes: no-room, room-full, wrong-app, bad-request, too-large,
 *   too-fast, unauthorized (the last for relays that need an account; this
 *   one asks `authorize`, which lets everyone in by default).
 *
 * Every step is reported to `log` as an action word and a few plain
 * details (never names, codes or what was sent), for the relay's
 * activity log.
 */
import { randomInt } from "node:crypto";

/** Letters and digits of a room code: no look-alikes (0/O, 1/I/L, 2/Z, 5/S, 8/B). */
export const CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
/** Characters in a room code. */
export const CODE_LENGTH = 6;
/** Most people in one room. */
export const MAX_SIZE = 8;
/** Longest frame accepted, in bytes of its text. */
export const MAX_FRAME = 16 * 1024;
/** Longest name kept, in characters. */
export const MAX_NAME = 40;
/** Frames a connection may send in a burst, refilled at RATE_PER_SECOND. */
export const RATE_BURST = 30;
export const RATE_PER_SECOND = 10;
/** A room nobody has used for this long expires. */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
/** Most rooms at once; creating one more is refused as too-fast. */
export const MAX_ROOMS = 10_000;

const APP_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** A fresh random code. */
export function randomCode(pick = randomInt) {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[pick(CODE_ALPHABET.length)];
  return code;
}

/** `name` trimmed, with runs of spaces made one and control characters dropped, capped. */
export function cleanName(name) {
  if (typeof name !== "string") return "";
  const plain = name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return [...plain].slice(0, MAX_NAME).join("");
}

/**
 * The rooms of one relay. Options (all optional): `now` (ms clock),
 * `code` (makes a code; random by default), `authorize(connection)` (true
 * to let a connection create and join), `log(action, details)`.
 */
export function createRooms(options = {}) {
  const now = options.now ?? Date.now;
  const makeCode = options.code ?? (() => randomCode());
  const authorize = options.authorize ?? (() => true);
  const log = options.log ?? (() => {});

  /** code -> { app, size, members: Map(id -> { id, name }), usedAt } */
  const rooms = new Map();
  /** id -> { id, send, room, tokens, refilledAt, info } */
  const conns = new Map();

  const out = (conn, message) => {
    try {
      conn.send(JSON.stringify(message));
    } catch {
      // A connection that can't take a frame is going; its close cleans up.
    }
  };
  const fail = (conn, code) => {
    log("refused", { code });
    out(conn, { op: "error", code });
  };

  /** Takes one frame from `conn`'s allowance; false when it has none left. */
  const spend = (conn) => {
    const t = now();
    const refill = ((t - conn.refilledAt) / 1000) * RATE_PER_SECOND;
    conn.tokens = Math.min(RATE_BURST, conn.tokens + refill);
    conn.refilledAt = t;
    if (conn.tokens < 1) return false;
    conn.tokens -= 1;
    return true;
  };

  /** Takes `conn` out of its room, telling the others. */
  const leaveRoom = (conn, why) => {
    const room = conn.room && rooms.get(conn.room);
    conn.room = null;
    if (!room) return;
    room.members.delete(conn.id);
    room.usedAt = now();
    for (const id of room.members.keys()) {
      const other = conns.get(id);
      if (other) out(other, { op: "member-left", member: { id: conn.id } });
    }
    log("left", { by: why, members: room.members.size });
  };

  /** A code no room has. */
  const freshCode = () => {
    for (let i = 0; i < 20; i++) {
      const code = makeCode();
      if (!rooms.has(code)) return code;
    }
    return null;
  };

  const create = (conn, m) => {
    const app = typeof m.app === "string" ? m.app : "";
    const size = Number.isInteger(m.size) ? m.size : 2;
    if (!APP_PATTERN.test(app) || size < 2 || size > MAX_SIZE) return fail(conn, "bad-request");
    if (!authorize(conn.info)) return fail(conn, "unauthorized");
    if (rooms.size >= MAX_ROOMS) return fail(conn, "too-fast");
    const code = freshCode();
    if (!code) return fail(conn, "too-fast");
    leaveRoom(conn, "moved");
    rooms.set(code, {
      app,
      size,
      members: new Map([[conn.id, { id: conn.id, name: cleanName(m.name) }]]),
      usedAt: now(),
    });
    conn.room = code;
    log("created", { app, size });
    out(conn, { op: "created", room: code, you: conn.id });
  };

  const join = (conn, m) => {
    const code = typeof m.room === "string" ? m.room.toUpperCase() : "";
    if (!CODE_PATTERN.test(code) || typeof m.app !== "string") return fail(conn, "bad-request");
    if (!authorize(conn.info)) return fail(conn, "unauthorized");
    const room = rooms.get(code);
    if (!room) return fail(conn, "no-room");
    if (room.app !== m.app) return fail(conn, "wrong-app");
    if (conn.room === code) leaveRoom(conn, "rejoined");
    if (room.members.size >= room.size) return fail(conn, "room-full");
    leaveRoom(conn, "moved");
    const name = cleanName(m.name);
    const members = [...room.members.values()].map(({ id, name: n }) => ({ id, name: n }));
    for (const id of room.members.keys()) {
      const other = conns.get(id);
      if (other) out(other, { op: "member-joined", member: { id: conn.id, name } });
    }
    room.members.set(conn.id, { id: conn.id, name });
    room.usedAt = now();
    conn.room = code;
    log("joined", { app: room.app, members: room.members.size });
    out(conn, { op: "joined", room: code, you: conn.id, members });
  };

  const send = (conn, m) => {
    const room = conn.room && rooms.get(conn.room);
    if (!room || !("data" in m)) return fail(conn, "bad-request");
    room.usedAt = now();
    for (const id of room.members.keys()) {
      if (id === conn.id) continue;
      const other = conns.get(id);
      if (other) out(other, { op: "message", from: conn.id, data: m.data });
    }
  };

  return {
    /** A new connection: `send(text)` delivers a frame to it; `info` is for `authorize`. */
    connect(id, sendFrame, info = {}) {
      conns.set(id, {
        id,
        send: sendFrame,
        room: null,
        tokens: RATE_BURST,
        refilledAt: now(),
        info,
      });
      log("connected", {});
    },

    /** A frame from connection `id`. */
    receive(id, text) {
      const conn = conns.get(id);
      if (!conn) return;
      if (!spend(conn)) return fail(conn, "too-fast");
      if (typeof text !== "string" || Buffer.byteLength(text) > MAX_FRAME) {
        return fail(conn, "too-large");
      }
      let m;
      try {
        m = JSON.parse(text);
      } catch {
        return fail(conn, "bad-request");
      }
      if (!m || typeof m !== "object" || Array.isArray(m)) return fail(conn, "bad-request");
      switch (m.op) {
        case "ping":
          return out(conn, { op: "pong" });
        case "create":
          return create(conn, m);
        case "join":
          return join(conn, m);
        case "send":
          return send(conn, m);
        case "leave":
          return leaveRoom(conn, "asked");
        default:
          return fail(conn, "bad-request");
      }
    },

    /** Connection `id` closed. */
    disconnect(id) {
      const conn = conns.get(id);
      if (!conn) return;
      leaveRoom(conn, "closed");
      conns.delete(id);
      log("disconnected", {});
    },

    /**
     * Expires rooms nobody has used for ROOM_TTL_MS (people still in one
     * keep it alive by using it). Returns how many expired.
     */
    sweep() {
      const t = now();
      let expired = 0;
      for (const [code, room] of rooms) {
        if (t - room.usedAt < ROOM_TTL_MS) continue;
        for (const id of room.members.keys()) {
          const conn = conns.get(id);
          if (conn) conn.room = null;
        }
        rooms.delete(code);
        expired += 1;
      }
      if (expired) log("expired", { rooms: expired });
      return expired;
    },

    /** How many rooms and connections there are (for the server's health line). */
    stats: () => ({ rooms: rooms.size, connections: conns.size }),
  };
}
