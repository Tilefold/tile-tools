# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Service Status (example tile): French strings.

tile-name = État du service (exemple)
tile-description = Consulte la page d'état publique de GitHub et vous prévient quand quelque chose ne va pas. Montre comment un tile accède à internet avec tf.net.fetch.
setting-every = Vérifier tout seul
setting-every-off = Seulement quand je le demande
setting-every-quarter = Toutes les 15 minutes
setting-every-hour = Toutes les heures
cmd-check = État du service : Vérifier GitHub maintenant
status-none = GitHub : tous les systèmes fonctionnent.
status-minor = GitHub : problèmes mineurs ({ $description }).
status-major = GitHub : panne majeure ({ $description }).
status-critical = GitHub : panne critique ({ $description }).
status-unknown = GitHub indique : { $description }
error-no-network = Ce Tilefold ne permet pas encore aux tiles d'utiliser internet. Mettez Tilefold à jour pour utiliser État du service.
error-denied = État du service n'a pas le droit de joindre www.githubstatus.com. Autorisez-le dans Réglages → Tiles.
error-rate = Trop de vérifications. Réessayez dans une minute.
error-failed = Impossible de joindre la page d'état de GitHub. Réessayez plus tard.
error-bad-answer = La page d'état de GitHub a envoyé une réponse qu'État du service ne comprend pas.
