-- Migration: add_<dominio>
-- Generada por: pnpm new-feature <dominio>

CREATE TABLE IF NOT EXISTS public.<dominio>s (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  org_id     uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX ON public.<dominio>s(org_id);

-- RLS (OBLIGATORIO — deny by default)
ALTER TABLE public.<dominio>s ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: miembros de la org pueden leer
CREATE POLICY "<dominio>s_select" ON public.<dominio>s
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT auth.user_orgs()));

-- Policy INSERT: miembros admin+ pueden crear
CREATE POLICY "<dominio>s_insert" ON public.<dominio>s
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT auth.user_orgs()));

-- Policy UPDATE/DELETE: owner/admin solo
-- (añadir cuando se necesite)
