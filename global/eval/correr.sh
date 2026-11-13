#!/usr/bin/env bash
# Uso: correr.sh <antes|despues> [--imprimir]
set -u
FASE="${1:-}"; MODO="${2:-}"
[[ "$FASE" == "antes" || "$FASE" == "despues" ]] || { echo "uso: correr.sh <antes|despues> [--imprimir]" >&2; exit 2; }
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="/Users/parb/Dev/alyp-studio/nomi_v3"
OUT="$AQUI/resultados/$FASE"
EVAL_MODEL="${EVAL_MODEL:-sonnet}"
EVAL_BUDGET="${EVAL_BUDGET:-0.80}"
EVAL_REPS="${EVAL_REPS:-1}"

# Emite "id<TAB>max_turns<TAB>prompt" por tarea (JSON válido dentro de tareas.yaml).
tareas() {
  python3 -c '
import json,sys
for t in json.load(open(sys.argv[1])):
    print("%s\t%s\t%s" % (t["id"], t["max_turns"], t["prompt"].replace("\t"," ")))
' "$AQUI/tareas.yaml"
}

comando() { # id turns prompt rep
  printf 'claude -p %q --model %q --output-format stream-json --verbose --max-budget-usd %s --max-turns %s --allowedTools "Read Grep Glob Bash Skill" < /dev/null > %q\n' \
    "$3" "$EVAL_MODEL" "$EVAL_BUDGET" "$2" "$OUT/$1-$4.jsonl"
}

if [[ "$MODO" == "--imprimir" ]]; then
  while IFS=$'\t' read -r id turns prompt; do
    for rep in $(seq 1 "$EVAL_REPS"); do comando "$id" "$turns" "$prompt" "$rep"; done
  done < <(tareas)
  exit 0
fi

TMP="$(mktemp -d)"
limpiar() { git -C "$REPO" worktree remove --force "$TMP/nomi" >/dev/null 2>&1; rm -rf "$TMP"; }
trap limpiar EXIT

mkdir -p "$OUT"
git -C "$REPO" worktree add --detach "$TMP/nomi" HEAD || exit 1
mkdir -p "$TMP/nomi/docs"
cat > "$TMP/nomi/docs/plan.md" <<'PLAN'
# Plan dummy
1. T1: agregar helper `sumar` en utils con test.
2. T2: renombrar variable `foo` a `bar` en un módulo.
3. T3: documentar `sumar` en el README.
PLAN

cd "$TMP/nomi" || exit 1
while IFS=$'\t' read -r id turns prompt; do
  for rep in $(seq 1 "$EVAL_REPS"); do
    claude -p "$prompt" --model "$EVAL_MODEL" --output-format stream-json --verbose \
      --max-budget-usd "$EVAL_BUDGET" --max-turns "$turns" \
      --allowedTools "Read Grep Glob Bash Skill" < /dev/null > "$OUT/$id-$rep.jsonl" \
      || echo "aviso: $id-$rep terminó con error" >&2
  done
done < <(tareas)
