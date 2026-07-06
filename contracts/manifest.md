# Contrato: manifiesto de estándares (v1)

Cada repo que adopta el ecosistema declara **qué estándares sigue y en qué versión**
en `standards.yaml` (raíz del repo). Ver `standards.example.yaml`.

## Reglas

1. El manifiesto es la fuente de verdad de adopción — los sellos en CLAUDE.md
   (`agentic-standard: v1`, `qa-standard: v1`, `logging-standard: v1`) deben coincidir.
2. Toda excepción a un estándar se declara en `excepciones:` con su porqué. Excepción
   no declarada = incumplimiento, no excepción.
3. Auditoría total de un repo: leer `standards.yaml` → correr el modo audit de cada
   skill declarado, en orden de `requires:` (logging → code → observability → qa) →
   scorecard: cumple / cumple-con-excepciones / drift.
4. Actualizar de versión un estándar = correr el skill en modo audit con la versión
   nueva y actualizar manifiesto + sellos en el mismo PR.
