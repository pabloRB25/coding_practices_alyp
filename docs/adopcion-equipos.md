# Guía de adopción para equipos

Esta guía es para un equipo (interno de Alyp o de un cliente) que va a adoptar
el ecosistema en un repo — nuevo o existente. Si buscás cómo instalar los skills
en Claude Code, ver [`installation.md`](./installation.md). Esta guía es sobre
**qué se adopta y en qué orden**, no sobre mecánica de instalación.

---

## 1. Qué adopta un equipo: los contratos, no el perfil

Lo que este ecosistema versiona de verdad son los **contratos** en `contracts/`:
invariantes agnósticos de stack (`code-standard`, `qa-standard`, `logging-standard`,
`orchestration`, `env-vars`, `manifest`). Cada contrato define un objetivo y una
"aceptación agnóstica" — una lista de condiciones verificables que cualquier
implementación debe cumplir, sin nombrar un producto concreto.

Los **skills** en `skills/` son un **perfil**: una implementación concreta de esos
contratos para el stack Turborepo · Next.js · Supabase · Vercel. Por ejemplo,
`contracts/code-standard.md` dice "debe existir un gate único determinista"; el
perfil `skills/alyp-agentic-standards/` lo implementa como `pnpm verify`
(typecheck + lint + test). Si tu stack no es next·supabase·vercel, no heredás el
perfil — implementás **tu propio perfil** que cumpla la misma aceptación agnóstica
del contrato. El contrato es lo que no negociás; el perfil es reemplazable.

Esto importa para la adopción: un equipo con stack distinto puede adoptar
`contracts/logging-standard.md` (por ejemplo) escribiendo su propio logger que
cumpla las 3 reglas de oro y el schema de claves congeladas, sin usar
`agentic-logging` tal cual. Lo que no puede cambiar son las claves del contrato
(`traceId`, `contexto`, etc. — ver la sección 4).

---

## 2. Orden de adopción en un repo existente

Adoptar todo de golpe en un repo con historia es arriesgado. El orden recomendado
sigue la cadena de dependencias declarada en el frontmatter de los skills
(`requires:`), que es la misma que usa la auditoría de `standards.yaml`
(`contracts/manifest.md`, regla 3):

1. **`agentic-logging`** (contrato `logging-standard`) — primero, porque
   `code-standard` (I8: errores estructurados) y `qa-standard` (oráculo de logs)
   dependen de tener el `traceid-contract` en pie.
2. **`alyp-agentic-standards` en modo `audit`** (contrato `code-standard`) —
   integra la arquitectura por features, el gate `pnpm verify` y el linter de
   fronteras de módulo sin romper lo que ya existe en el repo.
3. **`alyp-observability`** (skill que compone `logging-standard` + configuración OTel, sin contrato congelado propio) — completa la capa de transporte (OTel, Log Drain) sobre
   el logging ya instalado en el paso 1.
4. **`alyp-qa-standard`** (contrato `qa-standard`) — al final, porque su oráculo
   de logs consume el `traceid-contract` (paso 1) y sus flujos ejercitan código
   que ya sigue `code-standard` (paso 2).

El modo `audit` (en contraposición a `bootstrap`) es el que corresponde para
repos existentes: cada skill audita lo que hay e integra sin reescribir lo que
ya funciona. `bootstrap` es para proyectos nuevos creados con `alyp-new-project`,
donde no hay nada previo que preservar.

---

## 3. El manifiesto `standards.yaml` y las excepciones

Cada repo que adopta el ecosistema declara qué estándares sigue y en qué versión
en `standards.yaml`, en la raíz del repo (ver `contracts/standards.example.yaml`
como plantilla). Ejemplo mínimo:

```yaml
ecosistema: 2.0.0
perfil: next-supabase-vercel
estandares:
  code-standard: v1                           # sello en CLAUDE.md: agentic-standard: v1
  logging-standard: v1
  qa-standard: v1
  observability: v1                           # sin sello en CLAUDE.md — compone logging-standard + OTel
excepciones: []
```

El manifiesto es la **fuente de verdad de adopción**: los sellos que aparecen en
`CLAUDE.md` (`agentic-standard: v1`, `qa-standard: v1`, `logging-standard: v1`)
deben coincidir con lo declarado acá. Una auditoría completa del repo es: leer
`standards.yaml`, correr el modo `audit` de cada skill declarado en el orden de
la sección 2, y producir un scorecard de `cumple` / `cumple-con-excepciones` /
`drift`.

