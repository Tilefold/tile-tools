# GitHub Inbox

Your unread GitHub notifications, counted on demand or on an interval.

## Setting it up

1. On github.com, open **Settings → Developer settings → Personal access tokens** and create a classic token with only the `notifications` scope.
2. In Tilefold, open **Settings → Tiles**, find GitHub Inbox and paste the token under **Keys**, then click **Save**.
3. Run **GitHub Inbox: Check notifications** from the command palette.

Tilefold keeps the token in your keychain and adds it to the tile's requests to api.github.com; the tile itself only learns that a token is there.

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-14 by Tilefold
