#!/bin/sh
# Serve this folder over http://localhost so the whole site can run.
#
# A browser refuses an ES module, a worker, and a page that opens another page
# when all of them come off the disk over file:. Serving the folder removes all
# three refusals at once. Nothing here touches the internet: python's http.server
# answers requests from this machine out of this directory and that is all.
#
# Usage:  sh start-server.sh [port]
set -eu

cd "$(dirname "$0")"
PORT="${1:-8123}"
URL="http://localhost:${PORT}/index.html"

# Python 3 specifically: Python 2 has no http.server, and failing there would
# look like a broken download rather than a missing dependency.
PY=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && \
     "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info[0] >= 3 else 1)' >/dev/null 2>&1; then
    PY="$candidate"
    break
  fi
done

if [ -z "$PY" ]; then
  echo "This needs Python 3, and none was found on the PATH." >&2
  echo "Install it (https://www.python.org/downloads/) and run this again." >&2
  exit 1
fi

echo "BiteSizedUtilities — serving this folder to this machine only."
echo "  ${URL}"
echo "Press Ctrl+C to stop."

# Open the browser a moment later, once the server is actually listening.
(
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true; fi
) &

# --bind 127.0.0.1 so the folder is not readable by everything on the network.
exec "$PY" -m http.server "$PORT" --bind 127.0.0.1
