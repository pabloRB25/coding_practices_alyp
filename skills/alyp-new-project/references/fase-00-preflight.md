# FASE 0 — Pre-flight

Verificar herramientas y autenticación. **Fallar rápido** antes de crear recursos.

Ejecutar los checks de pre-flight (código completo en [`../assets/scripts/preflight-checks.sh`](../assets/scripts/preflight-checks.sh)):

- Versiones mínimas: `gh` (autenticado), `vercel` (autenticado), `pnpm >= 9`, `node >= 22`, `supabase` CLI
- Scopes del token de GitHub (necesita repo + admin:org para branch protection y secrets): `gh auth status`
- Identidad Vercel: `vercel whoami`
- Identidad git: `git config --global user.name` (pablopr) y `git config --global user.email` (pr@pablorodriguezb.com)

Si git no coincide, corregir:
```bash
git config --global user.name "pablopr"
git config --global user.email "pr@pablorodriguezb.com"
```

**Gate de salida**: todas las herramientas disponibles y autenticadas. No continuar si falla gh o vercel.
