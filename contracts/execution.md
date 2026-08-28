# Contrato: ejecución de planes (execution v1)

Cablea el proceso de superpowers (subagent-driven-development y afines) con
los roles del protocolo de orquestación (contracts/orchestration.md). El
proceso lo define superpowers; **quién encarna cada rol** lo define esta tabla.
Sobrevive a upgrades del plugin superpowers: ante cambio de templates, la
tabla manda sobre el default genérico.

## Mapeo de roles

| Rol superpowers | Agente Alyp | Modelo | Notas |
|---|---|---|---|
| Implementer subagent | `implementador` | sonnet (default) | template implementer-prompt.md = CONTENIDO del prompt; el agente aporta contexto (RTK, cascada local, estándares) |
| Task reviewer | `revisor` | sonnet | checklist de capa del engineering-baseline según lo tocado |
| **Firmante de contratos (G0)** | `revisor` | **opus** | antes de ejecutar, sobre los contratos de la ola — nunca sobre código. Riesgo ≥1 |
| Final/broad reviewer | `revisor` | **opus** | pre-merge; **firma final, no borrador**; riesgo 2 de a uno y re-ejecutando G1/G2 |
| Code reviewer (requesting-code-review) | `revisor` | según criticidad | el template code-reviewer.md se pasa como cuerpo |
| Investigación / scouting | `explorador` | sonnet (haiku para triage) | preferido sobre el agente genérico `Explore` en repos Alyp |
| Duda decidible / arbitraje | `consultor` | fable (fijo) | paquete cerrado; veredicto ⬆ FABLE |

## Reglas

1. Al ejecutar un plan con subagent-driven-development en un repo Alyp, los
   despachos usan `subagent_type` de esta tabla. Despachar el genérico
   `general-purpose` para estos roles es violación del protocolo.
2. Carriles por tamaño de trabajo y routing de review: definidos en
   devstral-orchestration (secciones "Carriles" y "Routing de review") —
   este contrato no los duplica.
3. `executing-plans` (sesión separada, checkpoints humanos) solo a pedido
   explícito del usuario; el default con subagentes disponibles es
   subagent-driven-development.
4. **El loop que ejecuta el plan es de tier obrero (Sonnet) desde v3.0.** Eso no
   cambia esta tabla salvo en un punto: las filas marcadas **opus** dejan de ser
   "borrador que el orquestador aprueba" y pasan a ser **firma final**. Un loop
   obrero no tiene tier para re-aprobar lo que firmó el razonador. Contrato
   `orchestration` invariantes 2, 8 y 9.
