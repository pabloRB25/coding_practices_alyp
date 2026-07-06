# FASE 4 — Supabase (delegado)

> Invocar el skill `supabase:supabase` con este contexto:

**Tarea**: crear 3 proyectos Supabase para este proyecto.

```
# 3 proyectos — uno por ambiente real:

# DEV — para ambiente de develop (desarrollo activo)
# create_project → nombre: $PROJECT_SLUG-dev, region: us-east-1

# STAGING — para validación pre-prod (staging/QA)
# create_project → nombre: $PROJECT_SLUG-staging, region: us-east-1

# PROD — producción
# create_project → nombre: $PROJECT_SLUG-prod, region: us-east-1
```

- Obtener `URL`, `anon key` y `service_role key` de cada uno
- Obtener `DATABASE_URL` (pooler, puerto 6543) y `DIRECT_URL` (puerto 5432) de cada uno

> Luego invocar `supabase:supabase-postgres-best-practices` para revisar:
> - Configuración de connection pooling
> - Índices obligatorios sobre columnas de RLS y FKs de tenant
> - Activar leaked-password protection en Auth settings

Anotar en sesión:
- `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY`, `SUPABASE_DEV_SERVICE_ROLE`
- `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_ANON_KEY`, `SUPABASE_STAGING_SERVICE_ROLE`
- `SUPABASE_PROD_URL`, `SUPABASE_PROD_ANON_KEY`, `SUPABASE_PROD_SERVICE_ROLE`
- `DATABASE_URL_DEV`, `DIRECT_URL_DEV`
- `DATABASE_URL_STAGING`, `DIRECT_URL_STAGING`
- `DATABASE_URL_PROD`, `DIRECT_URL_PROD`

Crear `supabase/config.toml`:
```toml
[api]
port = 54321

[db]
port = 54322

[studio]
port = 54323

[auth]
site_url = "http://127.0.0.1:3001"
additional_redirect_urls = ["http://localhost:3001"]
```

Crear `.env.local` en `apps/app/` con las keys DEV (ambiente de desarrollo activo). No commitear.

Aplicar migraciones de FASE 3.5 al proyecto DEV:
```bash
supabase db push --db-url $DIRECT_URL_DEV
```

Ejecutar advisors y verificar que no haya tablas sin RLS:
```bash
# Via MCP: mcp__plugin_supabase_supabase__get_advisors → revisar security advisors
```

**Gate de salida**: 3 proyectos ACTIVE_HEALTHY (dev, staging, prod), migraciones aplicadas en DEV, 0 tablas sin RLS en advisor.
