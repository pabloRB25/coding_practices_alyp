#!/bin/sh
# progreso.sh — escribe el progreso de una corrida de alyp-exec y la registra
# en el índice global, para que el mod agent-steps la muestre desde cualquier
# proyecto y ventana. Contrato: references/progreso.md.
#
# Uso:
#   sh progreso.sh <ledger> --total N --aceptadas N [--en-curso N] [--bloqueadas N]
#                  [--ola X] [--tarea "texto"] [--titulo "texto"]
#   sh progreso.sh --registrar <ledger>      # solo el puntero (lo usa ledger-init)
#
# <ledger> es la carpeta .claude/run/<slug>. Los conteos los decide el
# orquestador al cerrar cada ola (F5): el script no los deduce de estado.md,
# porque deducirlos es justo lo que hacía que dos lectores dieran dos números.
set -eu

err() { echo "progreso.sh: $*" >&2; exit 2; }

# Texto -> literal JSON: escapa \ y ", y cambia saltos y tabs por espacios.
json_str() {
  printf '%s' "$1" | tr '\n\r\t' '   ' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

es_entero() { case "$1" in ''|*[!0-9]*) return 1 ;; *) return 0 ;; esac; }

ahora() { date -u +%Y-%m-%dT%H:%M:%SZ; }

abs_dir() { (cd "$1" && pwd -P); }

repo_de() { git -C "$1" rev-parse --show-toplevel 2>/dev/null || abs_dir "$1"; }

indice_dir() { echo "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/run-index"; }

# Escribe el puntero <indice>/<cksum de la ruta>.json. Un archivo por corrida:
# dos sesiones que registran a la vez no se pisan.
registrar() {
  ledger=$(abs_dir "$1")
  slug=$(basename "$ledger")
  repo=$(repo_de "$ledger")
  dir=$(indice_dir)
  mkdir -p "$dir"
  clave=$(printf '%s' "$ledger" | cksum | cut -d' ' -f1)
  tmp="$dir/.$clave.$$"
  printf '{"version":1,"ledger":"%s","slug":"%s","repo":"%s","actualizado":"%s"}\n' \
    "$(json_str "$ledger")" "$(json_str "$slug")" "$(json_str "$repo")" "$(ahora)" >"$tmp"
  mv "$tmp" "$dir/$clave.json"
}

if [ "${1:-}" = "--registrar" ]; then
  [ -n "${2:-}" ] && [ -d "$2" ] || err "uso: sh progreso.sh --registrar <ledger>"
  registrar "$2"
  exit 0
fi

LEDGER="${1:-}"
[ -n "$LEDGER" ] && [ -d "$LEDGER" ] || err "uso: sh progreso.sh <ledger> --total N --aceptadas N [...] (el ledger debe existir)"
shift

TOTAL='' ACEPTADAS='' EN_CURSO=0 BLOQUEADAS=0 OLA='' TAREA='' TITULO=''
while [ $# -gt 0 ]; do
  [ $# -ge 2 ] || err "falta el valor de $1"
  case "$1" in
    --total) TOTAL=$2 ;;
    --aceptadas) ACEPTADAS=$2 ;;
    --en-curso) EN_CURSO=$2 ;;
    --bloqueadas) BLOQUEADAS=$2 ;;
    --ola) OLA=$2 ;;
    --tarea) TAREA=$2 ;;
    --titulo) TITULO=$2 ;;
    *) err "opción desconocida: $1" ;;
  esac
  shift 2
done

for par in "total:$TOTAL" "aceptadas:$ACEPTADAS" "en-curso:$EN_CURSO" "bloqueadas:$BLOQUEADAS"; do
  es_entero "${par#*:}" || err "--${par%%:*} debe ser un entero >= 0 (vino '${par#*:}')"
done
[ "$TOTAL" -gt 0 ] || err "--total debe ser mayor que 0"
SUMA=$((ACEPTADAS + EN_CURSO + BLOQUEADAS))
[ "$SUMA" -le "$TOTAL" ] || err "aceptadas + en-curso + bloqueadas ($SUMA) supera el total ($TOTAL)"

ABS=$(abs_dir "$LEDGER")
TMP="$ABS/.progreso.json.$$"
printf '{"version":1,"plan":"%s","titulo":"%s","repo":"%s","total":%s,"aceptadas":%s,"en_curso":%s,"bloqueadas":%s,"ola":"%s","tarea_actual":"%s","actualizado":"%s"}\n' \
  "$(json_str "$(basename "$ABS")")" "$(json_str "$TITULO")" "$(json_str "$(repo_de "$ABS")")" \
  "$TOTAL" "$ACEPTADAS" "$EN_CURSO" "$BLOQUEADAS" \
  "$(json_str "$OLA")" "$(json_str "$TAREA")" "$(ahora)" >"$TMP"
mv "$TMP" "$ABS/progreso.json"
registrar "$ABS"

echo "✓ progreso: $ACEPTADAS/$TOTAL aceptadas ($((100 * ACEPTADAS / TOTAL))%) · ola ${OLA:-—} → $ABS/progreso.json"
