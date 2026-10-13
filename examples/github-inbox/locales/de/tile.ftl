# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# GitHub Inbox (example tile): German strings.

tile-name = GitHub-Posteingang (Beispiel)
tile-description = Zählt deine ungelesenen GitHub-Benachrichtigungen mit einem Token, den du eingibst. Zeigt, wie ein Tile einen API-Schlüssel nutzt, den es nie sieht.
setting-participating = Nur Threads, an denen ich beteiligt bin
cmd-check = GitHub-Posteingang: Benachrichtigungen prüfen
inbox-none = Keine ungelesenen GitHub-Benachrichtigungen.
inbox-some = { $count } ungelesene GitHub-Benachrichtigungen. Neueste: { $title }
inbox-many = { $count } oder mehr ungelesene GitHub-Benachrichtigungen. Neueste: { $title }
error-no-network = Dieses Tilefold lässt Tiles noch nicht ins Internet. Aktualisiere Tilefold, um GitHub-Posteingang zu nutzen.
error-no-token = Füge unter Schlüssel auf der Karte von GitHub-Posteingang in Einstellungen → Tiles einen GitHub-Token hinzu.
error-token = GitHub hat den Token abgelehnt. Prüfe, ob er den Bereich notifications hat und nicht abgelaufen ist, und ersetze ihn in Einstellungen → Tiles.
error-keychain = Tilefold konnte den Token nicht aus dem Schlüsselbund lesen. Gib ihn in Einstellungen → Tiles erneut ein.
error-denied = GitHub-Posteingang darf api.github.com nicht erreichen. Erlaube es unter Einstellungen → Tiles.
error-rate = Zu viele Prüfungen. Versuche es in einer Minute erneut.
error-failed = Deine GitHub-Benachrichtigungen konnten nicht gelesen werden. Versuche es später erneut.
