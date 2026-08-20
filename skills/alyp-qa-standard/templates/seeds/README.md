# Seeds — qa-standard: v1

Regla madre: **toda corrida parte de estado conocido**. `reset` + `seed` deben
ser idempotentes: correrlos dos veces seguidas deja la DB exactamente igual.

## Archivos

- `reset.sql` — borra SOLO el namespace QA (tenant, prefijo o marca declarada)
  dentro de las tablas de negocio: cada `DELETE`/`UPDATE` lleva su filtro, nunca
  `TRUNCATE` ni un `DELETE` sin `WHERE` (qa-standard P7). Con esa cota es lícito
  correrlo contra la base de desarrollo aunque conviva con datos reales.
  PROHIBIDO tocar `auth.users`, esquemas de Supabase (`auth`, `storage`) o
  cualquier tabla fuera del dominio. Debe negarse a correr si el ambiente no
  declara `permite_reset: namespace` (el runner lo valida antes de ejecutar).
- `seed.sql` (o `seed.ts` si necesita lógica) — datos canónicos con `insert ...
  on conflict do update` (upserts). IDs fijos y legibles (`qa-empresa-1`) para
  que los flujos y las aserciones los referencien.
- `personas.yaml` — actores de prueba. Formato:

```yaml
personas:
  admin-empresa:
    email: qa-admin@<proyecto>.test
    rol: administrador
    password_env: QA_PASSWORD_ADMIN   # la password vive en env var, no acá
  empleado-consulta:
    email: qa-empleado@<proyecto>.test
    rol: empleado
    password_env: QA_PASSWORD_EMPLEADO
```

## Bloques nombrados

Los flujos referencian precondiciones como `seed: <bloque>` (ej. `empresa-base`).
Marcá cada bloque en `seed.sql` con un comentario `-- bloque: empresa-base` para
que sea auditable qué flujo depende de qué datos.

## Usuarios de prueba

Los usuarios de auth se crean UNA vez por ambiente (vía dashboard o script
admin) y se referencian acá; el seed no crea usuarios de auth en cada corrida.
