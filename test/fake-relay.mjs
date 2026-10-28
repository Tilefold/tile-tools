/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake room relay (tests only)
 *
 * An in-memory relay that speaks the room protocol the Gomoku example uses
 * (create, join, send, leave, ping), with a WebSocket class to connect to
 * it. Frames are delivered on the next microtask, as a real socket would
 * deliver them later than the send. Tests can drop a connection
 * (`relay.drop(id)`), refuse new ones (`relay.down = true`), and read every
 * frame sent in either direction (`relay.log`). Frames a page sent just
 * before closing its socket still arrive, as they do over a real one.
 */

/** Room codes the fake hands out, in order. */
const CODES = ["K7P4QX", "MN3RTV", "ACD679", "EFGHJK"];

export function createFakeRelay({ maxSize = 2 } = {}) {
  const rooms = new Map(); // code -> { app, size, members: Map(id -> { id, name, socket }) }
  const sockets = new Map(); // id -> socket
  let nextId = 1;
  let nextCode = 0;

  const relay = {
    /** Every frame: { dir: "in" | "out", id, message }. */
    log: [],
    /** While true, new connections fail. */
    down: false,
    rooms,
    sockets,
    /** Closes a connection from the relay's side, as a dropped network would. */
    drop(id) {
      sockets.get(id)?.serverClose();
    },
    /** The frames one connection sent to the relay. */
    sentBy(id) {
      return relay.log.filter((f) => f.dir === "in" && f.id === id).map((f) => f.message);
    },
  };

  const deliver = (socket, message) => {
    relay.log.push({ dir: "out", id: socket.id, message });
    socket.receive(JSON.stringify(message));
  };

  /** The room a connection is in, with its code. */
  const roomOf = (id) => {
    for (const [code, room] of rooms) if (room.members.has(id)) return [code, room];
    return [null, null];
  };

  const leave = (id) => {
    const [code, room] = roomOf(id);
    if (!room) return;
    room.members.delete(id);
    for (const m of room.members.values()) deliver(m.socket, { op: "member-left", member: { id } });
    // Rooms stay (a player may come back); the real relay expires them.
    void code;
  };

  const handle = (socket, raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return deliver(socket, { op: "error", code: "bad-request" });
    }
    relay.log.push({ dir: "in", id: socket.id, message: m });
    const id = socket.id;
    if (m.op === "ping") return deliver(socket, { op: "pong" });
    if (m.op === "create") {
      leave(id);
      const code = CODES[nextCode++ % CODES.length];
      rooms.set(code, {
        app: m.app,
        size: Math.min(m.size || 2, maxSize),
        members: new Map([[id, { id, name: m.name, socket }]]),
      });
      return deliver(socket, { op: "created", room: code, you: id });
    }
    if (m.op === "join") {
      const room = rooms.get(m.room);
      if (!room) return deliver(socket, { op: "error", code: "no-room" });
      if (room.app !== m.app) return deliver(socket, { op: "error", code: "wrong-app" });
      if (room.members.size >= room.size)
        return deliver(socket, { op: "error", code: "room-full" });
      leave(id);
      const members = [...room.members.values()].map(({ id: mid, name }) => ({ id: mid, name }));
      for (const other of room.members.values()) {
        deliver(other.socket, { op: "member-joined", member: { id, name: m.name } });
      }
      room.members.set(id, { id, name: m.name, socket });
      return deliver(socket, { op: "joined", room: m.room, you: id, members });
    }
    if (m.op === "send") {
      const [, room] = roomOf(id);
      if (!room) return deliver(socket, { op: "error", code: "bad-request" });
      for (const other of room.members.values()) {
        if (other.id !== id) deliver(other.socket, { op: "message", from: id, data: m.data });
      }
      return;
    }
    if (m.op === "leave") return leave(id);
    deliver(socket, { op: "error", code: "bad-request" });
  };

  /** The WebSocket class pages use to reach this relay. */
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.id = `c${nextId++}`;
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;
      const failed = relay.down;
      queueMicrotask(() => {
        if (this.readyState !== 0) return;
        if (failed) {
          this.readyState = 3;
          this.onerror?.({});
          this.onclose?.({});
          return;
        }
        this.readyState = 1;
        sockets.set(this.id, this);
        this.onopen?.({});
      });
    }
    send(text) {
      if (this.readyState !== 1) throw new Error("not open");
      // Like a real socket, what was sent before close() still goes out.
      queueMicrotask(() => handle(this, text));
    }
    receive(text) {
      queueMicrotask(() => {
        if (this.readyState === 1) this.onmessage?.({ data: text });
      });
    }
    /** The page closes it. */
    close() {
      this.shut();
    }
    /** The relay (or the network) closes it. */
    serverClose() {
      this.shut();
    }
    shut() {
      if (this.readyState === 3) return;
      this.readyState = 3;
      // Frames already on their way are handled first, then the relay sees it go.
      queueMicrotask(() => {
        sockets.delete(this.id);
        leave(this.id);
        this.onclose?.({});
      });
    }
  }

  relay.WebSocket = FakeWebSocket;
  return relay;
}
