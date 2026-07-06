# Coding Practices — Alyp Studio

Repositorio central de estándares de código, skills de Claude Code y prácticas de desarrollo de Alyp Studio.

**Stack de referencia**: Turborepo · Next.js · Supabase · Vercel · GitHub
**Principio rector**: optimizar el ciclo del agente — LEER → ENTENDER → CAMBIAR → VERIFICAR

---

## ¿Qué es esto?

Este repo es el ecosistema completo que Alyp Studio usa para crear y mantener
proyectos SaaS enterprise con agentes de IA como usuario principal del código.
Está organizado en tres capas: **contratos** agnósticos de stack que definen
invariantes verificables, un **perfil** de skills que los implementa para
Turborepo·Next.js·Supabase·Vercel, y un **manifiesto** por repo cliente que
declara qué estándares adoptó y en qué versión. El repo mismo no se copia a
cada proyecto: se instala (skills) o se referencia (manifiesto), y el
`CLAUDE.md` slim de cada proyecto es lo único que el agente relee cada sesión.

---

## Las 3 capas

```
1. contracts/                         ← invariantes agnósticos, versionados
   code-standard · qa-standard · logging-standard · orchestration
   env-vars · manifest · evidencia.schema.json
   → el "qué" y el "por qué"; nunca nombran un producto concreto
   → aceptación agnóstica: condiciones verificables por cualquier perfil

        │ implementado por
        ▼

2. skills/  (perfil next·supabase·vercel)   +   agents/
   7 skills instalables + 4 agentes de Claude Code
   → el "cómo" concreto para el stack de Alyp Studio
   → se instalan en ~/.claude/skills/ (ver docs/installation.md)

        │ adoptado y declarado por
        ▼

3. standards.yaml  (en la raíz de CADA repo cliente)
   ecosistema, perfil, estandares: {code-standard: v1, ...}, excepciones: []
   → fuente de verdad de qué adoptó ESE repo y en qué versión
   → los sellos en su CLAUDE.md (agentic-standard: v1, qa-standard: v1,
     logging-standard: v1) deben coincidir con este manifiesto
```

Ver [`docs/adopcion-equipos.md`](docs/adopcion-equipos.md) para el detalle de
qué se adopta, en qué orden, y qué decisiones de marca (español, `alyp-*`) se
heredan sin negociar.

---

## Los 7 skills

| Skill | Rol | Contrato que implementa | Versión |
|---|---|---|---|
| `alyp-new-project` | Orquestador — crea un proyecto SaaS desde cero (16 fases), delega a los demás skills en orden | — (orquesta, no implementa un contrato propio) | 1.1.0 |
| `alyp-agentic-standards` | Arquitectura por features, gate `pnpm verify`, generador `new-feature` | `code-standard` | 1.1.0 |
| `agentic-logging` | Logging GPS estructurado (`agenticLogger`), standalone para cualquier Node/TS | `logging-standard`, `traceid-contract` | 1.1.0 |
| `alyp-observability` | OTel agnóstico, Vercel Log Drains, reemplaza stubs de logger/error-codes | `observability` | 1.1.0 |
| `alyp-qa-standard` | Catálogo de flujos YAML, Playwright con 3 oráculos (UI+DB+logs), smoke agéntico | `qa-standard` | 1.0.0 |
| `devstral-orchestration` | Protocolo multi-modelo v2.6 (6 tiers, `capacity.yaml` por entorno) | `orchestration` | 2.6.0 |
| `alyp-maestro` | Curaduría de conocimiento LOCAL por proyecto (skills en `.claude/skills/` del repo cliente) | — (`provides: [curaduria]`, sin contrato propio) | 1.0.0 |

Los 4 agentes de Claude Code (`agents/`) — `consultor`, `explorador`,
`implementador`, `revisor` — son los subagentes que el protocolo de
`devstral-orchestration` despacha para research, implementación, revisión y
desempate.

---

## Instalación

Ver [`docs/installation.md`](docs/installation.md) — tres vías: plugin de
Claude Code (recomendada para equipos), script (`./scripts/install.sh`, con
modo `--link` para desarrollo del ecosistema), o copia manual de skills
puntuales.

---

## Desarrollo del ecosistema

Para quien edita `skills/`, `contracts/` o `agents/` en este repo (no para
equipos que solo lo consumen):

