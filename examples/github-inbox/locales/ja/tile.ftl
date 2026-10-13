# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# GitHub Inbox (example tile): Japanese strings.

tile-name = GitHub 受信箱（サンプル）
tile-description = 入力したトークンで GitHub の未読通知を数えます。タイルが自分では見ない API キーを使う方法を示します。
setting-participating = 自分が参加しているスレッドだけ
cmd-check = GitHub 受信箱: 通知を確認
inbox-none = GitHub の未読通知はありません。
inbox-some = GitHub の未読通知が { $count } 件あります。最新: { $title }
inbox-many = GitHub の未読通知が { $count } 件以上あります。最新: { $title }
error-no-network = この Tilefold ではまだタイルがインターネットを使えません。GitHub 受信箱を使うには Tilefold を更新してください。
error-no-token = 設定 → タイルの GitHub 受信箱のカードで、キーに GitHub トークンを追加してください。
error-token = GitHub がトークンを拒否しました。notifications スコープがあり期限切れでないことを確認し、設定 → タイルで置き換えてください。
error-keychain = Tilefold がキーチェーンからトークンを読めませんでした。設定 → タイルでもう一度入力してください。
error-denied = GitHub 受信箱は api.github.com への接続を許可されていません。設定 → タイルで許可してください。
error-rate = 確認が多すぎます。1 分後にもう一度お試しください。
error-failed = GitHub の通知を読めませんでした。後でもう一度お試しください。
