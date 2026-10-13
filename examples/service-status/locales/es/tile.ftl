# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Service Status (example tile): Spanish strings.

tile-name = Estado del servicio (ejemplo)
tile-description = Consulta la página de estado pública de GitHub y te avisa cuando algo va mal. Muestra cómo un tile accede a internet con tf.net.fetch.
setting-every = Comprobar por sí solo
setting-every-off = Solo cuando lo pida
setting-every-quarter = Cada 15 minutos
setting-every-hour = Cada hora
cmd-check = Estado del servicio: Comprobar GitHub ahora
status-none = GitHub: todos los sistemas funcionan.
status-minor = GitHub: problemas menores ({ $description }).
status-major = GitHub: caída importante ({ $description }).
status-critical = GitHub: caída crítica ({ $description }).
status-unknown = GitHub dice: { $description }
error-no-network = Este Tilefold aún no deja que los tiles usen internet. Actualiza Tilefold para usar Estado del servicio.
error-denied = Estado del servicio no puede acceder a www.githubstatus.com. Permítelo en Ajustes → Tiles.
error-rate = Demasiadas comprobaciones. Inténtalo de nuevo en un minuto.
error-failed = No se pudo acceder a la página de estado de GitHub. Inténtalo más tarde.
error-bad-answer = La página de estado de GitHub envió una respuesta que Estado del servicio no entiende.
