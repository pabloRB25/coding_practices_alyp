#!/bin/bash
# Oráculo del bloque `global` de scripts/install.mjs (targets temporales, nunca ~/.claude).
R="$(cd "$(dirname "$0")/../.." && pwd)"; ok=0; total=0
chk() { total=$((total+1)); if eval "$2"; then ok=$((ok+1)); else echo "FALLA $1"; fi; }
hooks_count() { python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(json.dumps(d.get('hooks',{})).count('guarda-plan.sh'))" "$1/settings.json" 2>/dev/null || echo -1; }
t1=$(mktemp -d); echo previo > "$t1/CLAUDE.md"
node "$R/scripts/install.mjs" --link --target "$t1" >/dev/null 2>&1
node "$R/scripts/install.mjs" --link --target "$t1" >/dev/null 2>&1
chk link_symlink   '[ -L "$t1/CLAUDE.md" ] && [ "$(readlink "$t1/CLAUDE.md")" = "$R/global/CLAUDE.md" ]'
chk link_backup    'ls "$t1"/CLAUDE.md.bak.* >/dev/null 2>&1 && grep -q previo "$t1"/CLAUDE.md.bak.*'
chk link_rules     '[ -L "$t1/rules/codigo.md" ] && [ -L "$t1/rules/frontend.md" ]'
chk link_scripts   '[ -e "$t1/scripts/guarda-plan.sh" ] && [ -e "$t1/scripts/check-claude-md.sh" ] && [ -e "$t1/scripts/chequeo-semanal.sh" ]'
chk link_hook_1vez '[ "$(hooks_count "$t1")" -eq 2 ]'   # 1 en bloque Workflow + 1 en bloque Bash
chk link_workflow  'python3 -c "import json,sys;d=json.load(open(sys.argv[1]));sys.exit(0 if any(b.get(\"matcher\")==\"Workflow\" for b in d[\"hooks\"][\"PreToolUse\"]) else 1)" "$t1/settings.json"'
chk link_no_plist  '[ ! -e "$t1/../Library/LaunchAgents/studio.alyp.chequeo-instrucciones.plist" ]'
t2=$(mktemp -d); echo previo > "$t2/CLAUDE.md"
node "$R/scripts/install.mjs" --copy --target "$t2" >/dev/null 2>&1
chk copy_intacto   '[ ! -L "$t2/CLAUDE.md" ] && [ "$(cat "$t2/CLAUDE.md")" = previo ]'
chk copy_sin_rules '[ ! -e "$t2/rules" ]'
chk copy_scripts   '[ -f "$t2/scripts/guarda-plan.sh" ] && [ -x "$t2/scripts/guarda-plan.sh" ]'
chk copy_hook      '[ "$(hooks_count "$t2")" -eq 2 ]'
rm -rf "$t1" "$t2"
echo "$ok/$total OK"; [ "$ok" -eq "$total" ]
