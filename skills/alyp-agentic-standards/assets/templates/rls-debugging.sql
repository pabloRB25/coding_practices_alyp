-- Simular la query como un usuario específico
SELECT set_config('request.jwt.claims', '{"sub":"USER_UUID","role":"authenticated"}', true);
SELECT * FROM items WHERE org_id = 'ORG_UUID';

-- Verificar policies existentes
SELECT * FROM pg_policies WHERE tablename = 'items';

-- Verificar membership del usuario
SELECT * FROM memberships WHERE user_id = 'USER_UUID';
