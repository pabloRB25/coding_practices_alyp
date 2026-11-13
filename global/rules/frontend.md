---
paths:
  - "**/app/**"
  - "**/*.tsx"
  - "**/next.config.*"
  - "**/vercel.json"
---
# Verificación en browser (Chrome DevTools MCP)
<!-- MCP chrome-devtools, scope user, `npx chrome-devtools-mcp@latest` v1.x; tools mcp__chrome-devtools__*: navegar, click/fill, consola, evaluate_script, red, screenshots/snapshots, Lighthouse, performance trace, emulación móvil, heap snapshots. -->

- Tras push a develop, navegá la URL del preview de Vercel, ejecutá los flujos reales y leé consola y red: caza lo que `pnpm test` no ve (server actions 500, `export type` en `'use server'`, logger en browser, hidratación).
- Es el complemento de `verification-before-completion`: evidencia en el navegador (screenshot + consola limpia + status 200) antes de promover a staging/main.
- Controla un Chrome real con sesiones: no abras flujos destructivos en PROD sin OK explícito; preferí DEV/preview. Las categorías Third-Party y WebMCP quedan apagadas por defecto.
- Screenshots y snapshots consumen contexto: usalo puntual, no en loop.
