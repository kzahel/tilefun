#!/bin/sh
set -eu
# Steam's overlay preload prevents this Chromium runtime from starting reliably.
unset LD_PRELOAD
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
mkdir -p "${XDG_STATE_HOME:-$HOME/.local/state}/tilefun"
exec "$HERE/tilefun" --fullscreen --ozone-platform=x11 --touch-events=enabled "$@" >>"${XDG_STATE_HOME:-$HOME/.local/state}/tilefun/launch.log" 2>&1
