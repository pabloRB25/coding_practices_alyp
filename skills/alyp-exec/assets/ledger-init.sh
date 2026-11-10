#!/bin/sh
# ledger-init.sh — crea el ledger de una corrida de alyp-exec.
# Uso: sh ledger-init.sh <slug> [directorio-base]
# El ledger es la memoria de trabajo del orquestador (R3): sobrevive a la
# compactación, al /clear y al día siguiente. La ventana es caché descartable.
set -eu

SLUG="${1:-}"
BASE="${2:-.claude/run}"

if [ -z "$SLUG" ]; then
  echo "uso: sh ledger-init.sh <slug> [directorio-base]" >&2
  exit 2
fi

RUN="$BASE/$SLUG"

if [ -d "$RUN" ]; then
  echo "· ledger ya existe: $RUN (no se toca — usá su estado.md para reanudar)"
  exit 0
fi

mkdir -p "$RUN/contratos" "$RUN/reportes" "$RUN/gates"

cat > "$RUN/estado.md" <<'EOF'
# Estado de la corrida

Una línea por tarea. Esta es la ÚNICA vista del orquestador sobre la corrida:
los reportes completos viven en `reportes/` y NO se releen en bloque (R1).

Estados: `pendiente` · `en-ola-N` · `gate-rojo` · `aceptada` · `bloqueada`

| id | estado | riesgo | ola | nota |
|---|---|---|---|---|
EOF

# Registra la corrida en el índice global (~/.claude/run-index/) para que el
# mod agent-steps la vea desde cualquier proyecto. Un fallo acá no frena la corrida.
sh "$(dirname "$0")/progreso.sh" --registrar "$RUN" || echo "· no se pudo registrar en el índice global (sigue igual)" >&2

echo "✓ ledger creado en $RUN"
echo "  estado.md    ← tu única vista"
echo "  contratos/   ← los contratos emitidos"
echo "  reportes/    ← reportes completos (no releer en bloque)"
echo "  gates/       ← salida de G1/G2/G3 por ola"
echo "  progreso.json ← lo escribe progreso.sh en cada F5 (references/progreso.md)"
