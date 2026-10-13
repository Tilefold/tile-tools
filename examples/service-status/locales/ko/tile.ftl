# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Service Status (example tile): Korean strings.

tile-name = 서비스 상태(예제)
tile-description = GitHub의 공개 상태 페이지를 확인하고 문제가 있으면 알려 줍니다. 타일이 tf.net.fetch로 인터넷에 접속하는 방법을 보여 줍니다.
setting-every = 자동으로 확인
setting-every-off = 요청할 때만
setting-every-quarter = 15분마다
setting-every-hour = 1시간마다
cmd-check = 서비스 상태: 지금 GitHub 확인
status-none = GitHub: 모든 시스템이 정상입니다.
status-minor = GitHub: 사소한 문제({ $description }).
status-major = GitHub: 주요 장애({ $description }).
status-critical = GitHub: 심각한 장애({ $description }).
status-unknown = GitHub 공지: { $description }
error-no-network = 이 Tilefold에서는 아직 타일이 인터넷을 사용할 수 없습니다. 서비스 상태를 사용하려면 Tilefold를 업데이트하세요.
error-denied = 서비스 상태는 www.githubstatus.com에 접속할 수 없습니다. 설정 → 타일에서 허용하세요.
error-rate = 확인이 너무 많습니다. 1분 후에 다시 시도하세요.
error-failed = GitHub 상태 페이지에 연결할 수 없습니다. 나중에 다시 시도하세요.
error-bad-answer = GitHub 상태 페이지가 서비스 상태가 이해할 수 없는 응답을 보냈습니다.
