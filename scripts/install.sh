#!/usr/bin/env bash
set -euo pipefail

# Instalador del ecosistema de skills Alyp.
#   --copy  (default) copia skills/ y agents/ al target — para equipos externos
#   --link  symlinks al repo — para desarrollo del ecosistema (cero drift)
#   --target DIR  destino (default: ~/.claude)

MODE="copy"
TARGET="$HOME/.claude"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --link) MODE="link"; shift ;;
    --copy) MODE="copy"; shift ;;
    --target) TARGET="$2"; shift 2 ;;
    *) echo "arg desconocido: $1" >&2; exit 2 ;;
  esac
done

mkdir -p "$TARGET/skills" "$TARGET/agents"
SKILLS=(alyp-new-project alyp-agentic-standards agentic-logging \
        alyp-observability alyp-qa-standard devstral-orchestration alyp-maestro)

for s in "${SKILLS[@]}"; do
  dest="$TARGET/skills/$s"
  if [[ "$MODE" == "link" ]]; then
    [[ -e "$dest" && ! -L "$dest" ]] && rm -rf "$dest"
    ln -sfn "$REPO_DIR/skills/$s" "$dest"
  else
    rm -rf "$dest"
    cp -R "$REPO_DIR/skills/$s" "$dest"
  fi
  echo "✓ skill $s ($MODE)"
done

for a in "$REPO_DIR"/agents/*.md; do
  name="$(basename "$a")"
  if [[ "$MODE" == "link" ]]; then
    ln -sfn "$a" "$TARGET/agents/$name"
  else
    cp "$a" "$TARGET/agents/$name"
  fi
  echo "✓ agente $name ($MODE)"
done

cap_example="$REPO_DIR/skills/devstral-orchestration/capacity.example.yaml"
if [[ -f "$cap_example" && ! -f "$TARGET/capacity.yaml" ]]; then
  cp "$cap_example" "$TARGET/capacity.yaml"
  echo "✓ capacity.yaml creado desde example — editalo con los modelos/límites de tu entorno"
fi

echo "Instalación completa ($MODE) en $TARGET"
