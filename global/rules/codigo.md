---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs,py}"
---
# Código

- Los language servers no arrancan en sesiones cloud, solo local y CI: si una sesión cloud no resuelve símbolos, el LSP no está roto, no existe ahí; caé a `grep`/`ast-grep`.
- Código muerto se borra, nunca se comenta ni se archiva (`/old`, `_deprecated`): git es el archivo. Si un cambio deja código sin referencias, eliminalo en el mismo PR.
- Detección y gate de código muerto (knip + capas dinámica/plataforma): canónico en `alyp-agentic-standards` §FASE 4.5.
- Usá `hyperfine` solo cuando la tarea pida comparar rendimiento.
