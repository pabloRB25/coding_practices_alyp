-- seed.sql — qa-standard: v1 (ejemplo canónico, adaptar al proyecto)
-- Idempotente: correrlo 2 veces deja la DB igual (upserts con on conflict).
-- IDs fijos y legibles para que flujos y aserciones los referencien.

-- bloque: empresa-base
insert into empresas (id, nombre)
values ('qa-empresa-1', 'QA Empresa de Prueba')
on conflict (id) do update set nombre = excluded.nombre;

-- bloque: clientes-base
insert into clientes (id, empresa_id, nombre, cedula)
values ('qa-cliente-1', 'qa-empresa-1', 'Cliente QA Uno', '1-1111-1111')
on conflict (id) do update set nombre = excluded.nombre;

-- NOTA: los usuarios de auth NO se crean acá (ver README.md de seeds).
