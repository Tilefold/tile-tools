# Pipeline Board

The latest CI pipelines of a GitLab project, on a card above your panes.

## Setting it up

1. In Tilefold, open **Settings → Tiles**, find Pipeline Board and click **Set up your own app** under **Keys**, then **Open setup page**.
2. In GitLab, add an application: paste the callback address Tilefold shows as the redirect URI, untick **Confidential**, tick only the `read_api` scope, and save.
3. Paste the **Application ID** back into Tilefold and click **Sign in…**; GitLab asks you to authorize it in your browser.
4. Set **GitLab project** in the tile's settings and run **Pipeline Board: Show or hide**.

It reads gitlab.com. For a self-managed GitLab, copy the tile and change the addresses in its `tile.json` (`auth.gitlab` and the `net:` permission).

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-14 by Tilefold
