# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Service Status (example tile): Russian strings.

tile-name = Статус сервиса (пример)
tile-description = Проверяет публичную страницу статуса GitHub и сообщает, если что-то не так. Показывает, как тайл выходит в интернет через tf.net.fetch.
setting-every = Проверять самостоятельно
setting-every-off = Только по запросу
setting-every-quarter = Каждые 15 минут
setting-every-hour = Каждый час
cmd-check = Статус сервиса: Проверить GitHub сейчас
status-none = GitHub: все системы работают.
status-minor = GitHub: небольшие проблемы ({ $description }).
status-major = GitHub: серьёзный сбой ({ $description }).
status-critical = GitHub: критический сбой ({ $description }).
status-unknown = GitHub сообщает: { $description }
error-no-network = Этот Tilefold пока не даёт тайлам выходить в интернет. Обновите Tilefold, чтобы пользоваться «Статусом сервиса».
error-denied = «Статусу сервиса» не разрешено обращаться к www.githubstatus.com. Разрешите это в Настройки → Тайлы.
error-rate = Слишком много проверок. Повторите через минуту.
error-failed = Не удалось открыть страницу статуса GitHub. Повторите позже.
error-bad-answer = Страница статуса GitHub прислала ответ, который «Статус сервиса» не понимает.
