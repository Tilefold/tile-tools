// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — the room relay's client
 *
 * Against the fake relay: the client opens, sends and hears JSON frames,
 * ignores frames that aren't the protocol's, pings an idle connection,
 * reconnects after a drop with growing waits (saying `offline` after a few
 * failed tries), and stays closed once closed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKOFF,
  OFFLINE_AFTER,
  PING_EVERY,
  createRelay,
} from "../../examples/gomoku/page-src/relay.js";
import { createFakeRelay } from "../fake-relay.mjs";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Lets queued frames arrive. */
const flush = () => vi.advanceTimersByTimeAsync(0);

/** A client of `server` that records what it hears. */
function client(server) {
  const events = [];
  const relay = createRelay({
    url: "wss://relay.example.com/rooms",
    WebSocket: server.WebSocket,
    onEvent: (e) => events.push(e),
  });
  return { relay, events, types: () => events.map((e) => e.type) };
}

describe("the relay client", () => {
  it("opens, sends JSON and hears the relay's answers", async () => {
    const server = createFakeRelay();
    const c = client(server);
    c.relay.connect();
    await flush();
    expect(c.types()).toEqual(["open"]);
    expect(c.relay.isOpen()).toBe(true);
    expect(c.relay.send({ op: "create", app: "gomoku", size: 2, name: "Ada" })).toBe(true);
    await flush();
    expect(c.events.at(-1)).toEqual({
      type: "message",
      message: { op: "created", room: "K7P4QX", you: "c1" },
    });
  });

  it("ignores frames that aren't the protocol's", async () => {
    const server = createFakeRelay();
    const c = client(server);
    c.relay.connect();
    await flush();
    const socket = server.sockets.get("c1");
    socket.receive("not json");
    socket.receive(JSON.stringify({ hello: 1 }));
    socket.receive(JSON.stringify(["op"]));
    await flush();
    expect(c.types()).toEqual(["open"]);
  });

  it("pings an open connection every minute", async () => {
    const server = createFakeRelay();
    const c = client(server);
    c.relay.connect();
    await flush();
    await vi.advanceTimersByTimeAsync(PING_EVERY * 2);
    expect(server.sentBy("c1")).toEqual([{ op: "ping" }, { op: "ping" }]);
    expect(c.events.filter((e) => e.message?.op === "pong")).toHaveLength(2);
  });

  it("reconnects after a drop, waiting longer each time, and says when it's offline", async () => {
    const server = createFakeRelay();
    const c = client(server);
    c.relay.connect();
    await flush();
    server.down = true;
    server.drop("c1");
    await flush();
    expect(c.types()).toEqual(["open", "close"]);
    // Each failed try waits the next step of the backoff before the one after.
    let waited = 0;
    for (let i = 0; i < OFFLINE_AFTER; i++) {
      await vi.advanceTimersByTimeAsync(BACKOFF[i]);
      waited += BACKOFF[i];
    }
    expect(c.types()).toEqual(["open", "close", "offline"]);
    expect(c.relay.isOpen()).toBe(false);
    server.down = false;
    await vi.advanceTimersByTimeAsync(BACKOFF[OFFLINE_AFTER]);
    expect(c.types().at(-1)).toBe("open");
    expect(c.relay.isOpen()).toBe(true);
    expect(waited).toBeGreaterThan(0);
  });

  it("keeps the longest wait once the backoff runs out", async () => {
    const server = createFakeRelay();
    server.down = true;
    const c = client(server);
    let made = 0;
    const counting = class extends server.WebSocket {
      constructor(url) {
        super(url);
        made += 1;
      }
    };
    const relay = createRelay({
      url: "wss://x.example.com",
      WebSocket: counting,
      onEvent: () => {},
    });
    relay.connect();
    await flush();
    const total = BACKOFF.reduce((a, b) => a + b, 0);
    await vi.advanceTimersByTimeAsync(total + BACKOFF.at(-1) * 2);
    // One first try, one per backoff step, then two more at the longest wait.
    expect(made).toBe(1 + BACKOFF.length + 2);
    relay.close();
    void c;
  });

  it("stays closed after close(), and sends nothing then", async () => {
    const server = createFakeRelay();
    const c = client(server);
    c.relay.connect();
    await flush();
    c.relay.close();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(c.relay.isOpen()).toBe(false);
    expect(c.relay.send({ op: "ping" })).toBe(false);
    expect(server.sockets.size).toBe(0);
    expect(c.types()).toEqual(["open"]);
  });
});
