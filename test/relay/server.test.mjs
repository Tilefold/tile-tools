// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Room relay — the server, over a real network
 *
 * A relay started on this machine, reached with Node's own WebSocket (the
 * one browsers have): frames encode and decode at every length class, a
 * masked message split over frames is put back together, the handshake
 * refuses wrong paths and origins, /health answers, two clients make and
 * join a room and pass messages, a closed client frees its seat, a silent
 * client is closed by the heartbeat, and two Gomoku boards (the example's
 * own relay client and match) play a game through it, one dropping and
 * coming back on the way. The command line and environment set the
 * options, and each activity line is one JSON object.
 */
import { connect } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createMatch } from "../../examples/gomoku/page-src/match.js";
import { createRelay } from "../../examples/gomoku/page-src/relay.js";
import { logLine, optionsFrom, startRelay } from "../../relay/server.mjs";
import { acceptKey, decodeFrame, encodeFrame } from "../../relay/ws.mjs";

const relays = [];
afterEach(async () => {
  for (const r of relays.splice(0)) await r.close();
});

/** A relay on a free port that keeps its activity lines. */
async function relay(options = {}) {
  const lines = [];
  const r = await startRelay({
    port: 0,
    log: (action, d) => lines.push({ action, ...d }),
    ...options,
  });
  relays.push(r);
  return Object.assign(r, { lines });
}

/** Resolves once `check()` is true (checked every few ms), or fails after `ms`. */
async function until(check, ms = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** A client with Node's WebSocket that keeps what it heard. */
async function client(url, options) {
  const ws = new WebSocket(url, options);
  const heard = [];
  ws.onmessage = (e) => heard.push(JSON.parse(e.data));
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    ws,
    heard,
    say: (m) => ws.send(JSON.stringify(m)),
    next: async (op) => {
      await until(() => heard.some((m) => m.op === op));
      return heard.splice(
        heard.findIndex((m) => m.op === op),
        1,
      )[0];
    },
  };
}

/** A masked client frame, as a browser sends it. */
function clientFrame(opcode, text, fin = true) {
  const payload = Buffer.from(text);
  const mask = Buffer.from([1, 2, 3, 4]);
  const masked = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
  return Buffer.concat([
    Buffer.from([(fin ? 0x80 : 0) | opcode, 0x80 | payload.length]),
    mask,
    masked,
  ]);
}

