## Referencia completa del estándar

La guía completa vive aquí como referencia consultable. No se copia a cada repo — el CLAUDE.md slim es lo único que el agente lee en cada sesión.

### Principio rector: el bucle del agente

Un agente siempre repite: LEER → ENTENDER → CAMBIAR → VERIFICAR.
Todo lo que abarata un paso sube la tasa de éxito y baja el consumo de tokens.

### Arquitectura por features — reglas

- Co-localización: todo lo de un dominio en `src/features/<dominio>/`
- Naming: `<feature>.<rol>.ts` — nunca romper el patrón
- Route handlers delgados: `app/api/.../route.ts` delega a `features/.../controller.ts`
- Barrel `index.ts`: declara la API pública; prohíbe deep imports via ESLint
- Archivos pequeños (< 200 líneas), una responsabilidad por archivo
- Named exports siempre — son greppables, el agente los localiza por nombre

### TypeScript como documentación viva

- `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- El compilador convierte la ambigüedad en errores explícitos y reparables
- JSDoc solo donde el tipo no sea suficiente (reglas de negocio ocultas, efectos secundarios)

### Contratos Zod: una sola fuente de verdad

- Schema en `.schema.ts`, tipo derivado con `z.infer`
- `safeParse` + código UPPER_SNAKE en toda frontera pública
- Env tipado con `@t3-oss/env-nextjs` — falla rápido y claro si falta config
- Tipos de Supabase autogenerados — nunca escribir tipos de DB a mano

### VERIFICAR: la palanca más importante

- `pnpm verify` = typecheck + lint + test — un comando, una señal
- CI espejo del local — el agente recibe la misma señal local y remota
- Tests co-localizados con factories/fixtures — el agente escribe tests sin fricción

### Bootstrap determinista

- `git clone && pnpm install && pnpm dev` debe funcionar de cero
- `.env.example` completo con todos los placeholders
- `pnpm supabase:gen` regenera tipos en cualquier momento
