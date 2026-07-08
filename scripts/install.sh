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
        alyp-observability alyp-qa-standard devstral-orchestration alyp-maestro \
        alyp-token-savings)

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

# --- alyp-token-savings: artefactos de ahorro de tokens en ~/.claude ---
ATS="$REPO_DIR/skills/alyp-token-savings/artifacts"
if [[ -d "$ATS" ]]; then
  mkdir -p "$TARGET/hooks"
  if [[ "$MODE" == "link" ]]; then
    ln -sfn "$ATS/statusline-context.py"  "$TARGET/statusline-context.py"
    ln -sfn "$ATS/hooks/context-guard.py" "$TARGET/hooks/context-guard.py"
    ln -sfn "$ATS/RTK.md"                 "$TARGET/RTK.md"
  else
    cp "$ATS/statusline-context.py"  "$TARGET/statusline-context.py"
    cp "$ATS/hooks/context-guard.py" "$TARGET/hooks/context-guard.py"
    cp "$ATS/RTK.md"                 "$TARGET/RTK.md"
  fi
  chmod +x "$TARGET/statusline-context.py" "$TARGET/hooks/context-guard.py" 2>/dev/null || true
  echo "✓ token-savings artefactos ($MODE)"

  # merge de keys en settings.json (preserva lo existente; backup antes)
  SETTINGS="$TARGET/settings.json"
  [[ -f "$SETTINGS" ]] || echo '{}' > "$SETTINGS"
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%Y%m%d%H%M%S)"
  TARGET="$TARGET" python3 - "$SETTINGS" <<'PY'
import json, os, sys
p = sys.argv[1]; target = os.environ["TARGET"]
with open(p) as f: d = json.load(f)
d["statusLine"] = {"type": "command", "command": "python3 %s/statusline-context.py" % target}
ups = d.setdefault("hooks", {}).setdefault("UserPromptSubmit", [])
cmd = "python3 %s/hooks/context-guard.py" % target
present = any("context-guard.py" in h.get("command", "") for b in ups for h in b.get("hooks", []))
if not present:
    ups.append({"hooks": [{"type": "command", "command": cmd, "timeout": 10}]})
with open(p, "w") as f:
    json.dump(d, f, indent=2); f.write("\n")
print("✓ settings.json: statusLine + UserPromptSubmit hook mergeados (backup .bak.*)")
PY
fi

echo "Instalación completa ($MODE) en $TARGET"
