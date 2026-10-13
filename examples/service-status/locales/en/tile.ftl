# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Service Status (example tile): English strings.

tile-name = Service Status (example)
tile-description = Checks GitHub's public status page and tells you when something is wrong. Shows how a tile reaches the internet with tf.net.fetch.
setting-every = Check by itself
setting-every-off = Only when I ask
setting-every-quarter = Every 15 minutes
setting-every-hour = Every hour
cmd-check = Service Status: Check GitHub now
status-none = GitHub: all systems operational.
status-minor = GitHub: minor problems ({ $description }).
status-major = GitHub: major outage ({ $description }).
status-critical = GitHub: critical outage ({ $description }).
status-unknown = GitHub says: { $description }
error-no-network = This Tilefold can't let tiles use the internet yet. Update Tilefold to use Service Status.
error-denied = Service Status may not reach www.githubstatus.com. Allow it in Settings → Tiles.
error-rate = Too many checks. Try again in a minute.
error-failed = Couldn't reach GitHub's status page. Try again later.
error-bad-answer = GitHub's status page sent an answer Service Status doesn't understand.
