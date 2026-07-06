# FASE 5.7 — Performance & Caching (delegado)

> Invocar el skill `vercel:next-cache-components` con contexto:

**Tarea**: configurar estrategia de caching para `$PROJECT_SLUG`.
- PPR ya habilitado en `next.config.ts` (`ppr: "incremental"`)
- Revisar rutas de `apps/web` — deben ser SSG/ISR por defecto (marketing estático)
- Configurar `use cache` / `cacheTag` / `revalidateTag` para queries de Supabase reutilizables
- Revisar que ningún RSC en `apps/web` use cookies (lo volvería dinámico)
