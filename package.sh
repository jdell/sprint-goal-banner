#!/usr/bin/env bash
# Build the Chrome Web Store upload zip containing only the runtime files.
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(grep -o '"version"[^,]*' manifest.json | grep -o '[0-9][0-9.]*')
OUT="sprint-goal-banner-${VERSION}.zip"

# Build in a temp dir first — some synced/mounted filesystems reject zip's
# in-place atomic replace — then copy the finished archive into place.
TMP="$(mktemp -d)"
zip -r "${TMP}/${OUT}" \
  manifest.json \
  content.js \
  popup.html \
  popup.js \
  icons \
  -x '*.DS_Store'

cp "${TMP}/${OUT}" "./${OUT}"
rm -rf "$TMP"

echo "Built $OUT"
unzip -l "$OUT"
