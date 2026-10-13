# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Service Status (example tile): Italian strings.

tile-name = Stato del servizio (esempio)
tile-description = Controlla la pagina di stato pubblica di GitHub e ti avvisa quando qualcosa non va. Mostra come un tile accede a internet con tf.net.fetch.
setting-every = Controlla da solo
setting-every-off = Solo quando lo chiedo
setting-every-quarter = Ogni 15 minuti
setting-every-hour = Ogni ora
cmd-check = Stato del servizio: Controlla GitHub ora
status-none = GitHub: tutti i sistemi funzionano.
status-minor = GitHub: problemi minori ({ $description }).
status-major = GitHub: interruzione grave ({ $description }).
status-critical = GitHub: interruzione critica ({ $description }).
status-unknown = GitHub dice: { $description }
error-no-network = Questo Tilefold non permette ancora ai tile di usare internet. Aggiorna Tilefold per usare Stato del servizio.
error-denied = Stato del servizio non può raggiungere www.githubstatus.com. Consentilo in Impostazioni → Tile.
error-rate = Troppi controlli. Riprova tra un minuto.
error-failed = Impossibile raggiungere la pagina di stato di GitHub. Riprova più tardi.
error-bad-answer = La pagina di stato di GitHub ha inviato una risposta che Stato del servizio non capisce.
