#!/bin/bash
# Chequeo semanal de instrucciones de ~/.claude. Log en ~/.claude/logs/chequeo-instrucciones.log
DIR="$(cd "$(dirname "$0")" && pwd)"
LOGDIR="$HOME/.claude/logs"; LOG="$LOGDIR/chequeo-instrucciones.log"
mkdir -p "$LOGDIR"
FECHA=$(date +%Y-%m-%dT%H:%M:%S)
fallas=()

out=$(bash "$DIR/check-claude-md.sh" "$HOME/.claude/CLAUDE.md" "$HOME/.claude/rules" 2>&1) || \
  while IFS= read -r l; do [ -n "$l" ] && fallas+=("$l (CLAUDE.md)"); done <<< "$out"

REPO="${CHEQUEO_REPO:-$HOME/Dev/alyp-studio/coding_practices_alyp}"
if command -v node >/dev/null 2>&1 && [ -f "$REPO/scripts/check-drift.mjs" ]; then
  out=$(node "$REPO/scripts/check-drift.mjs" "$HOME/.claude" 2>&1) || \
    fallas+=("FALLA: drift detectado en ~/.claude: $(printf '%s' "$out" | head -3 | tr '\n' ' ')")
else
  fallas+=("FALLA: drift no verificable (node o check-drift.mjs ausentes)")
fi

[ -e "$HOME/AGENTS.md" ] && fallas+=("FALLA: reapareció ~/AGENTS.md")

if [ ${#fallas[@]} -eq 0 ]; then
  echo "$FECHA OK" >> "$LOG"; exit 0
fi
for f in "${fallas[@]}"; do
  case "$f" in FALLA:*) echo "$FECHA $f" >> "$LOG";; *) echo "$FECHA FALLA: $f" >> "$LOG";; esac
done
if [ -z "${CHEQUEO_SIN_NOTIF:-}" ]; then
  osascript -e "display notification \"${#fallas[@]} problema(s); ver chequeo-instrucciones.log\" with title \"Chequeo de instrucciones\"" >/dev/null 2>&1
fi
exit 1
