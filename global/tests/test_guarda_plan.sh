#!/bin/bash
# Oráculo de guarda-plan.sh: 16 casos (11 piden permiso, 5 no deben dispararse).
HOOK="$(cd "$(dirname "$0")/.." && pwd)/hooks/guarda-plan.sh"
[ -f "$HOOK" ] || { echo "FALLA: no existe $HOOK"; exit 1; }
ok=0; total=0
caso() { # nombre esperado json
  total=$((total+1))
  out=$(printf '%s' "$3" | bash "$HOOK" 2>/dev/null)
  dec=$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null)
  [ -z "$out" ] && dec="none"
  if [ "$dec" = "$2" ]; then ok=$((ok+1)); else echo "FALLA $1: esperado=$2 obtenido=$dec"; fi
}
bash_json() { jq -cn --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
caso workflow    ask  '{"tool_name":"Workflow","tool_input":{"script":"x","args":{"dryRun":true}}}'
caso gh_put      ask  "$(bash_json 'gh api repos/o/r/branches/main/protection --method PUT')"
caso gh_x_delete ask  "$(bash_json 'gh api -X DELETE repos/o/r/actions/secrets/X')"
caso git_push    ask  "$(bash_json 'git push origin feat/x')"
caso git_c_push  ask  "$(bash_json 'git -C /ruta push')"
caso pr_create   ask  "$(bash_json 'cd x && gh pr create --fill')"
caso pr_merge    ask  "$(bash_json 'rtk gh pr merge 12 --squash')"
caso repo_edit   ask  "$(bash_json 'gh repo edit --default-branch main')"
caso secret_set  ask  "$(bash_json 'gh secret set TOKEN')"
caso push_y_ls_n ask  "$(bash_json 'git push origin x && ls -n')"
caso git_c_cfg   ask  "$(bash_json 'git -c core.sshCommand=ssh push')"
caso push_dry    none "$(bash_json 'git push --dry-run')"
caso gh_get      none "$(bash_json 'gh api repos/o/r')"
caso pr_view     none "$(bash_json 'gh pr view 12')"
caso echo        none "$(bash_json 'echo "git push y gh pr create"')"
caso grep        none "$(bash_json 'grep -rn "gh pr merge" docs/')"
echo "$ok/$total OK"
[ "$ok" -eq "$total" ] && [ "$total" -eq 16 ]
