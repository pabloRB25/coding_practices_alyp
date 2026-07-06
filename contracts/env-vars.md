# Contrato: variables de entorno estándar (v1)

Tabla única. Cada variable tiene UN skill dueño (quien la define y documenta);
los demás solo la consumen. Al agregar una var estándar nueva: primero acá, después
en el `env.example` del skill dueño.

| Variable | Dueño | Consumidores | Ambientes | Notas |
|---|---|---|---|---|
| `SERVICE_NAME` | agentic-logging | observability, qa | todos | sufijo por ambiente (`-dev`, `-staging`) |
| `APP_SOURCE_DIRS` | agentic-logging | — | todos | honeypot: dirs de código propio; monorepo incluye `packages` |
| `LOG_LEVEL` | agentic-logging | — | todos | `debug` local, `warn` en prod |
| `LOG_PROVIDER` | agentic-logging | observability | todos | `local` SOLO en `next dev`; nunca `local` en Vercel |
| `LOG_PROVIDER_API_URL` | agentic-logging | agent-gps | vercel | endpoint de consulta del backend de logs |
| `LOG_PROVIDER_TOKEN` | agentic-logging | agent-gps | vercel | credencial de consulta |
| `LOG_REDACT_KEYS` | agentic-logging | — | todos | extiende el scrub de PII |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | alyp-observability | — | staging/prod | vacío = no-op |
| `OTEL_EXPORTER_OTLP_HEADERS` | alyp-observability | — | staging/prod | auth del backend OTLP |
| `LOKI_PUSH_URL` / `LOKI_AUTH` | alyp-observability | — | vercel | solo perfil Grafana/Loki; ver gotchas en el skill |
| `NEXT_PUBLIC_SUPABASE_URL` / `*_ANON_KEY` | alyp-new-project (F4) | app | todos | por ambiente; anon key va en allowlist de secret-scan |
| `SUPABASE_SERVICE_ROLE_KEY` | alyp-new-project (F4) | app (solo Node runtime) | todos | NUNCA en Edge middleware ni en cliente |
| `DATABASE_URL` / `DIRECT_URL` | alyp-new-project (F4) | migraciones | todos | pooler 6543 / directo 5432 |
| `QA_*` (credenciales de personas) | alyp-qa-standard | e2e, smoke | dev/staging | solo por env vars, nunca en repo |
| `CONTEXT_BOT_TOKEN` | alyp-new-project (F8) | update-context CI | GitHub | secret de Actions |

Regla de oro heredada del logging: la app solo lee env — cambiar de backend
(logs, OTel) = cambiar valores, cero cambios de código.
