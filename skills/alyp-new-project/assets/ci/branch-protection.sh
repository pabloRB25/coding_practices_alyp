#!/usr/bin/env bash
# Enforcement de los gates de promoción (qa-standard §Promoción entre ambientes).
#
# ⚠ Los `context` de acá son los NOMBRES de los jobs agregadores en
# gate-stg.yml y gate-main.yml. Cambiar uno sin el otro deja el gate MUDO: el
# check requerido no reporta nunca y el PR queda esperando para siempre, que no
# es lo mismo que pasar (qa-standard G4). Se cambian juntos, en el mismo PR.
#
# Requiere: PROJECT_SLUG exportado.
set -euo pipefail
: "${PROJECT_SLUG:?exportá PROJECT_SLUG antes de correr este script}"
ORG="${ORG:-alyp-studio}"

# main — máxima protección. enforce_admins: nadie promueve a producción en rojo.
gh api --method PUT "/repos/$ORG/$PROJECT_SLUG/branches/main/protection" \
  --input - << 'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [{ "context": "Gate MAIN" }]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

# staging — bloqueante también acá: un gate que no impide la promoción es
# telemetría, no un gate (G3). enforce_admins queda en false a propósito: es la
# válvula de escape para un hotfix, y su uso queda registrado.
gh api --method PUT "/repos/$ORG/$PROJECT_SLUG/branches/staging/protection" \
  --input - << 'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [{ "context": "Gate STG" }]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

# develop — sin checks requeridos: el gate que valida el cambio es el LOCAL
# (`pnpm verify:full`). El Gate DEV de CI corre igual como red mínima, pero no
# bloquea: bloquear acá duplicaría el gate local y frenaría el trabajo diario.
gh api --method PUT "/repos/$ORG/$PROJECT_SLUG/branches/develop/protection" \
  --input - << 'JSON'
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "✓ Branch protection aplicada en main / staging / develop de $ORG/$PROJECT_SLUG"
echo "  Verificá que los contextos existan:"
echo "    gh api repos/$ORG/$PROJECT_SLUG/branches/staging/protection -q .required_status_checks.contexts"
