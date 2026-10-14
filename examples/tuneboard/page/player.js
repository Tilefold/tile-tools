/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard's player page
 *
 * Runs Spotify's Web Playback SDK, which turns this page into a Spotify
 * device called "Tilefold" that plays the sound itself (Spotify Premium
 * only). The sign-in comes from Tilefold (`window.tilefold.token`), only
 * because Tuneboard declares it with `"page": true`; Tilefold renews it
 * when it is due. The page tells its tile when the device is ready (with
 * its id, so the tile can move playback here), when it is gone, and when
 * Spotify's player fails, by Spotify's error kind; the tile shows the
 * message. Tilefold allows this page scripts from sdk.scdn.co only.
 */
(() => {
  const bridge = window.tilefold;
  /** Tells the tile; a refused message (the tile is off) is dropped. */
  const tell = (message) => {
    if (bridge) bridge.post(message).catch(() => {});
  };

  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new window.Spotify.Player({
      name: "Tilefold",
      volume: 0.8,
      getOAuthToken: (give) => {
        bridge.token("spotify").then(give, () => tell({ type: "error", kind: "token" }));
      },
    });
    for (const kind of [
      "initialization_error",
      "authentication_error",
      "account_error",
      "playback_error",
    ]) {
      player.addListener(kind, () => tell({ type: "error", kind }));
    }
    player.addListener("ready", ({ device_id }) => tell({ type: "ready", deviceId: device_id }));
    player.addListener("not_ready", () => tell({ type: "not-ready" }));
    bridge.onMessage((message) => {
      if (message && message.do === "disconnect") player.disconnect();
    });
    void player.connect();
  };
})();
