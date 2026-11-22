#!/bin/sh
# macOS: double-click this in Finder. Terminal opens, the folder is served on
# http://localhost, and your browser opens the kitchen. Close the Terminal window
# to stop.
#
# This is start-server.sh with the macOS browser opener. It is a copy rather than
# a call into it on purpose: each script has to work on its own, because a person
# unzipping this folder may keep one file and delete the rest.
#
# If Finder refuses to open it, right-click and choose Open once, or run
# `sh start-server.command` from a Terminal in this folder.
set -eu

cd "$(dirname "$0")"
PORT="${1:-8123}"
URL="http://localhost:${PORT}/index.html"

PY=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && \
     "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info[0] >= 3 else 1)' >/dev/null 2>&1; then
    PY="$candidate"
    break
  fi
done

if [ -z "$PY" ]; then
  echo "This needs Python 3. macOS usually ships it; if not, install it from" >&2
  echo "https://www.python.org/downloads/ or with \`brew install python3\`." >&2
  echo "Press return to close."
  read -r _ || true
  exit 1
fi

echo "BiteSizedUtilities — serving this folder to this machine only."
echo "  ${URL}"
echo "Close this window to stop."

(
  sleep 1
  open "$URL" >/dev/null 2>&1 || true
) &

exec "$PY" -m http.server "$PORT" --bind 127.0.0.1
