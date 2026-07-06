#!/usr/bin/env bash
set -euo pipefail
# Canario del ecosistema: valida que los skills sigan instalables y funcionales.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
echo "== 1/3 lint estructural =="
node "$REPO_DIR/scripts/lint-skills.mjs"

echo "== 2/3 assets de logging compilan (instalación bootstrap simulada) =="
cp -R "$REPO_DIR/canary/fixture" "$WORK/proj"
mkdir -p "$WORK/proj/utils"
cp "$REPO_DIR/skills/agentic-logging/assets/logger.ts"      "$WORK/proj/utils/logger.ts"
cp "$REPO_DIR/skills/agentic-logging/assets/error-codes.ts" "$WORK/proj/utils/error-codes.ts"
# Adaptación: los assets asumen el entorno Node (process.env, etc). Sin
# @types/node, tsc reporta ~20 falsos positivos TS2591 "Cannot find name
# 'process'" que son puramente ambientales (el brief autoriza ajustar
# lib/types de la fixture para esto). npx con múltiples -p no garantiza que
# typescript y @types/node convivan en el mismo árbol resoluble por `types`,
# así que instalamos localmente en el WORK dir.
( cd "$WORK/proj" \
  && npm install --no-save --silent typescript@latest @types/node@latest \
  && npx tsc -p tsconfig.json )
echo "✓ logger.ts + error-codes.ts compilan bajo strict"

echo "== 3/3 la config ESLint agentic detecta console desnudo y catch vacío =="
# Adaptaciones (documentadas en task-14-report.md):
# 1. El asset .eslintrc.agentic.cjs no declara parser, y los fixtures son
#    .ts — con el parser JS por defecto (Espree) ESLint 8 no entiende
#    `export`/anotaciones de tipos. Agregamos @typescript-eslint/parser +
#    sourceType module, tal como anticipa la nota del brief.
# 2. `npx -p eslint@8 -p @typescript-eslint/parser` no resuelve el segundo
#    paquete como módulo cargable por nombre desde .eslintrc.cjs (falla con
#    "Cannot find module '@typescript-eslint/parser'"); se instalan ambos
#    localmente en el WORK dir, igual que con tsc arriba.
# 3. Se sube `no-console` del 'warn' del asset a 'error' solo para el
#    canario: con warnings ESLint sale con exit 0, y la detección de
#    console desnudo debe reflejarse en el exit code por sí sola (sin
#    depender de que `no-empty` también dispare). No se edita el asset.
( cd "$WORK/proj" \
  && npm install --no-save --silent eslint@8 @typescript-eslint/parser@6
  # El heredoc va en su propia sentencia: encadenar `&& cat <<EOF ... EOF && …`
  # en una línea continuada es un error de sintaxis en bash (3.2 y 5.3).
  # `set -e` (heredado por el subshell) corta si el install o el cat fallan.
  cat > .eslintrc.cjs <<EOF
const base = require('$REPO_DIR/skills/agentic-logging/assets/.eslintrc.agentic.cjs');
module.exports = {
  ...base,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  rules: { ...base.rules, 'no-console': 'error' },
};
EOF
  npx eslint --no-eslintrc -c .eslintrc.cjs src/quiebra.ts \
  && { echo "✗ el lint DEBIÓ fallar sobre quiebra.ts"; exit 1; } \
  || echo "✓ eslint agentic marca las violaciones esperadas" )

echo "CANARIO OK"
