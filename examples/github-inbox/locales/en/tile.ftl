# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# GitHub Inbox (example tile): English strings.

tile-name = GitHub Inbox (example)
tile-description = Counts your unread GitHub notifications with a token you enter. Shows how a tile uses an API key it never sees.
setting-participating = Only threads I take part in
cmd-check = GitHub Inbox: Check notifications
inbox-none = No unread GitHub notifications.
inbox-some = { $count } unread GitHub notifications. Newest: { $title }
inbox-many = { $count } or more unread GitHub notifications. Newest: { $title }
error-no-network = This Tilefold can't let tiles use the internet yet. Update Tilefold to use GitHub Inbox.
error-no-token = Add a GitHub token under Keys on GitHub Inbox's card in Settings → Tiles.
error-token = GitHub refused the token. Check that it has the notifications scope and hasn't expired, then replace it in Settings → Tiles.
error-keychain = Tilefold couldn't read the token from the keychain. Enter it again in Settings → Tiles.
error-denied = GitHub Inbox may not reach api.github.com. Allow it in Settings → Tiles.
error-rate = Too many checks. Try again in a minute.
error-failed = Couldn't read your GitHub notifications. Try again later.
