-- supabase/seed.sql
-- Se ejecuta automáticamente con: supabase db reset

-- Organización de prueba (solo si USE_MULTITENANCY=true)
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Org Demo', 'org-demo')
ON CONFLICT (id) DO NOTHING;

-- Nota: usuarios de auth se crean via Supabase Dashboard > Auth > Users (en local: localhost:54323)
-- o via el script: pnpm supabase:seed-users (crear si necesario)
