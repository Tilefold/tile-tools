# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Service Status (example tile): Chinese (Simplified) strings.

tile-name = 服务状态（示例）
tile-description = 检查 GitHub 的公开状态页，出现问题时提醒你。演示磁贴如何用 tf.net.fetch 访问互联网。
setting-every = 自动检查
setting-every-off = 仅在我要求时
setting-every-quarter = 每 15 分钟
setting-every-hour = 每小时
cmd-check = 服务状态：立即检查 GitHub
status-none = GitHub：所有系统运行正常。
status-minor = GitHub：轻微问题（{ $description }）。
status-major = GitHub：重大故障（{ $description }）。
status-critical = GitHub：严重故障（{ $description }）。
status-unknown = GitHub 表示：{ $description }
error-no-network = 此 Tilefold 尚不允许磁贴使用互联网。请更新 Tilefold 以使用服务状态。
error-denied = 服务状态无权访问 www.githubstatus.com。请在 设置 → 磁贴 中允许。
error-rate = 检查次数过多。请一分钟后再试。
error-failed = 无法访问 GitHub 状态页。请稍后再试。
error-bad-answer = GitHub 状态页返回了服务状态无法理解的内容。
