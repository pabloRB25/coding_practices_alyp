-- Función que crea el perfil y membership inicial al registrarse un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Si el usuario viene con metadata de org_id (invite flow), unirse a esa org
  -- Si no, crear una org personal
  v_org_id := (NEW.raw_user_meta_data->>'org_id')::uuid;

  IF v_org_id IS NULL THEN
    -- Crear org personal
    INSERT INTO public.organizations (name, slug)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'personal-' || substr(NEW.id::text, 1, 8)
    )
    RETURNING id INTO v_org_id;

    -- Primer usuario = owner
    INSERT INTO public.memberships (org_id, user_id, role)
    VALUES (v_org_id, NEW.id, 'owner');
  ELSE
    -- Unirse a org existente como member (el invite flow asigna el rol real)
    INSERT INTO public.memberships (org_id, user_id, role)
    VALUES (v_org_id, NEW.id, 'member')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Disparar al crear usuario en auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
