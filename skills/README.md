# Skills de Claude Code — Alyp Studio

Los skills son instrucciones ejecutables para Claude Code. Cada archivo `.md` en esta carpeta es un skill que Claude sigue al ser invocado.

## Skills disponibles

| Archivo | Invocación | Propósito |
|---------|-----------|-----------|
| `alyp-new-project.md` | `/alyp-new-project` | Crea un proyecto SaaS enterprise completo desde cero (16 fases) |
| `alyp-agentic-standards.md` | `/alyp-agentic-standards` | Aplica arquitectura por features, verify gate y CLAUDE.md slim |
| `alyp-observability.md` | `/alyp-observability` | Instala logging GPS + OTel agnóstico + Log Drain |
| `agentic-logging.md` | `/agentic-logging` | Instala el estándar de logging en cualquier proyecto Node/TS |

## Jerarquía de invocación

```
/alyp-new-project
 ├── invoca /alyp-agentic-standards  (FASE 3.5)
 ├── invoca supabase:supabase         (FASE 4)
 ├── invoca vercel:bootstrap          (FASE 5)
 ├── invoca /alyp-observability       (FASE 5.5)
 ├── invoca vercel:vercel-firewall    (FASE 5.6)
 └── invoca vercel:next-cache-components (FASE 5.7)
```

## Instalación

Ver [../docs/installation.md](../docs/installation.md)