**Modo `--link`**: instalar con `./scripts/install.sh --link` symlinkea
`~/.claude/skills/*` y `~/.claude/agents/*` a este repo — cero drift, cualquier
edición se refleja al instante sin re-instalar. `scripts/check-drift.sh`
detecta si una instalación en modo `--copy` quedó desactualizada respecto al
repo (o si falta instalar algún skill).

**Lint estructural**: `node scripts/lint-skills.mjs` valida que cada skill
tenga frontmatter completo (`name`, `description`, `version`), que el grafo
`requires:`/`provides:` cierre (nadie requiere una capacidad que ningún skill
provee), y que las referencias a `assets/`/`references/`/`templates/`
mencionadas en el `SKILL.md` existan en disco. Correrlo antes de todo PR que
toque `skills/`.

**Cómo versionar un cambio a un skill**:
1. Editar el skill correspondiente en `skills/<nombre>/`.
2. Incrementar `version:` en el frontmatter del `SKILL.md` (semver).
3. Documentar el cambio en `CHANGELOG.md`.
4. Abrir PR a `develop` (nunca commit directo a `main`).

Si el cambio afecta un contrato (`contracts/*.md`), el mismo PR debe actualizar
el sello de versión del contrato y, si corresponde, `contracts/standards.example.yaml`.

---

## Estructura del repo

```
coding_practices_alyp/
├── contracts/                      # invariantes agnósticos (capa 1)
│   ├── code-standard.md
│   ├── qa-standard.md
│   ├── logging-standard.md
│   ├── orchestration.md
│   ├── env-vars.md
│   ├── manifest.md
│   ├── standards.example.yaml      # plantilla de standards.yaml para repos cliente
│   └── evidencia.schema.json       # sobre único de evidencia (tests/comandos/e2e)
├── skills/                         # perfil next·supabase·vercel (capa 2)
│   ├── alyp-new-project/
│   ├── alyp-agentic-standards/
│   ├── agentic-logging/
│   ├── alyp-observability/
│   ├── alyp-qa-standard/
│   ├── devstral-orchestration/
│   └── alyp-maestro/
├── agents/                         # subagentes de Claude Code
│   ├── consultor.md
│   ├── explorador.md
│   ├── implementador.md
│   └── revisor.md
├── .claude-plugin/                 # empaquetado como plugin instalable
│   ├── plugin.json                 # alyp-dev-standards
│   └── marketplace.json            # marketplace alyp-studio
├── scripts/
│   ├── install.sh                  # --copy | --link | --target
│   ├── check-drift.sh              # detecta drift repo vs. instalado
│   └── lint-skills.mjs             # meta-QA estructural de skills/
├── guides/
│   └── guia-codigo-agentic-ready.md
├── docs/
│   ├── installation.md
│   ├── adopcion-equipos.md
│   ├── skill-ecosystem.md
│   └── environment-strategy.md
└── CHANGELOG.md
```

---

## Principios de diseño

**Contrato antes que perfil**
Toda regla que nombra un producto concreto pertenece al perfil (`skills/`), no
al contrato (`contracts/`). Esto es lo que permite que un equipo con otro stack
adopte el mismo estándar sin heredar Next.js/Supabase/Vercel.

**Agnóstico por defecto**
Toda integración de plataforma vía env var estándar o protocolo abierto
(OTel/OTLP). Cambiar de Axiom a Datadog = cambiar credenciales, no código.

**RLS deny-by-default**
Toda tabla tiene RLS habilitado. Las políticas se declaran explícitamente.

**El agente como usuario principal**
El código está estructurado para que un agente de IA pueda leer menos,
entender más, cambiar con confianza y verificar en un comando.

**Done = gate + evidencia**
Una tarea está terminada solo con el gate verde y evidencia reproducible del
happy path — "parece correcto" no es evaluable.

---

## Ver también

- [`docs/installation.md`](docs/installation.md) — cómo instalar
- [`docs/adopcion-equipos.md`](docs/adopcion-equipos.md) — qué adopta un equipo y en qué orden
- [`docs/skill-ecosystem.md`](docs/skill-ecosystem.md) — cadena de delegación entre los 7 skills y ciclo operativo
- [`docs/environment-strategy.md`](docs/environment-strategy.md) — estrategia de ambientes dev/staging/prod
- [`guides/guia-codigo-agentic-ready.md`](guides/guia-codigo-agentic-ready.md) — guía de referencia completa del estándar de código
