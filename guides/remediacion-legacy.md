# Remediación de estándares en plataforma legacy (modo 3)

Para plataformas existentes que NO cumplen los estándares. Ni greenfield
(alyp-new-project) ni feature normal: primero se decide cuánto estándar
adoptar. Metodología validada en nomi_v3 (2026-07).

## Flujo

1. **Auditar** — repos Alyp: manifest.md regla 3 (standards.yaml → modo audit
   de cada skill en orden de requires → scorecard). Repos no-Alyp: auditar
   contra los checklists por capa de engineering-baseline.md. Output: doc de
   hallazgos en docs/auditorias/AAAA-MM-DD-<tema>.md con veredicto por línea.
2. **Plan de remediación por bloques** — bloques chicos, independientes y
   verificables (un estándar × un área); cada bloque con su verificación
   propia. Regla #0: el plan JAMÁS se autoejecuta (ni dry-run).
3. **Ejecutar por olas** (con visto bueno) — carril normal de ejecución;
   review por bloque. Preferir PRs chicos por bloque sobre un mega-PR.
4. **Sellar** — actualizar standards.yaml + sellos en CLAUDE.md del repo en el
   mismo PR (manifest regla 4).

## Regla boy-scout (para lo NO remediado)

Toda feature nueva sigue el estándar completo; el código existente NO se
reestructura "de paso". Reestructurar es un bloque de remediación explícito
con su propio visto bueno — nunca un efecto colateral de otra tarea.

## Lecciones incorporadas (nomi_v3)

- Harness de ejecución: validación estática solamente antes del visto bueno;
  los args del Workflow se validan con asserts de tipo (bug args-string).
- Placeholders no se asumen: verificar que un archivo "muerto" no tenga
  lógica viva antes de borrarlo (caso employee-file.controller.ts).
- Dual-runtime: clasificar cada módulo (Node/browser) antes de migrar sus
  logs a agenticLogger (caso auditService).
