// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Room relay — the rooms
 *
 * Without a network: a connection makes a room and gets its code, others
 * join with it (any case), are told who is there and pass messages to
 * each other but not back to themselves; a full room, a wrong app, an
 * unknown code and malformed frames get their error codes; a connection
 * is in one room at most; leaving or closing tells the others; a burst of
 * frames past the allowance is refused, and so is a frame too large; an
 * unused room expires after a day while a used one stays; `authorize` can
 * refuse; the activity log never sees names, codes or messages.
 */
import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  MAX_FRAME,
  MAX_NAME,
  RATE_BURST,
  RATE_PER_SECOND,
  ROOM_TTL_MS,
  cleanName,
  createRooms,
  randomCode,
} from "../../relay/rooms.mjs";

/** Rooms on a fake clock, with codes from `codes`, and helpers to talk to them. */
function setup(options = {}) {
  let clock = 1_000_000;
  const codes = ["K7P4QX", "MN3RTV", "ACD679"];
  const logs = [];
  const rooms = createRooms({
    now: () => clock,
    code: () => codes.shift() ?? "EFGHJK",
    log: (action, details) => logs.push({ action, ...details }),
    ...options,
  });
  const heard = new Map();
  const conn = (id, info) => {
    heard.set(id, []);
    rooms.connect(id, (text) => heard.get(id).push(JSON.parse(text)), info);
    return {
      say: (m) => rooms.receive(id, typeof m === "string" ? m : JSON.stringify(m)),
      heard: () => heard.get(id),
      last: () => heard.get(id).at(-1),
    };
  };
  return { rooms, conn, logs, tick: (ms) => (clock += ms) };
}

