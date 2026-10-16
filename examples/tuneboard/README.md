# Tuneboard

A Spotify now-playing card with playback and volume controls, a player inside Tilefold, and your playlists in a window.

## Setting it up

1. In Tilefold, open **Settings → Tiles**, find Tuneboard and click **Set up your own app** under **Keys**, then **Open setup page**.
2. At the Spotify developer dashboard, create an app and paste the callback address Tilefold shows as its redirect URI.
3. Paste the app's Client ID back into Tilefold and click **Sign in…**; Spotify asks you to agree in your browser.
4. Run **Tuneboard: Show or hide** from the command palette.

Controlling playback needs Spotify Premium. **Tuneboard: Play in Tilefold** plays inside Tilefold, as a device named "Tilefold"; **Tuneboard: Show playlists** opens your playlists. After updating to a version that asks for more access, sign in again.

## Moving the card

The card starts in a corner of the pane you're working in (the **Corner of the pane** setting) and moves with you when you switch panes. To keep it in one place instead, drag the card itself, not its buttons, anywhere in the window and let go:

- It stays there whichever pane is focused, and comes back there after a restart.
- Its place is kept relative to the window's edges, so a card dropped against the right edge stays against it when the window is resized.
- The playlist panel opens above the card when the card is in the lower half of the window, and below it otherwise.
- To make it follow the pane again, run **Tuneboard: Put the card back in the pane**, or choose a different corner in the settings.

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-14 by Tilefold
