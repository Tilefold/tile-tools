/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Refused requests
 *
 * When Tilefold refuses Tuneboard's requests (the user hasn't allowed
 * Spotify's host, or a request breaks Tilefold's rules), nothing reached
 * Spotify: the card says Tuneboard may not reach Spotify and where to allow
 * it, never "Spotify didn't answer" or "update Tilefold", and it checks only
 * now and then, coming back to normal once requests go through again.
 */
import { describe, expect, it } from "vitest";
import { svgOf } from "../../../examples/tuneboard/src/render/svg.js";
import { createSpotify } from "../../../examples/tuneboard/src/spotify/index.js";
import { runTuneboard } from "../../../examples/tuneboard/src/tile/run.js";
import {
  MAX_BACKOFF_MS,
  POLL_MS,
  createSession,
} from "../../../examples/tuneboard/src/tile/session.js";
import { registerSettings } from "../../../examples/tuneboard/src/tile/settings.js";
import { CARD_ID } from "../../../examples/tuneboard/src/tile/view.js";
import { createFakeClient } from "../support/fake-spotify.js";
import { createHost, drain } from "../support/fake-tf.js";

/** An error the way Tilefold throws it: told apart by `name`. */
const named = (name) => Object.assign(new Error(name), { name });

describe("session", () => {
  it("checks only now and then while Tilefold refuses the requests", async () => {
    const client = createFakeClient();
    const session = createSession();
    session.setClient(client);
    await session.refresh();
    client.failAll("denied");
    for (let i = 0; i < 3; i++) {
      await session.refresh();
      expect(session.status).toBe("denied");
      expect(session.nextDelay()).toBe(MAX_BACKOFF_MS);
    }
    expect(session.playback()).toBeNull();
    // Allowed again: back to normal at the next check.
    client.failAll(null);
    await session.refresh();
    expect(session.status).toBe("playing");
    expect(session.nextDelay()).toBe(POLL_MS);
  });
});

describe("the whole tile with the real Spotify client", () => {
  for (const name of ["PermissionDeniedError", "NetworkPolicyError"]) {
    it(`says where to allow it when Tilefold throws ${name}`, async () => {
      const { host, tf } = createHost({
        net: true,
        signedIn: true,
        fetch: async () => {
          throw named(name);
        },
      });
      registerSettings(tf);
      runTuneboard(tf, { createSpotify });
      await drain();
      await host.command("toggle");
      await drain();
      expect(host.requests.length).toBeGreaterThan(0);
      const svg = svgOf(host.item(CARD_ID).image);
      expect(svg).toContain("Tuneboard may not reach Spotify");
      expect(host.item(CARD_ID).label).toContain("Settings → Tiles");
      expect(svg).not.toContain("didn&apos;t answer");
      expect(host.item(CARD_ID).label).not.toContain("too old");
    });
  }
});
