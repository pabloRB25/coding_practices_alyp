-- Organizaciones
CREATE TABLE public.organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Membresías con roles
CREATE TABLE public.memberships (
  org_id     uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX ON public.memberships(user_id);
CREATE INDEX ON public.memberships(org_id);

-- Helper sin recursión para RLS
CREATE OR REPLACE FUNCTION auth.user_orgs()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
$$;

-- Audit log
CREATE TABLE public.audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid REFERENCES public.organizations(id),
  actor_id   uuid REFERENCES auth.users(id),
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  uuid,
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read own org" ON public.organizations
  FOR SELECT TO authenticated USING (id IN (SELECT auth.user_orgs()));

CREATE POLICY "members can read own memberships" ON public.memberships
  FOR SELECT TO authenticated USING (org_id IN (SELECT auth.user_orgs()));

CREATE POLICY "members can read own audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (org_id IN (SELECT auth.user_orgs()));
