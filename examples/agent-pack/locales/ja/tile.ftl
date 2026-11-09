# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Agent Pack (example tile): Japanese strings.

tile-name = Agent Pack（サンプル）
tile-description = 好きな AI コーディングエージェントを自分のエージェントに追加します。名前とコマンドを入力するか、Grok Build、Kimi CLI、Mistral Vibe などの用意されたものを選びます。Tilefold がそれぞれを先に表示し、確認したときだけ追加します。
cmd-add-own = Agent Pack: 自分のエージェントを追加…
cmd-add-grok = Agent Pack: Grok Build を追加
cmd-add-kimi = Agent Pack: Kimi CLI を追加
cmd-add-vibe = Agent Pack: Mistral Vibe を追加
cmd-add-qwen = Agent Pack: Qwen Code を追加
cmd-add-aider = Agent Pack: Aider を追加
cmd-add-goose = Agent Pack: Goose を追加
cmd-add-crush = Agent Pack: Crush を追加
toast-added = { $name } を自分のエージェントに追加しました（設定 → エージェント）。
toast-exists = { $name } はすでに自分のエージェントです。
toast-declined = { $name } は追加されませんでした。
toast-full = 自分のエージェントがすでに 20 個あります。先に 設定 → エージェント で 1 つ削除してください。
toast-refused = Tilefold は { $name } を保存できませんでした。
toast-failed = エージェントを提案できませんでした（{ $reason }）。
toast-needs-tilefold = タイルからエージェントを追加するには、新しい Tilefold が必要です。
panel-title = Agent Pack
own-section = 自分のエージェントを追加
own-name-field = エージェント名
own-name-placeholder = 名前を入力して Enter（例: 仕事用 Gemini）
own-command-field = コマンド
own-command-placeholder = コマンドを入力して Enter（例: gemini --model pro）
own-name-now = 名前: { $name }
own-name-unset = 名前: まだ未設定
own-command-now = コマンド: { $command }
own-command-unset = コマンド: まだ未設定
own-clear = コンテキストのクリア: { $how }
own-clear-none = なし
own-clear-hint = クリックで /clear、/new、なし を切り替え
own-add = このエージェントを追加…
own-add-hint = 先に名前とコマンドを入力してください
own-start-over = 最初からやり直す
own-problem-name-empty = エージェントの名前を入力してください。
own-problem-name = 名前は 1 行で 60 文字までです。
own-problem-command-empty = エージェントを起動するコマンドを入力してください。
own-problem-command-long = コマンドはプログラム名のあとに 16 語までです。
own-problem-command-chars = コマンドには英数字と . _ , : = @ % + / ~ - だけを使ってください。
ready-section = 用意されたエージェント
ready-hint = クリックしてこのエージェントを追加
