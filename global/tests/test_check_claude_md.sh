#!/bin/bash
# Oráculo de check-claude-md.sh: 5 casos.
D="$(cd "$(dirname "$0")" && pwd)"; CHECK="$D/../scripts/check-claude-md.sh"
[ -f "$CHECK" ] || { echo "FALLA: no existe $CHECK"; exit 1; }
REAL="${CHECK_FIXTURE_REAL:-$HOME/.claude/backups/2026-11-poda/CLAUDE.md}"
ok=0; total=0
espera() { # nombre exit_esperado texto_esperado(o vacío) -- args...
  local n=$1 e=$2 t=$3; shift 4; total=$((total+1))
  out=$(bash "$CHECK" "$@" 2>&1); rc=$?
  if [ "$rc" -eq "$e" ] && { [ -z "$t" ] || printf '%s' "$out" | grep -qF "$t"; }; then ok=$((ok+1))
  else echo "FALLA $n: rc=$rc (esperado $e)"; printf '%s\n' "$out" | head -5; fi
}
espera actual_viejo 1 "" -- "$REAL"
espera comentario_abierto 1 "comentarios HTML desbalanceados" -- "$D/fixtures/comentario-abierto.md"
espera valido 0 "OK" -- "$D/fixtures/valido/CLAUDE.md" "$D/fixtures/valido/rules"
espera comentario_inline 1 "REGLA DURA" -- "$D/fixtures/inline/CLAUDE.md" "$D/fixtures/valido/rules"
espera regla_sin_paths 1 "paths" -- "$D/fixtures/valido/CLAUDE.md" "$D/fixtures/sin-paths/rules"
echo "$ok/$total OK"
[ "$ok" -eq "$total" ]
