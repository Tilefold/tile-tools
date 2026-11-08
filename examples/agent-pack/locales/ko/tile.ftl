# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Agent Pack (example tile): Korean strings.

tile-name = Agent Pack (예제)
tile-description = 원하는 AI 코딩 에이전트를 내 에이전트에 추가합니다. 이름과 명령을 입력하거나 Grok Build, Kimi CLI, Mistral Vibe 같은 준비된 에이전트를 고르세요. Tilefold가 각각을 먼저 보여 주고, 확인할 때만 추가합니다.
cmd-add-own = Agent Pack: 내 에이전트 추가…
cmd-add-grok = Agent Pack: Grok Build 추가
cmd-add-kimi = Agent Pack: Kimi CLI 추가
cmd-add-vibe = Agent Pack: Mistral Vibe 추가
cmd-add-qwen = Agent Pack: Qwen Code 추가
cmd-add-aider = Agent Pack: Aider 추가
cmd-add-goose = Agent Pack: Goose 추가
cmd-add-crush = Agent Pack: Crush 추가
toast-added = { $name }을(를) 내 에이전트에 추가했습니다 (설정 → 에이전트).
toast-exists = { $name }은(는) 이미 내 에이전트입니다.
toast-declined = { $name }을(를) 추가하지 않았습니다.
toast-full = 내 에이전트가 이미 20개입니다. 먼저 설정 → 에이전트에서 하나를 제거하세요.
toast-refused = Tilefold가 { $name }을(를) 저장하지 못했습니다.
toast-failed = 에이전트를 제안하지 못했습니다 ({ $reason }).
toast-needs-tilefold = 타일에서 에이전트를 추가하려면 더 새로운 Tilefold가 필요합니다.
panel-title = Agent Pack
own-section = 내 에이전트 추가
own-name-field = 에이전트 이름
own-name-placeholder = 이름 입력 후 Enter (예: 업무용 Gemini)
own-command-field = 명령
own-command-placeholder = 명령 입력 후 Enter (예: gemini --model pro)
own-name-now = 이름: { $name }
own-name-unset = 이름: 아직 설정 안 됨
own-command-now = 명령: { $command }
own-command-unset = 명령: 아직 설정 안 됨
own-clear = 컨텍스트 지우기: { $how }
own-clear-none = 없음
own-clear-hint = 클릭하면 /clear, /new, 없음 사이에서 바뀝니다
own-add = 이 에이전트 추가…
own-add-hint = 먼저 이름과 명령을 입력하세요
own-start-over = 처음부터 다시
own-problem-name-empty = 에이전트 이름을 입력하세요.
own-problem-name = 이름은 한 줄로 60자까지입니다.
own-problem-command-empty = 에이전트를 시작하는 명령을 입력하세요.
own-problem-command-long = 명령은 프로그램 뒤에 16단어까지입니다.
own-problem-command-chars = 명령에는 영문자, 숫자와 . _ , : = @ % + / ~ - 만 쓰세요.
ready-section = 준비된 에이전트
ready-hint = 클릭해서 이 에이전트 추가
