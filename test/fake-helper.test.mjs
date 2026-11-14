/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake helper agent tests
 *
 * The fake host checks `notifyDone` on `tf.agent.helper` and
 * `tf.agent.helperStart` as Tilefold 0.1.37 does: true or false, or left
 * out; anything else is a TypeError. The requests it keeps carry it as
 * the tile sent it.
 */
import { describe, expect, it } from "vitest";
import { addHelper } from "./fake-helper.mjs";

/** An error the tile sees with this `name`. */
const named = (name, message) => Object.assign(new Error(message), { name });

/** A fake `tf` and host with a helper agent. */
function setup() {
  const tf = { agent: {} };
  const host = {};
  addHelper(tf, host, named, true);
  return { tf, host };
}

describe("notifyDone on the fake helper", () => {
  it("takes true, false or nothing, and keeps it with the request", async () => {
    const { tf, host } = setup();
    await tf.agent.helper({ agent: "claude", question: "hi", notifyDone: true });
    await tf.agent.helper({ agent: "claude", question: "hi" });
    await tf.agent.helperStart({ agent: "claude", notifyDone: false });
    expect(host.helperAsks.map((r) => r.notifyDone)).toEqual([true, undefined]);
    expect(host.helperStarts).toEqual([{ agent: "claude", notifyDone: false }]);
  });

  it("refuses anything else, as Tilefold does", async () => {
    const { tf, host } = setup();
    for (const bad of ["yes", 1, null, {}]) {
      await expect(
        tf.agent.helper({ agent: "claude", question: "hi", notifyDone: bad }),
      ).rejects.toMatchObject({ name: "TypeError", message: "notifyDone: true or false" });
      await expect(
        tf.agent.helperStart({ agent: "claude", notifyDone: bad }),
      ).rejects.toMatchObject({ name: "TypeError", message: "notifyDone: true or false" });
    }
    expect(host.helperAsks).toEqual([]);
    expect(host.helperStarts).toEqual([]);
  });
});
