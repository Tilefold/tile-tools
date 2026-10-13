# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Service Status (example tile): German strings.

tile-name = Dienststatus (Beispiel)
tile-description = Prüft die öffentliche Statusseite von GitHub und meldet, wenn etwas nicht stimmt. Zeigt, wie ein Tile mit tf.net.fetch ins Internet geht.
setting-every = Selbst prüfen
setting-every-off = Nur auf Anfrage
setting-every-quarter = Alle 15 Minuten
setting-every-hour = Jede Stunde
cmd-check = Dienststatus: GitHub jetzt prüfen
status-none = GitHub: Alle Systeme laufen.
status-minor = GitHub: kleinere Probleme ({ $description }).
status-major = GitHub: größere Störung ({ $description }).
status-critical = GitHub: kritische Störung ({ $description }).
status-unknown = GitHub meldet: { $description }
error-no-network = Dieses Tilefold lässt Tiles noch nicht ins Internet. Aktualisiere Tilefold, um Dienststatus zu nutzen.
error-denied = Dienststatus darf www.githubstatus.com nicht erreichen. Erlaube es unter Einstellungen → Tiles.
error-rate = Zu viele Prüfungen. Versuche es in einer Minute erneut.
error-failed = Die Statusseite von GitHub war nicht erreichbar. Versuche es später erneut.
error-bad-answer = Die Statusseite von GitHub hat eine Antwort geschickt, die Dienststatus nicht versteht.
