# Handoff — Ola 6: alinear el skill `architecture-standards` en claude.ai

Runbook de la **Ola 6** del plan de remediación (`docs/plans/2026-07-17-remediacion-ecosistema-skills.md`).
Es la única parte del plan que vive **fuera de esta máquina**, en la cuenta web de
claude.ai — no hay API/herramienta para editarla desde el repo, así que la ejecuta
un agente con la sesión autenticada del usuario (o el usuario a mano).

**Estado de las Olas 0–5** (2026-07-18): mergeadas a `develop` (PRs #4 y #5) y
activadas localmente (symlink de `architecture-standards`, `devstral-orchestration`
v2.8, agentes, `~/.claude/CLAUDE.md` con bloque de routing + fronteras, Regla #0 en
memoria convertida a puntero). Solo resta esta Ola 6.

## Objetivo

Sincronizar el skill `architecture-standards` de **claude.ai** con la versión del
repo (**fuente de verdad**) y endurecer su triggering. No crear una segunda fuente
de verdad.

## Direcciones (absolutas)

| Qué | Dirección |
|---|---|
| Repo (fuente de verdad) | `/Users/parb/Dev/alyp-studio/coding_practices_alyp` |
| Rama / commit vivo | `develop` @ `72b68f9` |
| SKILL fuente | `skills/architecture-standards/SKILL.md` |
| References fuente | `skills/architecture-standards/references/architecture.md` |
| Symlink local activo | `~/.claude/skills/architecture-standards` → repo |
| Contrato que implementa | `contracts/engineering-baseline.md` (§02, anchor `#02-arquitectura`) |
| Perfil que NO debe duplicar | `skills/alyp-agentic-standards/` |
| Gestión de skills | claude.ai → Settings → Capabilities / Skills → `architecture-standards` → **Update skill** |

## Task 6.1 — Alinear el skill de claude.ai con el repo

1. En claude.ai, abrir el skill `architecture-standards` → **Update skill**.
2. Reemplazar su `SKILL.md` y `references/architecture.md` por el contenido **exacto**
   del repo (los archivos fuente listados arriba).
3. ⛔ **Rechazar la oferta del "stack overlay"** (`references/stack-overlay.md`) si
   claude.ai la ofrece: duplicaría `alyp-agentic-standards` → segunda fuente de
   verdad, divergencia garantizada.
4. Cualquier contenido de **stack específico** (Next/Supabase/Vercel) que tenga el
   skill en claude.ai → reemplazar por un **puntero de una línea** a los perfiles del
   repo. El skill debe quedar agnóstico: decide arquitectura, no implementa un stack.
5. **El repo es la fuente de verdad**: ante conflicto entre lo que había en claude.ai
   y el repo, gana el repo. Si aparece un export previo de claude.ai con contenido
   válido adicional, reconciliarlo **hacia el repo primero** y luego sincronizar.

## Task 6.2 — Endurecer el triggering (después de 6.1)

6. Con la versión ya canónica, correr el **loop de optimización de descripción** de
   claude.ai con ~20 queries reales de diseño arquitectónico (ej.: "¿separo esto en
   un servicio?", "diseño del esquema de la tabla X", "elegir proveedor de auth",
   "límite de dominio entre A y B"), para que la `description` dispare el skill en la
   fase de diseño y no en implementación trivial.

## Done (verificable)

- El skill en claude.ai tiene `SKILL.md` y `references/architecture.md` idénticos al repo.
- No existe `references/stack-overlay.md` en el skill.
- Cero contenido de stack específico (solo punteros).
- La `description` fue optimizada y dispara en diseño estructural.

## Nota de purga (T5.3)

Ninguno de los duplicados que lista el plan (`product-management:*`, `skill-creator`,
`anthropic-skills:*`, variantes `docx`, `meeting-minutes`, `productivity:memory-management`)
está instalado localmente (`~/.claude/skills/` = 8 Alyp + `graphify`). Si existen del
lado de claude.ai, su desactivación es también manual ahí, con confirmación ítem por ítem.