describe("frames", () => {
  it("encode and decode at every length class", () => {
    for (const n of [0, 5, 125, 126, 65535, 65536]) {
      const payload = Buffer.alloc(n, 7);
      const frame = decodeFrame(encodeFrame(0x1, payload), 1 << 20);
      expect(frame).toMatchObject({ fin: true, opcode: 1, masked: false });
      expect(frame.payload.length).toBe(n);
    }
    expect(decodeFrame(encodeFrame(0x1, Buffer.alloc(200)), 100)).toEqual({ error: 1009 });
    expect(decodeFrame(Buffer.from([0x81]), 100)).toBeNull();
  });

  it("make the handshake's accept key as the standard says", () => {
    // The worked example from RFC 6455.
    expect(acceptKey("dGhlIHNhbXBsZSBub25jZQ==")).toBe("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
  });
});

describe("the relay server", () => {
  it("answers /health and turns away wrong paths and origins", async () => {
    const r = await relay({ allowOrigin: (o) => o === "tilefold://page" });
    const health = await (await fetch(`http://127.0.0.1:${r.port}/health`)).json();
    expect(health).toEqual({ ok: true, rooms: 0, connections: 0 });
    await expect(client(`ws://127.0.0.1:${r.port}/elsewhere`)).rejects.toBeTruthy();
    await expect(
      client(r.url, { headers: { Origin: "https://evil.example" } }),
    ).rejects.toBeTruthy();
  });

  it("makes and joins a room and passes messages between two clients", async () => {
    const r = await relay();
    const a = await client(r.url);
    const b = await client(r.url);
    a.say({ op: "create", app: "chat", size: 2, name: "A" });
    const { room } = await a.next("created");
    b.say({ op: "join", room, app: "chat", name: "B" });
    expect((await b.next("joined")).members).toEqual([expect.objectContaining({ name: "A" })]);
    await a.next("member-joined");
    b.say({ op: "send", data: { text: "héllo ✓" } });
    expect((await a.next("message")).data).toEqual({ text: "héllo ✓" });
    b.ws.close();
    await a.next("member-left");
    a.ws.close();
    expect(r.lines.map((l) => l.action)).toContain("joined");
  });

  it("lets authorize check the token in the address", async () => {
    const r = await relay({ rooms: { authorize: (info) => info.token === "good" } });
    const guest = await client(r.url);
    guest.say({ op: "create", app: "chat", size: 2, name: "G" });
    expect(await guest.next("error")).toEqual({ op: "error", code: "unauthorized" });
    const member = await client(`${r.url}?token=good`);
    member.say({ op: "create", app: "chat", size: 2, name: "M" });
    expect((await member.next("created")).room).toMatch(/^[A-Z0-9]{6}$/);
    guest.ws.close();
    member.ws.close();
  });

  it("puts a message split over frames back together", async () => {
    const r = await relay();
    const tcp = connect(r.port, "127.0.0.1");
    let got = Buffer.alloc(0);
    tcp.on("data", (d) => (got = Buffer.concat([got, d])));
    await new Promise((resolve) => tcp.once("connect", resolve));
    tcp.write(
      "GET /rooms HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n",
    );
    await until(() => got.includes("\r\n\r\n"));
    expect(got.toString()).toContain("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
    got = got.subarray(got.indexOf("\r\n\r\n") + 4);
    tcp.write(clientFrame(0x1, '{"op":', false));
    tcp.write(clientFrame(0x0, '"ping"}'));
    await until(() => decodeFrame(got, 1000) !== null);
    expect(decodeFrame(got, 1000).payload.toString()).toBe('{"op":"pong"}');
    // An unmasked frame breaks the protocol: the relay closes with 1002.
    got = Buffer.alloc(0);
    tcp.write(encodeFrame(0x1, Buffer.from('{"op":"ping"}')));
    await until(() => decodeFrame(got, 1000) !== null);
    const close = decodeFrame(got, 1000);
    expect(close.opcode).toBe(8);
    expect(close.payload.readUInt16BE(0)).toBe(1002);
    tcp.destroy();
  });

  it("closes a client that stays silent through a heartbeat", async () => {
    const r = await relay({ heartbeatMs: 40 });
    const tcp = connect(r.port, "127.0.0.1");
    let closed = false;
    tcp.on("close", () => (closed = true));
    tcp.on("data", () => {});
    await new Promise((resolve) => tcp.once("connect", resolve));
    tcp.write(
      "GET /rooms HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n",
    );
    // It never answers the pings, so two beats later it's gone.
    await until(() => closed, 2000);
    await until(() => r.rooms.stats().connections === 0);
  });

  it("carries a Gomoku game between two boards, and a board that drops comes back", async () => {
    const r = await relay();
    /** One board: the example's own relay client and match on a real WebSocket. */
    const board = (player) => {
      const out = { view: null, saved: null };
      let match;
      const conn = createRelay({ url: r.url, WebSocket, onEvent: (e) => match.relayEvent(e) });
      match = createMatch({
        relay: conn,
        player,
        onChange: (v) => (out.view = v),
        onSave: (s) => (out.saved = s),
        onNotice: () => {},
      });
      return Object.assign(out, { match, conn });
    };
    const ada = board("p-ada");
    let bo = board("p-bo");
    ada.match.create("Ada");
    await until(() => ada.view?.phase === "waiting");
    bo.match.join(ada.view.room, "Bo");
    await until(() => ada.view.phase === "playing" && bo.view?.phase === "playing");
    expect(ada.view.color).toBe("black");

    // Black plays across row 3, white answers on row 10, until five in a row.
    for (let i = 0; i < 5; i++) {
      expect(ada.match.play(3 + i, 3)).toBe(true);
      // Black's fifth stone ends the game, so nobody has a turn after it.
      if (i === 4) break;
      await until(() => bo.view.myTurn);
      if (i === 2) {
        // Bo's page closes and opens again from what it kept, mid-game.
        const kept = structuredClone(bo.saved);
        bo.conn.close();
        await until(() => ada.view.opponent.here === false);
        const again = board("p-bo");
        again.match.resume(kept);
        await until(() => again.view?.phase === "playing" && again.view.myTurn);
        bo = again;
      }
      expect(bo.match.play(3 + i, 10)).toBe(true);
      await until(() => ada.view.myTurn);
    }
    await until(() => ada.view.phase === "over" && bo.view.phase === "over");
    expect(ada.view.result.winner).toBe("black");
    expect(bo.view.result.winner).toBe("black");
    ada.conn.close();
    bo.conn.close();
  });
});

describe("the command", () => {
  it("takes its options from flags first, then the environment", () => {
    const o = optionsFrom(["--port", "9000", "--path", "/play"], {
      HOST: "0.0.0.0",
      PORT: "1",
      ALLOW_ORIGINS: "tilefold://page, https://a.example",
    });
    expect(o).toMatchObject({ port: 9000, host: "0.0.0.0", path: "/play" });
    expect(o.allowOrigin("https://a.example")).toBe(true);
    expect(o.allowOrigin("https://b.example")).toBe(false);
    const d = optionsFrom([], {});
    expect(d).toMatchObject({ port: 8787, host: "127.0.0.1", path: "/rooms" });
    expect(d.allowOrigin("anything")).toBe(true);
  });

  it("writes each activity line as one JSON object", () => {
    const line = logLine("created", { app: "gomoku" }, () => Date.UTC(2026, 9, 28));
    expect(JSON.parse(line)).toEqual({
      ts: "2026-10-28T00:00:00.000Z",
      action: "created",
      app: "gomoku",
    });
  });
});
