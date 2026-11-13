#!/bin/bash
# guarda-plan — hook PreToolUse (Workflow|Bash): pide confirmación (ask) antes de
# ejecutar un plan o de actuar hacia afuera.
#
# Por qué: 2026-07-16 en nomi_v3 un dry run de un Workflow corrió todo de verdad
# (los args no aplicaron). La Regla #0 ("planificar no es ejecutar") escrita en
# prosa no alcanzó; este hook la vuelve mecánica.
#
# Pide permiso: cualquier Workflow (incluido args.dryRun); en posición de comando,
# con prefijo opcional `rtk`: git push / git -C <ruta> push (salvo --dry-run o -n),
# gh api con --method/-X PUT|POST|PATCH|DELETE, gh pr create|merge, gh repo edit,
# gh secret set|delete.
# Permite (sin salida): todo lo demás, incluido texto en argumentos
# (echo "git push", grep "gh pr merge" docs/).
# Nunca sale con código != 0: un hook roto no debe bloquear todo.

input=$(cat) || exit 0
tool=$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null) || exit 0

motivo=""
if [ "$tool" = "Workflow" ]; then
  motivo="ejecutar un Workflow (incluido dry run)"
elif [ "$tool" = "Bash" ]; then
  cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
  [ -z "$cmd" ] && exit 0

  # Posición de comando: inicio, tras ; & | ( ` $( o tras xargs/sudo/exec/nohup/command/time; rtk opcional.
  pos='(^|[;&|(`]|\$\(|(xargs|sudo|exec|nohup|command|time)[[:space:]]+([^[:space:]]+[[:space:]]+)*)[[:space:]]*([^[:space:];&|]*/)?(rtk[[:space:]]+)?'

  gitopts='(((-C|-c)[[:space:]]+[^[:space:]]+|--no-pager|--git-dir=[^[:space:]]+|--work-tree=[^[:space:]]+)[[:space:]]+)*'
  gitpush=""
  # Cada git push se evalúa por separado: --dry-run/-n solo cuenta dentro de su segmento (hasta ; & |).
  while IFS= read -r seg; do
    [ -z "$seg" ] && continue
    rest="${seg#*push}"
    if ! printf '%s\n' "$rest" | grep -qE '(^|[[:space:]])(--dry-run|-n)([[:space:]]|$)'; then
      gitpush=1
    fi
  done < <(printf '%s\n' "$cmd" | grep -oE "${pos}git[[:space:]]+${gitopts}push([[:space:]][^;&|]*|\$)" 2>/dev/null)
  if [ -n "$gitpush" ]; then
    motivo="git push"
  elif printf '%s\n' "$cmd" | grep -qE "${pos}gh[[:space:]]+api([[:space:]]|\$)" \
    && printf '%s\n' "$cmd" | grep -qiE '(--method[[:space:]]+|--method=|-X[[:space:]]*)(PUT|POST|PATCH|DELETE)([[:space:]]|$)'; then
    motivo="gh api con método que escribe"
  elif printf '%s\n' "$cmd" | grep -qE "${pos}gh[[:space:]]+pr[[:space:]]+(create|merge)([[:space:]]|\$)"; then
    motivo="gh pr create/merge"
  elif printf '%s\n' "$cmd" | grep -qE "${pos}gh[[:space:]]+repo[[:space:]]+edit([[:space:]]|\$)"; then
    motivo="gh repo edit"
  elif printf '%s\n' "$cmd" | grep -qE "${pos}gh[[:space:]]+secret[[:space:]]+(set|delete)([[:space:]]|\$)"; then
    motivo="gh secret set/delete"
  fi
fi

[ -z "$motivo" ] && exit 0

razon="Regla #0 / acción hacia afuera: ${motivo}. Ejecutar un plan (Workflow, incluido un dry run) o actuar sobre GitHub/la plataforma necesita el visto bueno explícito del usuario. Si ya lo dio en este pedido, aprobá; si no, preguntale antes."
jq -n --arg r "$razon" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$r}}' 2>/dev/null
exit 0
