#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-$HOME/.claude}"
rc=0
for d in "$REPO_DIR"/skills/*/; do
  s="$(basename "$d")"
  inst="$TARGET/skills/$s"
  if [[ -L "$inst" ]]; then continue; fi
  if [[ ! -d "$inst" ]]; then echo "FALTA: $s no instalado"; rc=1; continue; fi
  if ! diff -rq "$d" "$inst" >/dev/null 2>&1; then
    echo "DRIFT: $s difiere entre repo e instalado:"
    diff -rq "$d" "$inst" | head -10
    rc=1
  fi
done
exit $rc