describe("rooms", () => {
  it("makes a room with a code and lets the next one in, telling each who is there", () => {
    const { conn } = setup();
    const ada = conn("a");
    const bo = conn("b");
    ada.say({ op: "create", app: "gomoku", size: 2, name: "  Ada   L " });
    expect(ada.last()).toEqual({ op: "created", room: "K7P4QX", you: "a" });
    bo.say({ op: "join", room: "k7p4qx", app: "gomoku", name: "Bo" });
    expect(bo.last()).toEqual({
      op: "joined",
      room: "K7P4QX",
      you: "b",
      members: [{ id: "a", name: "Ada L" }],
    });
    expect(ada.last()).toEqual({ op: "member-joined", member: { id: "b", name: "Bo" } });
  });

  it("passes what one sends to the others only", () => {
    const { conn } = setup();
    const [a, b, c] = ["a", "b", "c"].map((id) => conn(id));
    a.say({ op: "create", app: "chat", size: 3, name: "A" });
    b.say({ op: "join", room: "K7P4QX", app: "chat", name: "B" });
    c.say({ op: "join", room: "K7P4QX", app: "chat", name: "C" });
    a.say({ op: "send", data: { text: "hi", n: [1, 2] } });
    expect(b.last()).toEqual({ op: "message", from: "a", data: { text: "hi", n: [1, 2] } });
    expect(c.last()).toEqual({ op: "message", from: "a", data: { text: "hi", n: [1, 2] } });
    expect(a.heard().some((m) => m.op === "message")).toBe(false);
  });

  it("answers with the reason it can't", () => {
    const { conn } = setup();
    const [a, b, c] = ["a", "b", "c"].map((id) => conn(id));
    a.say({ op: "create", app: "gomoku", size: 2, name: "A" });
    b.say({ op: "join", room: "K7P4QX", app: "gomoku", name: "B" });
    c.say({ op: "join", room: "K7P4QX", app: "gomoku", name: "C" });
    expect(c.last()).toEqual({ op: "error", code: "room-full" });
    c.say({ op: "join", room: "K7P4QX", app: "chess", name: "C" });
    expect(c.last()).toEqual({ op: "error", code: "wrong-app" });
    c.say({ op: "join", room: "MN3RTV", app: "gomoku", name: "C" });
    expect(c.last()).toEqual({ op: "error", code: "no-room" });
    for (const bad of [
      "not json",
      "[1]",
      "null",
      { op: "dance" },
      { op: "join", room: "K7P", app: "gomoku" },
      { op: "join", room: "K7P4QO", app: "gomoku" },
      { op: "create", app: "Bad App", size: 2 },
      { op: "create", app: "gomoku", size: 1 },
      { op: "create", app: "gomoku", size: 9 },
      { op: "send", data: 1 },
    ]) {
      c.say(bad);
      expect(c.last()).toEqual({ op: "error", code: "bad-request" });
    }
    c.say({ op: "ping" });
    expect(c.last()).toEqual({ op: "pong" });
  });

  it("keeps a connection in one room, and tells the others when it goes", () => {
    const { conn } = setup();
    const [a, b] = ["a", "b"].map((id) => conn(id));
    a.say({ op: "create", app: "gomoku", size: 2, name: "A" });
    b.say({ op: "join", room: "K7P4QX", app: "gomoku", name: "B" });
    b.say({ op: "create", app: "gomoku", size: 2, name: "B" });
    expect(a.last()).toEqual({ op: "member-left", member: { id: "b" } });
    expect(b.last()).toEqual({ op: "created", room: "MN3RTV", you: "b" });
    // Sending now reaches only B's new room, where nobody else is.
    b.say({ op: "send", data: "x" });
    expect(a.heard().filter((m) => m.op === "message")).toEqual([]);
  });

  it("frees a seat when someone leaves or their connection closes, and keeps the room", () => {
    const { rooms, conn } = setup();
    const [a, b, c] = ["a", "b", "c"].map((id) => conn(id));
    a.say({ op: "create", app: "gomoku", size: 2, name: "A" });
    b.say({ op: "join", room: "K7P4QX", app: "gomoku", name: "B" });
    rooms.disconnect("b");
    expect(a.last()).toEqual({ op: "member-left", member: { id: "b" } });
    c.say({ op: "join", room: "K7P4QX", app: "gomoku", name: "B again" });
    expect(c.last().op).toBe("joined");
    c.say({ op: "leave" });
    expect(a.last()).toEqual({ op: "member-left", member: { id: "c" } });
    // Everyone gone: the room waits for them to come back.
    rooms.disconnect("a");
    const d = conn("d");
    d.say({ op: "join", room: "K7P4QX", app: "gomoku", name: "A" });
    expect(d.last()).toMatchObject({ op: "joined", members: [] });
  });

  it("lets someone join their own room again without taking two seats", () => {
    const { conn } = setup();
    const [a, b] = ["a", "b"].map((id) => conn(id));
    a.say({ op: "create", app: "gomoku", size: 2, name: "A" });
    b.say({ op: "join", room: "K7P4QX", app: "gomoku", name: "B" });
    b.say({ op: "join", room: "K7P4QX", app: "gomoku", name: "B" });
    expect(b.last()).toMatchObject({ op: "joined", members: [{ id: "a", name: "A" }] });
  });

  it("refuses frames past the allowance, and lets them through again later", () => {
    const { conn, tick } = setup();
    const a = conn("a");
    for (let i = 0; i < RATE_BURST; i++) a.say({ op: "ping" });
    expect(a.heard().every((m) => m.op === "pong")).toBe(true);
    a.say({ op: "ping" });
    expect(a.last()).toEqual({ op: "error", code: "too-fast" });
    tick(1000 / RATE_PER_SECOND);
    a.say({ op: "ping" });
    expect(a.last()).toEqual({ op: "pong" });
  });

  it("refuses a frame larger than the limit", () => {
    const { conn } = setup();
    const a = conn("a");
    a.say({ op: "create", app: "gomoku", size: 2, name: "A" });
    a.say({ op: "send", data: "x".repeat(MAX_FRAME) });
    expect(a.last()).toEqual({ op: "error", code: "too-large" });
  });

  it("expires a room unused for a day, and keeps one in use", () => {
    const { rooms, conn, tick } = setup();
    const [a, b] = ["a", "b"].map((id) => conn(id));
    a.say({ op: "create", app: "gomoku", size: 2, name: "A" });
    b.say({ op: "create", app: "gomoku", size: 2, name: "B" });
    tick(ROOM_TTL_MS - 1000);
    b.say({ op: "send", data: "still here" });
    tick(2000);
    expect(rooms.sweep()).toBe(1);
    const c = conn("c");
    c.say({ op: "join", room: "K7P4QX", app: "gomoku", name: "C" });
    expect(c.last()).toEqual({ op: "error", code: "no-room" });
    c.say({ op: "join", room: "MN3RTV", app: "gomoku", name: "C" });
    expect(c.last().op).toBe("joined");
    // The one in the expired room is in none now.
    a.say({ op: "send", data: "anyone?" });
    expect(a.last()).toEqual({ op: "error", code: "bad-request" });
  });

  it("asks authorize before creating or joining", () => {
    const { conn } = setup({ authorize: (info) => info.signedIn === true });
    const guest = conn("g", {});
    const member = conn("m", { signedIn: true });
    guest.say({ op: "create", app: "gomoku", size: 2, name: "G" });
    expect(guest.last()).toEqual({ op: "error", code: "unauthorized" });
    member.say({ op: "create", app: "gomoku", size: 2, name: "M" });
    guest.say({ op: "join", room: "K7P4QX", app: "gomoku", name: "G" });
    expect(guest.last()).toEqual({ op: "error", code: "unauthorized" });
  });

  it("logs actions and plain details only, never names, codes or messages", () => {
    const { conn, logs, rooms } = setup();
    const [a, b] = ["a", "b"].map((id) => conn(id));
    a.say({ op: "create", app: "gomoku", size: 2, name: "Ada" });
    b.say({ op: "join", room: "K7P4QX", app: "gomoku", name: "Bo" });
    a.say({ op: "send", data: { secret: "hush" } });
    b.say({ op: "join", room: "ACD679", app: "gomoku", name: "Bo" });
    rooms.disconnect("a");
    expect(logs.map((l) => l.action)).toEqual([
      "connected",
      "connected",
      "created",
      "joined",
      "refused",
      "left",
      "disconnected",
    ]);
    expect(JSON.stringify(logs)).not.toMatch(/Ada|Bo|K7P4QX|ACD679|hush/);
  });
});

describe("codes and names", () => {
  it("makes codes from the alphabet without look-alikes", () => {
    for (let i = 0; i < 50; i++) {
      const code = randomCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect([...code].every((ch) => CODE_ALPHABET.includes(ch))).toBe(true);
    }
    expect(CODE_ALPHABET).not.toMatch(/[0O1IL2Z5S8B]/);
  });

  it("cleans names", () => {
    expect(cleanName("  a\u0000b\n  c ")).toBe("ab c");
    expect([...cleanName("x".repeat(100))]).toHaveLength(MAX_NAME);
    expect(cleanName(42)).toBe("");
  });
});
