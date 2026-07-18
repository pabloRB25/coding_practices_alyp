# Migraciones sobre datos vivos (brownfield)

Aplica a todo cambio de esquema en una DB con datos de producción. Complementa
el baseline §03 (migraciones versionadas con rollback). `pnpm verify` NO atrapa
estos errores: la disciplina es de diseño.

## Patrón expand → migrate → contract (obligatorio en breaking changes)

1. **Expand**: agregar lo nuevo sin tocar lo viejo (columna nueva nullable,
   tabla nueva, vista de compatibilidad). Deploy. El código viejo sigue vivo.
2. **Migrate**: backfill por lotes (idempotente, reanudable, con límite de
   filas por lote); doble escritura desde el código nuevo si hay ventana larga.
3. **Contract**: solo cuando NINGÚN código lee lo viejo (verificado, no
   asumido): eliminar columna/tabla vieja en una migración separada y posterior.

## Reglas
- Toda migración destructiva (DROP, tipo incompatible, NOT NULL sobre columna
  poblada) va en su PROPIA migración, nunca mezclada con expand.
- RLS: al crear tabla en expand, sus políticas van en la MISMA migración
  (ventana sin RLS = incidente, no descuido).
- Backward compatibility: entre expand y contract, ambas versiones del código
  deben poder correr contra el mismo esquema (deploys de Vercel conviven).
- Rollback declarado por migración: qué se revierte y qué NO (backfills no se
  des-backfillean: documentar el plan de contingencia en el PR).
- Jamás editar esquema de producción a mano (baseline §03 MUST).
