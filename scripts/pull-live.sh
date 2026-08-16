#!/usr/bin/env bash
# Capture what is CURRENTLY LIVE on the domain into site/, as the first commit.
#
# Why pull from the live domain rather than from the project docs: under Netlify
# Drop the live site can drift from the working files, and nobody knows by how
# much. The honest baseline for "we now have version control" is what the domain
# is actually serving today. Diff against your working copies afterwards — that
# diff is the drift, and it is worth reading before you commit.
#
# Run once, from the repository root:   bash scripts/pull-live.sh
set -euo pipefail

BASE="${1:-https://thefindablecandidate.com}"
CB="?cb=$(date +%s)"   # cache-buster: fetch caches are 15 minutes and a stale
                       # 404 will convince you a working page is missing

echo "Pulling from ${BASE}"
mkdir -p site/file site/intake site/privacy site/terms

fetch () { # fetch <path> <destination>
  local url="${BASE}${1}${CB}" dest="$2"
  local code
  code=$(curl -sS -w '%{http_code}' -o "${dest}.tmp" "${url}")
  if [ "$code" != "200" ]; then
    echo "  ✗ ${1} → HTTP ${code} (not written)"
    rm -f "${dest}.tmp"
    return 1
  fi
  mv "${dest}.tmp" "${dest}"
  echo "  ✓ ${1} → ${dest} ($(wc -c < "${dest}") bytes)"
}

fetch "/"        site/index.html
fetch "/file/"   site/file/index.html
fetch "/intake/" site/intake/index.html
fetch "/privacy/" site/privacy/index.html
fetch "/terms/"  site/terms/index.html

cat <<'EOF'

Pulled. Now, before committing:

  1. Open each file and confirm it is the page you expect — not an error page,
     not an old revision.
  2. Diff against your working copies (the project-doc versions). Any difference
     is drift that accumulated under Drop. Decide which side is right; the repo
     is the source of truth from this commit onward.
  3. Run: node scripts/preflight.mjs
     Expect the legal pages to FAIL if the operator decisions are still open —
     that is correct, and it is the point.
EOF
