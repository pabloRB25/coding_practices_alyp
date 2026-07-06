-- reset.sql — qa-standard: v1 (ejemplo canónico, adaptar tablas al proyecto)
-- Limpia SOLO datos del tenant de QA. PROHIBIDO: truncates globales, auth.users,
-- esquemas de Supabase. El runner solo lo ejecuta si el ambiente permite_reset.
begin;

-- Borra en orden inverso a las FKs, siempre filtrado por el tenant QA
delete from facturas where cliente_id in (select id from clientes where empresa_id = 'qa-empresa-1');
delete from clientes where empresa_id = 'qa-empresa-1';

commit;
