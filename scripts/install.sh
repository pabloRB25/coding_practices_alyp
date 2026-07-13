#!/usr/bin/env bash
# Shim Unix — la lógica vive en install.mjs (cross-platform). No dupliques lógica acá.
set -euo pipefail
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/install.mjs" "$@"
