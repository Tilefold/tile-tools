# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Service Status (example tile): Japanese strings.

tile-name = サービス状況（サンプル）
tile-description = GitHub の公開ステータスページを確認し、問題があれば知らせます。タイルが tf.net.fetch でインターネットに接続する方法を示します。
setting-every = 自動で確認
setting-every-off = 頼んだときだけ
setting-every-quarter = 15 分ごと
setting-every-hour = 1 時間ごと
cmd-check = サービス状況: 今すぐ GitHub を確認
status-none = GitHub: すべてのシステムが正常です。
status-minor = GitHub: 軽微な問題（{ $description }）。
status-major = GitHub: 大規模な障害（{ $description }）。
status-critical = GitHub: 重大な障害（{ $description }）。
status-unknown = GitHub の発表: { $description }
error-no-network = この Tilefold ではまだタイルがインターネットを使えません。サービス状況を使うには Tilefold を更新してください。
error-denied = サービス状況は www.githubstatus.com への接続を許可されていません。設定 → タイルで許可してください。
error-rate = 確認が多すぎます。1 分後にもう一度お試しください。
error-failed = GitHub のステータスページに接続できませんでした。後でもう一度お試しください。
error-bad-answer = GitHub のステータスページから、サービス状況が理解できない応答が届きました。