**Excepciones**: si tu equipo decide no cumplir una parte de un estándar (por
ejemplo, "sin flujos P2 porque es una app interna sin ventana nocturna"), esa
decisión se declara explícitamente en `excepciones:` junto con su porqué. Una
excepción no declarada no es una excepción — es incumplimiento. Actualizar de
versión un estándar significa correr el skill en modo `audit` con la versión
nueva y actualizar manifiesto + sellos en el mismo PR (regla 4 de
`contracts/manifest.md`).

---

## 4. Decisiones de marca que se heredan (y por qué)

Algunas decisiones del ecosistema **no son parte del perfil** — están congeladas
en el contrato mismo, y se heredan sin negociar aunque cambies de stack:

- **Dominio, logs y códigos de error en español.** El schema del
  `logging-standard` (v1) tiene sus claves congeladas en español:
  `nivel`, `servicio`, `contexto`, `error.mensaje`, `error.codigo`,
  `error.ubicacion_exacta`, etc. Esta no es una preferencia de estilo: es un
  contrato consumido mecánicamente por el extractor `agent-gps` y por el
  oráculo de logs de `qa-standard`. Cambiar una clave es una versión mayor del
  contrato, con período de alias — no un find-and-replace local. Se decidió así
  porque Alyp Studio opera en español con clientes hispanohablantes, y separar
  "el idioma del negocio" del "idioma del contrato técnico" agregaría fricción
  sin beneficio real.
- **Naming `alyp-*` en los skills propios.** Los skills que son perfil de Alyp
  (no contrato agnóstico) llevan el prefijo `alyp-` (`alyp-new-project`,
  `alyp-agentic-standards`, `alyp-observability`, `alyp-qa-standard`,
  `alyp-maestro`) para distinguirlos de skills agnósticos de marca
  (`agentic-logging`, `devstral-orchestration`) que podrían vivir en cualquier
  organización. Un equipo que adopta el ecosistema hereda ese naming en los
  skills que instala tal cual; si escribe su propio perfil para otro stack, no
  está obligado a usar el prefijo `alyp-` (no es su marca), pero sí a mantener
  el contrato subyacente.

---

## 5. Qué es opcional

- **Orquestación local (`devstral-orchestration`).** El protocolo funciona sin
  ejecutor local: en `capacity.yaml`, declarar `local.disponible: false` degrada
  el enrutamiento de tareas mecánicas al tier barato (cloud) en vez de a Ollama.
  Ningún otro skill del ecosistema depende de que la orquestación local esté
  activa.
- **`alyp-maestro`.** Es curaduría de conocimiento local por proyecto — útil,
  pero no requerido por ningún contrato ni por ningún otro skill (`provides:
  [curaduria]`, sin `requires:`). Un equipo puede adoptar los 4 contratos
  centrales (logging, code, observability, qa) sin tocar `alyp-maestro`.
- **Nota Windows**: la instalación del ecosistema (plugin o `node
  scripts/install.mjs`) y la meta-QA (`scripts/lint-skills.mjs`,
  `scripts/canary.mjs`) son cross-platform — corren igual en Windows que en
  macOS/Linux, sin dependencias extra. Lo que sí requiere algo adicional en
  Windows es el **uso** cotidiano de los skills: la herramienta Bash de Claude
  Code necesita Git for Windows (Git Bash) instalado para que los comandos
  POSIX que los skills invocan (`cp`, `grep`, `pnpm`, etc.) funcionen. Y si el
  equipo adopta `alyp-token-savings`, ese skill puntual requiere Python 3 en
  el PATH — es el único skill del ecosistema con esa dependencia. Detalle
  completo en la sección "Requisitos por plataforma" de
  [`installation.md`](./installation.md).

---

## 6. Soporte

Dudas, bugs o propuestas de cambio al ecosistema: abrir un issue en
`alyp-studio/coding_practices_alyp` (el mismo repo). Si el pedido es una
excepción a un contrato para un caso concreto, documentarla primero en el
`standards.yaml` del repo cliente (sección 3) y, si aplica a todo el ecosistema
y no solo a un repo puntual, proponerla como cambio al contrato vía PR a
`develop`.

Problemas específicos de Windows (Git Bash no detectado, `CLAUDE_CODE_GIT_BASH_PATH`,
Python 3 ausente para `alyp-token-savings`): ver "Requisitos por plataforma" en
[`installation.md`](./installation.md) antes de abrir un issue — cubre los
casos conocidos.
