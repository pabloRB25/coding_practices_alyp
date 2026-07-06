# FASE 3.6 — Data Layer & Tenancy

## RLS deny-by-default (SIEMPRE, todo proyecto)

Crear `supabase/migrations/0001_rls_baseline.sql`:
```sql
-- Habilitar RLS en todas las tablas existentes — política base: denegar todo
-- Cada tabla necesita políticas explícitas para ser accesible
-- Gate: supabase/migrations/ debe tener 0 tablas sin RLS antes de deploy a PROD

-- Plantilla para cada tabla nueva:
-- ALTER TABLE public.mi_tabla ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "authenticated can read own" ON public.mi_tabla
--   FOR SELECT TO authenticated USING (user_id = auth.uid());
```

## Multi-tenancy base (solo si `USE_MULTITENANCY=true`)

Crear `supabase/migrations/0002_tenancy.sql`: código completo en [`../assets/supabase/0002_tenancy.sql`](../assets/supabase/0002_tenancy.sql). Incluye:
- Tablas `organizations`, `memberships` (con roles owner/admin/member/viewer) y `audit_log`
- Índices sobre `memberships(user_id)` y `memberships(org_id)`
- Helper `auth.user_orgs()` sin recursión para RLS
- RLS habilitado + políticas de lectura por organización

Helper server-side en `src/lib/auth/require-role.ts`: código completo en [`../assets/app/require-role.ts`](../assets/app/require-role.ts).

## Seed local

Crear `supabase/seed.sql` para que `supabase db reset` no deje la DB vacía:

```sql
-- supabase/seed.sql
-- Datos mínimos para desarrollo local. No commitear datos sensibles reales.

-- Organización de prueba (solo si USE_MULTITENANCY=true)
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Org Demo', 'org-demo')
ON CONFLICT (id) DO NOTHING;

-- Nota: los usuarios de auth se crean via Supabase Auth UI o scripts de seed separados.
-- Ver: supabase/seed-users.md para el flujo de creación de usuarios de prueba.
```

## Trigger: poblar memberships al signup (si USE_MULTITENANCY=true)

Sin este trigger, el primer usuario que se registra no tiene `membership` y todas las RLS policies lo bloquean.

Crear `supabase/migrations/0003_auth_trigger.sql`: código completo en [`../assets/supabase/0003_auth_trigger.sql`](../assets/supabase/0003_auth_trigger.sql). Función `public.handle_new_user()` + trigger `on_auth_user_created`: si el usuario viene con metadata de `org_id` (invite flow) se une a esa org como member; si no, crea una org personal y lo asigna como owner.

> Nota: este trigger solo aplica si `USE_MULTITENANCY=true`. Si es single-tenant, omitir.
