# main — máxima protección
gh api --method PUT /repos/alyp-studio/$PROJECT_SLUG/branches/main/protection \
  --input - << 'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [{ "context": "Build, Lint & Typecheck" }]
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

# staging — protección media
gh api --method PUT /repos/alyp-studio/$PROJECT_SLUG/branches/staging/protection \
  --input - << 'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [{ "context": "Build, Lint & Typecheck" }]
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

# develop — solo bloquear borrado y force push
gh api --method PUT /repos/alyp-studio/$PROJECT_SLUG/branches/develop/protection \
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
