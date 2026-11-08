# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Agent Pack (example tile): Russian strings.

tile-name = Agent Pack (пример)
tile-description = Добавляет в ваши агенты любой ИИ-агент для программирования: введите его имя и команду или выберите готовый, например Grok Build, Kimi CLI или Mistral Vibe. Tilefold сначала показывает каждый и добавляет его, только когда вы подтвердите.
cmd-add-own = Agent Pack: Добавить свой агент…
cmd-add-grok = Agent Pack: добавить Grok Build
cmd-add-kimi = Agent Pack: добавить Kimi CLI
cmd-add-vibe = Agent Pack: добавить Mistral Vibe
cmd-add-qwen = Agent Pack: добавить Qwen Code
cmd-add-aider = Agent Pack: добавить Aider
cmd-add-goose = Agent Pack: добавить Goose
cmd-add-crush = Agent Pack: добавить Crush
toast-added = { $name } добавлен к вашим агентам (Настройки → Агенты).
toast-exists = { $name } уже есть среди ваших агентов.
toast-declined = { $name } не добавлен.
toast-full = У вас уже 20 своих агентов; сначала удалите одного в Настройках → Агенты.
toast-refused = Tilefold не удалось сохранить { $name }.
toast-failed = Не удалось предложить агента ({ $reason }).
toast-needs-tilefold = Чтобы добавлять агентов из плитки, нужен более новый Tilefold.
panel-title = Agent Pack
own-section = Добавить свой агент
own-name-field = Имя агента
own-name-placeholder = Имя, затем Enter (например, Gemini для работы)
own-command-field = Команда
own-command-placeholder = Команда, затем Enter (например, gemini --model pro)
own-name-now = Имя: { $name }
own-name-unset = Имя: ещё не задано
own-command-now = Команда: { $command }
own-command-unset = Команда: ещё не задана
own-clear = Очищает контекст командой: { $how }
own-clear-none = ничем
own-clear-hint = Нажмите, чтобы переключать /clear, /new и «ничем»
own-add = Добавить этот агент…
own-add-hint = Сначала введите имя и команду
own-start-over = Начать заново
own-problem-name-empty = Введите имя агента.
own-problem-name = Имя — не больше 60 символов, в одну строку.
own-problem-command-empty = Введите команду, которая запускает агента.
own-problem-command-long = В команде может быть не больше 16 слов после программы.
own-problem-command-chars = Используйте в команде только буквы, цифры и . _ , : = @ % + / ~ -.
ready-section = Готовые
ready-hint = Нажмите, чтобы добавить этого агента
