# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Web View (example tile): English strings.
#
# Modified 2026-10-18 (renamed): Web Preview is now Web View.
#
# Modified 2026-10-19 (port ranges): the address setting mentions ranges.
#
# Last updated by: Tilefold

tile-name = Web View (example)
tile-description = Shows the web app you're building, such as localhost:5173, in a browser window next to your panes, and lists the pages you opened recently.
setting-address = Ports on localhost to open, separated by commas: each opens localhost:PORT in a page of its own (5173, 3000). A range such as 3000-3010 opens every port in it. Full addresses such as staging.example.com work too.
setting-docked = Show beside the panes (off: in a window of its own)
setting-panel = Show recent pages beside the panes
cmd-open = Web View: Open
cmd-move = Web View: Beside the panes or in a window
cmd-reload = Web View: Reload
cmd-back = Web View: Back
cmd-forward = Web View: Forward
cmd-close = Web View: Close
cmd-clear = Web View: Forget recent pages
panel-title = Web View
panel-subtitle = Recent pages
recent-cleared = Recent pages forgotten.
error-no-browser = This Tilefold can't open a browser for tiles yet. Update Tilefold to use Web View.
error-refused = Web View couldn't open that: { $reason }
error-failed = Something went wrong with the preview window. Try again.
error-one-page = This Tilefold shows one page at a time, so Web View opened only the first address. Update Tilefold to open them all.
