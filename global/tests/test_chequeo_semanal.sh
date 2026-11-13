#!/bin/bash
# Oráculo de chequeo-semanal.sh: 2 casos de falla con mensaje en el log.
D="$(cd "$(dirname "$0")" && pwd)"; S="$D/../scripts/chequeo-semanal.sh"
[ -f "$S" ] || { echo "FALLA: no existe $S"; exit 1; }
ok=0; total=0
corre() { # nombre texto_en_log prepara_fn
  total=$((total+1)); local h; h=$(mktemp -d); mkdir -p "$h/.claude/rules"
  printf '# x\nREGLA DURA\n' > "$h/.claude/CLAUDE.md"; "$3" "$h"
  HOME="$h" CHEQUEO_SIN_NOTIF=1 bash "$S" >/dev/null 2>&1; rc=$?
  log="$h/.claude/logs/chequeo-instrucciones.log"
  if [ "$rc" -eq 1 ] && grep -q "FALLA" "$log" 2>/dev/null && grep -q "$2" "$log"; then ok=$((ok+1))
  else echo "FALLA $1: rc=$rc"; cat "$log" 2>/dev/null | head -5; fi
  rm -rf "$h"
}
nada() { :; }
con_agents() { echo x > "$1/AGENTS.md"; }
corre claude_invalido "CLAUDE.md" nada
corre agents_reaparecio "AGENTS.md" con_agents
echo "$ok/$total OK"
[ "$ok" -eq "$total" ]
