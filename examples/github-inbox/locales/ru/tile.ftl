# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# GitHub Inbox (example tile): Russian strings.

tile-name = Входящие GitHub (пример)
tile-description = Считает непрочитанные уведомления GitHub с помощью токена, который вы вводите. Показывает, как тайл пользуется ключом API, которого никогда не видит.
setting-participating = Только обсуждения с моим участием
cmd-check = Входящие GitHub: Проверить уведомления
inbox-none = Непрочитанных уведомлений GitHub нет.
inbox-some = Непрочитанных уведомлений GitHub: { $count }. Последнее: { $title }
inbox-many = Непрочитанных уведомлений GitHub: { $count } или больше. Последнее: { $title }
error-no-network = Этот Tilefold пока не даёт тайлам выходить в интернет. Обновите Tilefold, чтобы пользоваться «Входящими GitHub».
error-no-token = Добавьте токен GitHub в разделе «Ключи» на карточке «Входящие GitHub» в Настройки → Тайлы.
error-token = GitHub отклонил токен. Проверьте, что у него есть область notifications и срок не истёк, и замените его в Настройки → Тайлы.
error-keychain = Tilefold не смог прочитать токен из связки ключей. Введите его снова в Настройки → Тайлы.
error-denied = «Входящим GitHub» не разрешено обращаться к api.github.com. Разрешите это в Настройки → Тайлы.
error-rate = Слишком много проверок. Повторите через минуту.
error-failed = Не удалось прочитать уведомления GitHub. Повторите позже.
