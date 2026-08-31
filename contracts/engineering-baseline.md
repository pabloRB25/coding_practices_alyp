# Contrato: línea base de ingeniería (engineering-baseline v1)

Línea base **genérica y agnóstica de stack** que todo proyecto y todo agente
debe cumplir. Vocabulario RFC 2119 (MUST/SHOULD/MAY). Los skills `alyp-*` son
**perfiles** de este contrato para next·supabase·vercel — ante conflicto entre
un perfil y este contrato, **el contrato manda**, salvo excepción declarada en
el `standards.yaml` del repo (ver `contracts/manifest.md`, regla 2).

Jerarquía de Definition of Done: los checklists por capa de este contrato son
el **mínimo genérico**; la "definición de done" de `alyp-agentic-standards`
(`pnpm verify` + evidencia reproducible) es su **implementación** en el perfil
next·supabase·vercel. No son dos definiciones: una implementa a la otra.

Estándares que **todo** proyecto y **toda** plataforma debe cumplir —de la base
de datos al web server, de los servicios web a la seguridad y los logins— y
las reglas que un agente de código debe respetar sí o sí al generar software.
Agnóstico de tecnología, verificable, listo para auditar.

Convención RFC 2119: las palabras **MUST** (obligatorio), **SHOULD**
(recomendado) y **MAY** (opcional) se usan con el significado del RFC
2119/8174. **MUST** es un requisito no negociable cuyo incumplimiento bloquea
el merge o el release. **SHOULD** es una práctica esperada por defecto que
solo se omite con justificación explícita y documentada (ADR). **MAY** es una
buena práctica aplicable según contexto, escala o madurez del proyecto.

## 00 Cómo usar este handbook

Este documento es una **línea base de cumplimiento**: el mínimo común que toda
plataforma debe satisfacer para considerar su código "de calidad". Sirve para
tres cosas a la vez: guiar a un agente de código sobre lo que puede y no puede
hacer, dar a los revisores un checklist objetivo para aprobar PRs, y dar a los
stakeholders una definición compartida de "hecho".

### Principios rectores

- **MUST** — **La seguridad y la corrección no son negociables.** Ninguna
  regla de estilo, velocidad o conveniencia justifica introducir una
  vulnerabilidad, perder datos o romper el contrato público de una interfaz.
- **MUST** — **Todo cambio debe ser verificable.** Si no se puede probar,
  medir o revisar, no está terminado. Cada regla de este handbook está
  redactada para ser auditable.
- **SHOULD** — **Simplicidad sobre astucia.** Se prefiere el código aburrido,
  explícito y legible al código ingenioso. El costo dominante del software es
  su lectura y mantenimiento, no su escritura.
- **SHOULD** — **Las excepciones se documentan, no se esconden.** Desviarse de
  un `SHOULD` requiere una nota o un ADR que explique el porqué.

> **Convención RFC 2119.** Las palabras **MUST** (obligatorio), **SHOULD**
> (recomendado) y **MAY** (opcional) se usan con el significado del RFC
> 2119/8174. Es el mismo vocabulario que usan los estándares de IETF, OWASP y
> NIST citados aquí.

## 01 Código agéntico (AI coding agents)

Reglas que un agente de código (Claude Code, Cursor, Copilot, Antigravity,
etc.) debe respetar **sí o sí** al generar, modificar o desplegar software, y
cómo debe configurarse el repositorio para gobernarlo. El agente amplifica lo
bueno y lo malo: sin barandas, produce deuda técnica y superficie de ataque a
gran velocidad.

### Contexto y gobierno del agente

- **MUST** — Cada repositorio debe incluir un archivo `AGENTS.md` (y/o
  `CLAUDE.md`) en la raíz con: overview del proyecto, comandos de
  build/test/lint, convenciones de estilo, consideraciones de seguridad y
  reglas de PR. Es el "README para agentes" y es el estándar abierto adoptado
  por 20+ plataformas.
- **SHOULD** — En monorepos, colocar un `AGENTS.md` anidado por subproyecto.
  El más cercano al archivo editado tiene **precedencia**; una instrucción
  explícita del usuario siempre gana sobre la documentación.
- **MUST** — El agente debe operar sobre una rama, nunca commitear directo a
  la rama por defecto, y abrir un Pull Request para revisión humana. Todo
  código generado por IA pasa por **revisión humana** antes de mergear.
- **MUST** — El agente no debe exfiltrar, imprimir ni commitear secretos (API
  keys, tokens, credenciales, PII). Los secretos viven en gestores de secretos
  / variables de entorno, jamás en el código ni en los logs.

### Comportamiento durante la generación

- **MUST** — **Trabajo verificado, no alucinado.** El agente debe ejecutar
  build, tests y linters antes de declarar una tarea completa, y no inventar
  APIs, dependencias o rutas de archivo que no existen.
- **SHOULD** — Preferir **cambios pequeños y atómicos** con diffs revisables
  sobre reescrituras masivas. Un PR gigante generado por IA es casi imposible
  de auditar.
- **SHOULD** — Reutilizar el código y los patrones existentes del proyecto
  antes de introducir nuevas dependencias o abstracciones. Respetar la
  arquitectura vigente.
- **MUST** — Toda dependencia nueva sugerida por el agente debe ser
  verificada: que exista, que esté mantenida, que su licencia sea compatible
  y que no sea un paquete "alucinado" (riesgo de *slopsquatting*).
- **MAY** — Usar el agente para tareas de alto apalancamiento con bajo riesgo:
  tests, documentación, refactors mecánicos, migraciones repetitivas,
  boilerplate.

### Seguridad de sistemas agénticos autónomos

Si construyes plataformas **con** agentes (que planifican, usan herramientas
y actúan), aplica el **OWASP Top 10 for Agentic Applications (2026)**. Las
contramedidas transversales: menor privilegio por herramienta, aprobación
humana para acciones de alto impacto, sandboxing, identidades efímeras y
trazabilidad inmutable.

| Código | Riesgo | Descripción |
|---|---|---|
| ASI01 | Goal Hijacking | Instrucciones maliciosas ocultas en documentos, correos o salidas de herramientas desvían al agente. Trata toda entrada natural como no confiable. |
| ASI02 | Tool Misuse & Exploitation | Encadenar herramientas de forma destructiva. Menor privilegio por tool, aprobación por acción, sandbox, rate limits. |
| ASI03 | Identity & Privilege Abuse | Agentes sobre-privilegiados / confused deputy. Tokens efímeros y con scope por tarea; checks de política centralizados. |
| ASI04 | Agentic Supply Chain | Tools, datasets y templates cargados en runtime con código oculto. Manifiestos firmados, SBOM, allowlists, versiones fijadas. |
| ASI05 | Unexpected Code Execution | Código auto-generado que compromete el host. Trátalo como no confiable, prohíbe `eval` crudo, sandbox restringido. |
| ASI06 | Memory & Context Poisoning | Envenenamiento de RAG y memoria a largo plazo. Cifrado, escaneo de escrituras, segmentación por tenant, versionado y rollback. |
| ASI07 | Insecure Inter-Agent Comms | Canales sin cifrar/autenticar. E2E encryption, autenticación mutua, firma de mensajes, defensa anti-replay. |
| ASI08 | Cascading Failures | Un fallo se propaga entre agentes y sistemas. Zero-trust, circuit breakers, blast radius acotado, planning separado de ejecución. |
| ASI09 | Human-Agent Trust Exploitation | Exceso de confianza humana en el agente. Aprobaciones multi-paso, logs inmutables, separar "preview" de "efecto". |
| ASI10 | Rogue Agents | Agentes comprometidos o desalineados. Gobernanza fuerte, watchdogs, kill switches y revocación rápida de credenciales. |

> **Regla de oro agéntica.** Cualquier acción irreversible o de alto impacto
> (borrar datos, mover dinero, desplegar a producción, enviar comunicaciones
> externas) requiere **human-in-the-loop**: preview + aprobación explícita.
> El agente propone; un humano dispone.

**Checklist — Código agéntico**
- [ ] Existe `AGENTS.md`/`CLAUDE.md` con build, test, estilo, seguridad y reglas de PR.
- [ ] El agente trabaja en rama + PR; ningún cambio se mergea sin revisión humana.
- [ ] Build, tests y linters pasan antes de declarar la tarea completa.
- [ ] Cero secretos en código, commits o logs.
- [ ] Dependencias nuevas verificadas (existen, mantenidas, licencia OK).
- [ ] Acciones irreversibles requieren aprobación humana explícita.

## 02 Arquitectura

La arquitectura es el conjunto de decisiones difíciles de revertir. El
objetivo no es "la arquitectura perfecta" sino una que sea **modular,
testeable, observable y evolutiva**. Estos principios aplican desde un
monolito hasta microservicios.

### Fundamentos que toda plataforma debe cumplir

- **MUST** — **Separación de responsabilidades por capas.** Presentación,
  lógica de dominio y acceso a datos deben estar desacoplados. La lógica de
  negocio no debe depender del framework web ni del motor de base de datos
  (Clean / Hexagonal Architecture: las dependencias apuntan hacia el
  dominio).
- **MUST** — **Twelve-Factor App.** Config por entorno vía variables de
  entorno; dependencias declaradas explícitamente; procesos *stateless*;
  paridad dev/prod; logs como flujo de eventos a stdout. Sin esto no hay
  portabilidad ni escalado horizontal fiable.
- **SHOULD** — **SOLID** como guía de diseño de módulos: responsabilidad
  única, abierto/cerrado, sustitución de Liskov, segregación de interfaces e
  inversión de dependencias. Alta cohesión, bajo acoplamiento.
- **SHOULD** — **Diseño guiado por el dominio (DDD) ligero.** Un lenguaje
  ubicuo compartido con negocio y límites de contexto (bounded contexts)
  claros evitan el "big ball of mud".
- **SHOULD** — Empezar con un **monolito modular** bien delimitado. Extraer
  microservicios solo cuando exista una razón real (escalado independiente,
  equipos autónomos), no por moda. La complejidad distribuida se paga cara.

### Resiliencia y operación

- **MUST** — Las operaciones que se pueden reintentar deben ser
  **idempotentes**. Las llamadas de red deben tener **timeouts** y una
  política de **reintentos con backoff exponencial + jitter**.
- **SHOULD** — Aislar fallos con **circuit breakers**, *bulkheads* y
  degradación elegante. Un servicio caído no debe tumbar a todo el sistema
  (evitar fallos en cascada).
- **MUST** — Diseñar para **fallar de forma segura**: ante error, denegar por
  defecto (fail-closed) en decisiones de seguridad; nunca dejar el sistema en
  estado inconsistente.
- **SHOULD** — Documentar las decisiones estructurales con **ADRs**
  (Architecture Decision Records) y describir el sistema con el **modelo C4**
  (Contexto, Contenedores, Componentes, Código) o **arc42**.

> **Regla de reversibilidad.** Prefiere decisiones reversibles (puertas de
> "dos vías") y tómalas rápido; invierte tiempo de análisis solo en las
> irreversibles (puertas de "una vía"): esquema de datos, contrato público de
> API, elección de proveedor de identidad.

**Checklist — Arquitectura**
- [ ] Capas desacopladas; el dominio no depende del framework ni de la DB.
- [ ] Config por entorno, procesos stateless, logs a stdout (12-Factor).
- [ ] Operaciones críticas idempotentes; timeouts + retries con backoff.
- [ ] Circuit breakers / degradación elegante ante dependencias caídas.
- [ ] Decisiones estructurales registradas en ADRs; diagrama C4/arc42 vigente.

## 03 Base de datos

La base de datos suele sobrevivir a varias generaciones de la aplicación: es
la decisión más costosa de revertir. Modelo correcto, integridad garantizada
por el motor, migraciones versionadas y protección de datos sensibles.

### Modelado e integridad

- **MUST** — Toda tabla debe tener una **clave primaria** explícita. Usar
  identificadores estables (UUID/ULID o secuencias); evitar exponer IDs
  incrementales predecibles en URLs públicas.
- **MUST** — La **integridad referencial** se garantiza en el motor con
  **foreign keys** y constraints (`NOT NULL`, `UNIQUE`, `CHECK`). No delegar
  la integridad únicamente a la aplicación.
- **SHOULD** — Normalizar hasta **3FN** como base; desnormalizar
  deliberadamente solo por razones de rendimiento medidas y documentadas.
- **MUST** — Las escrituras que abarcan varias tablas deben ejecutarse dentro
  de **transacciones** con el nivel de aislamiento adecuado (propiedades
  ACID). Nada de estados intermedios visibles.
- **SHOULD** — Incluir columnas de auditoría estándar: `created_at`,
  `updated_at` (UTC) y, cuando aplique, `created_by` y *soft delete*
  (`deleted_at`).

### Rendimiento

- **MUST** — **Indexar** las columnas usadas en `JOIN`, `WHERE` y `ORDER BY`
  de consultas frecuentes; toda foreign key debe tener índice. Verificar con
  planes de ejecución (`EXPLAIN`).
- **MUST** — Prohibido el **N+1**: usar carga por lotes / *eager loading*.
  Toda consulta que devuelve colecciones debe paginarse.
- **SHOULD** — Evitar `SELECT *` en código de producción; seleccionar
  columnas explícitas. Fijar *connection pooling* y límites de conexiones.

### Migraciones y protección de datos

- **MUST** — Todo cambio de esquema se hace por **migraciones versionadas**
  en control de código, reproducibles y con estrategia de rollback. Nunca
  editar el esquema de producción a mano.
- **MUST** — Las consultas deben usar **sentencias parametrizadas** /
  consultas preparadas. La concatenación de SQL está prohibida (previene
  inyección, OWASP A03).
- **MUST** — Datos sensibles y PII: **cifrado en reposo y en tránsito**. Los
  secretos y contraseñas nunca se guardan en texto plano (ver §07).
- **SHOULD** — **Backups** automáticos con retención definida y
  **restauración probada** periódicamente. Un backup no verificado no es un
  backup. Aplicar menor privilegio a las cuentas de base de datos.

**Checklist — Base de datos**
- [ ] PK explícita, FKs y constraints (NOT NULL/UNIQUE/CHECK) en el motor.
- [ ] Escrituras multi-tabla en transacciones ACID; columnas de auditoría.
- [ ] Índices en JOIN/WHERE/ORDER BY y en toda FK; sin N+1; colecciones paginadas.
- [ ] Migraciones versionadas con rollback; sin cambios manuales en prod.
- [ ] Queries parametrizadas; PII cifrada; backups con restore probado.

## 04 Web servers e infraestructura

El servidor y su entorno de ejecución son la primera línea de exposición.
Aquí se cumple el hardening, el cifrado de transporte, la configuración
segura y la capacidad de escalar y recuperarse.

### Transporte y hardening

- **MUST** — **TLS en todo** (HTTPS obligatorio). Redirigir HTTP→HTTPS,
  habilitar **HSTS**, usar versiones y cifrados vigentes (TLS 1.2+/1.3), y
  renovar certificados automáticamente.
- **MUST** — Enviar **cabeceras de seguridad**: `Content-Security-Policy`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Strict-Transport-Security` y `Permissions-Policy`.
- **MUST** — **Deshabilitar por defecto** lo innecesario: listados de
  directorios, páginas de error verbosas, banners de versión, endpoints de
  administración expuestos y métodos HTTP no usados (mitiga OWASP A05
  Security Misconfiguration).
- **SHOULD** — Colocar la aplicación detrás de un **reverse proxy / WAF** con
  **rate limiting** y protección DDoS. Aplicar el principio de menor
  superficie: solo los puertos necesarios abiertos.

### Ejecución, escalado y recuperación

- **MUST** — Los procesos de aplicación deben ejecutarse como usuario sin
  privilegios (no root) y, preferentemente, en **contenedores** con imágenes
  mínimas y escaneadas.
- **SHOULD** — **Infraestructura como código** (Terraform/equivalente):
  entornos reproducibles y versionados. Nada de servidores "mascota"
  configurados a mano.
- **SHOULD** — Exponer **health checks** (liveness/readiness) y diseñar para
  escalado horizontal sin estado. Configurar límites de CPU/memoria y
  autoscaling.
- **SHOULD** — Definir objetivos de **RTO/RPO** y un plan de recuperación
  ante desastres probado. Separar entornos (dev/staging/prod) con
  credenciales distintas.

> **Config fuera del artefacto.** El mismo build debe poder desplegarse en
> cualquier entorno cambiando solo variables de entorno (12-Factor). Un
> artefacto por entorno es un antipatrón.

**Checklist — Web servers / Infra**
- [ ] HTTPS + HSTS forzados; TLS 1.2+/1.3; certs auto-renovados.
- [ ] Cabeceras de seguridad (CSP, nosniff, HSTS, Referrer/Permissions-Policy).
- [ ] Sin listados de directorios, banners ni endpoints de admin expuestos.
- [ ] Procesos no-root en contenedores mínimos; IaC versionada.
- [ ] Health checks, autoscaling, rate limiting/WAF; DR con RTO/RPO.

## 05 Web services y APIs

La API es el contrato público de la plataforma. Debe ser predecible,
versionada, documentada y defensiva. Estas reglas siguen las guías de diseño
de Google, Microsoft y Zalando, y la semántica HTTP estándar.

### Diseño del contrato

- **MUST** — **Contract-first.** Toda API HTTP se especifica con **OpenAPI**
  (REST) o el schema equivalente (GraphQL/gRPC) *antes* de implementarla, y
  la spec es la fuente de verdad.
- **MUST** — **Versionado explícito** (p. ej. `/v1/`). Un cambio incompatible
  debe incrementar la versión mayor; nunca romper clientes existentes en
  silencio.
- **SHOULD** — Recursos en **plural y sustantivos** (`/users/{id}/orders`),
  no verbos. Los verbos los aporta el método HTTP. Nomenclatura consistente
  (kebab-case o snake_case, elige uno).
- **MUST** — Usar los **métodos y códigos de estado HTTP correctamente**:
  `GET` seguro e idempotente; `PUT`/`DELETE` idempotentes; `2xx` éxito, `4xx`
  error del cliente, `5xx` error del servidor.
- **SHOULD** — Los errores se devuelven en un formato consistente y legible
  por máquina: **Problem Details** (RFC 9457, `application/problem+json`).
  Nunca filtrar stack traces al cliente.

### Robustez y evolución

- **MUST** — **Validar y sanear toda entrada** en el borde del servicio
  (tipos, rangos, longitudes, formato). No confiar en la validación del
  cliente.
- **MUST** — Las colecciones deben soportar **paginación** (cursor o
  offset), y las APIs públicas deben aplicar **rate limiting** y cuotas
  (OWASP API4: Unrestricted Resource Consumption).
- **SHOULD** — Soportar **idempotency keys** en operaciones de
  creación/pago para reintentos seguros. Ofrecer **filtrado, orden y
  selección de campos** de forma estandarizada.
- **SHOULD** — **Evolución compatible:** agregar campos opcionales, nunca
  eliminar/renombrar los existentes dentro de una versión. Marcar como
  *deprecated* con periodo de gracia y comunicación.
- **MAY** — Para integraciones dirigidas por eventos, preferir contratos
  asíncronos versionados (colas/eventos) con esquemas explícitos y entrega
  al menos una vez + consumidores idempotentes.

> **Autorización por objeto.** El fallo #1 de APIs (OWASP API1: Broken
> Object Level Authorization) es no verificar que el usuario tenga permiso
> *sobre el recurso concreto* que pide. Valida propiedad/permiso en **cada**
> acceso a un objeto por su ID. Ver §06/§07.

**Checklist — APIs**
- [ ] Spec OpenAPI/equivalente como fuente de verdad; contract-first.
- [ ] Versionado explícito; sin cambios incompatibles dentro de una versión.
- [ ] Métodos/códigos HTTP correctos; errores en formato Problem Details.
- [ ] Validación de entrada en el borde; paginación + rate limiting.
- [ ] Autorización a nivel de objeto verificada en cada acceso por ID.

## 06 Seguridad

La seguridad es transversal y se diseña desde el inicio (*secure by design*,
*shift-left*), no se parcha al final. La referencia normativa es **OWASP**
(Top 10, API Top 10, ASVS) y, para plataformas con IA, el OWASP Top 10 for
LLM Applications.

### Principios base

- **MUST** — **Menor privilegio** y **denegar por defecto** en todo:
  usuarios, servicios, tokens y cuentas de base de datos reciben solo los
  permisos mínimos necesarios.
- **MUST** — **Defensa en profundidad:** nunca confiar en un solo control.
  Validar en servidor aunque el cliente ya valide; nunca confiar en datos que
  vienen del usuario.
- **MUST** — **Gestión de secretos:** credenciales en un gestor de secretos
  (Vault/KMS/variables de entorno), rotables, nunca en el repositorio.
  Escaneo de secretos en CI.
- **MUST** — **Dependencias:** escaneo continuo de vulnerabilidades (SCA),
  actualización de componentes desactualizados y generación de **SBOM**.
  Mitiga OWASP A06.

### OWASP Top 10 (Web · 2021) — cobertura obligatoria

| Código | Riesgo | Control clave |
|---|---|---|
| A01 | Broken Access Control | Autorización servidor-side en cada request; denegar por defecto. |
| A02 | Cryptographic Failures | Cifrado fuerte en tránsito y reposo; sin algoritmos obsoletos. |
| A03 | Injection | Consultas parametrizadas; validación/escape de toda entrada. |
| A04 | Insecure Design | Threat modeling y controles desde el diseño. |
| A05 | Security Misconfiguration | Hardening, defaults seguros, sin servicios de más. |
| A06 | Vulnerable Components | SCA, parches, SBOM, versiones soportadas. |
| A07 | Auth Failures | Auth robusta, anti-fuerza bruta, sesiones seguras (§07). |
| A08 | Integrity Failures | Firmas, verificación de artefactos, CI/CD confiable. |
| A09 | Logging & Monitoring | Registrar eventos de seguridad y alertar (§10). |
| A10 | SSRF | Validar/allowlist de URLs; bloquear acceso a metadata interna. |

### OWASP API Security Top 10 (2023) — para servicios

| Código | Riesgo | Control clave |
|---|---|---|
| API1 | Broken Object Level Authorization | Verificar permiso sobre el objeto concreto en cada acceso por ID. |
| API2 | Broken Authentication | Auth correcta, tokens robustos, anti-brute-force (§07). |
| API3 | Broken Object Property Level Auth | Sin excessive data exposure ni mass assignment; allowlist de campos. |
| API4 | Unrestricted Resource Consumption | Rate limiting, cuotas, timeouts, límites de payload. |
| API5 | Broken Function Level Authorization | RBAC/ABAC coherente por endpoint y rol. |
| API6 | Unrestricted Access to Business Flows | Proteger flujos sensibles contra abuso automatizado. |
| API7 | Server-Side Request Forgery | Validar/allowlist URIs suministradas por el usuario. |
| API8 | Security Misconfiguration | Hardening, headers, CORS restrictivo. |
| API9 | Improper Inventory Management | Inventario y versionado de endpoints; retirar los antiguos. |
| API10 | Unsafe Consumption of APIs | No confiar ciegamente en APIs de terceros; validar sus respuestas. |

> **Plataformas con IA/LLM.** Si el producto usa modelos, cubre además el
> **OWASP Top 10 for LLM Applications (2025)**: **LLM01** Prompt Injection,
> **LLM02** Sensitive Information Disclosure, **LLM05** Improper Output
> Handling, **LLM06** Excessive Agency y **LLM10** Unbounded Consumption son
> los de mayor impacto. Toda salida del modelo se trata como entrada no
> confiable.

- **SHOULD** — Adoptar un **SDLC seguro**: threat modeling en diseño,
  SAST/DAST en CI, revisiones de seguridad en PRs de riesgo, y pruebas de
  penetración periódicas. Alinear el nivel de rigor con **OWASP ASVS**.
- **MUST** — Tener un **plan de respuesta a incidentes** y un canal de
  *responsible disclosure*. Cumplir la normativa de privacidad aplicable
  (p. ej. GDPR/LGPD): minimización de datos y base legal.

**Checklist — Seguridad**
- [ ] Menor privilegio + denegar por defecto en usuarios, tokens y servicios.
- [ ] Secretos en gestor de secretos; escaneo de secretos y SCA/SBOM en CI.
- [ ] Cobertura demostrable del OWASP Top 10 (web) y API Top 10.
- [ ] SAST/DAST en CI; threat modeling en diseño; nivel ASVS definido.
- [ ] Plan de respuesta a incidentes y cumplimiento de privacidad.

## 07 Autenticación & logins

Autenticar (quién eres) y autorizar (qué puedes hacer) son distintos y ambos
deben ser fuertes. La referencia son **NIST SP 800-63B-4** para credenciales
y **OAuth 2.1 / OpenID Connect** para delegación e identidad federada.

### Contraseñas y credenciales (NIST 800-63B rev.4)

- **MUST** — Longitud mínima **8** caracteres (y **15** cuando la contraseña
  es el único factor). Permitir **hasta ≥64** caracteres y todo el rango
  imprimible (incluidos espacios y Unicode).
- **MUST** — Verificar contra un **blocklist** de contraseñas filtradas,
  comunes, palabras de diccionario y patrones repetitivos/secuenciales.
  Rechazar las que aparezcan.
- **MUST** — Prohibido forzar cambios periódicos de contraseña y prohibido
  imponer reglas de composición (mayúsculas/números/símbolos). Solo forzar
  cambio ante evidencia de compromiso.
- **MUST** — Almacenar contraseñas con un algoritmo de **hashing lento y
  salado** diseñado para ello: **Argon2id** (preferido), **scrypt** o
  **bcrypt**. Jamás en texto plano, MD5 o SHA simple.

### MFA, sesiones y tokens

- **MUST** — Ofrecer y, para accesos privilegiados, **exigir MFA**. Preferir
  factores **resistentes a phishing** (WebAuthn/Passkeys, FIDO2) sobre OTP
  por SMS.
- **MUST** — Protección contra fuerza bruta: **rate limiting**,
  bloqueo/backoff progresivo y detección de *credential stuffing*. Mensajes
  de error genéricos que no revelen si el usuario existe.
- **MUST** — Cookies de sesión con `HttpOnly`, `Secure` y `SameSite`;
  regenerar el ID de sesión tras el login; expiración por inactividad y
  logout que invalida la sesión en el servidor.
- **SHOULD** — Si se usan **JWT**: firmar con algoritmos fuertes (rechazar
  `alg:none`), tiempos de vida cortos, validar `iss`/`aud`/`exp`, y usar
  **refresh tokens rotatorios**. No guardar datos sensibles en el payload.

### Federación (OAuth 2.1 / OIDC)

- **MUST** — **PKCE obligatorio** para todos los clientes con Authorization
  Code Flow, y **coincidencia exacta** de la redirect URI (string matching).
- **MUST** — Grants **Implicit** y **Resource Owner Password Credentials**
  están **eliminados** en OAuth 2.1: no usarlos. Los bearer tokens nunca van
  en el query string de la URL.
- **SHOULD** — Refresh tokens de clientes públicos: **sender-constrained** o
  de un solo uso (rotación). Delegar la identidad a un IdP probado antes que
  construir auth propia.

> **Authorization ≠ Authentication.** Autenticar al usuario no basta: cada
> acción debe verificar *autorización* (rol + propiedad del recurso) en el
> servidor. RBAC/ABAC coherente. Es el origen de la mayoría de brechas de
> acceso.

**Checklist — Auth & logins**
- [ ] Contraseñas: mín. 8/15, hasta ≥64, blocklist, sin caducidad ni reglas de composición.
- [ ] Hashing con Argon2id/scrypt/bcrypt; nunca texto plano.
- [ ] MFA disponible/obligatorio; preferencia por passkeys/WebAuthn.
- [ ] Anti-brute-force, cookies HttpOnly/Secure/SameSite, sesiones regeneradas.
- [ ] OAuth 2.1: PKCE, redirect exacta, sin Implicit/ROPC; JWT validados.
- [ ] Autorización (rol + propiedad) verificada server-side en cada acción.

## 08 Nomenclatura

Los nombres son la documentación más leída del sistema. La regla maestra:
**consistencia** dentro de cada dominio y **revelar la intención**. Elige una
convención por contexto y aplícala sin excepciones.

| Contexto | Convención estándar | Ejemplo |
|---|---|---|
| Variables / funciones (código) | Según el lenguaje: `camelCase` (JS/Java) o `snake_case` (Python/Ruby) | `getUserById` · `calcular_total` |
| Clases / tipos | `PascalCase` | `InvoiceService` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Tablas / columnas DB | `snake_case`, tablas en plural, columnas descriptivas | `order_items.unit_price` |
| Endpoints REST | Sustantivos en plural, `kebab-case` en la ruta | `/v1/user-profiles` |
| Campos JSON | `camelCase` o `snake_case` (uno, consistente) | `createdAt` |
| Variables de entorno | `UPPER_SNAKE_CASE` con prefijo de app | `APP_DB_URL` |
| Archivos / carpetas | `kebab-case` (o la convención del framework) | `user-profile.service.ts` |
| Ramas Git | `tipo/descripcion-corta` | `feat/login-passkeys` |
| Commits | **Conventional Commits** | `fix(auth): validar exp del JWT` |

- **MUST** — Nombres **descriptivos y pronunciables**, sin abreviaturas
  crípticas ni números mágicos. El nombre debe decir *qué* es o *qué* hace,
  no *cómo*.
- **MUST** — **Un idioma** para los identificadores en todo el codebase
  (inglés por defecto en código técnico). No mezclar español/inglés en el
  mismo dominio.
- **SHOULD** — Booleanos con prefijo de predicado (`is`, `has`, `can`);
  funciones con verbos; colecciones en plural. Evitar negaciones dobles
  (`isNotDisabled`).
- **SHOULD** — Aplicar la convención con **linters/formatters** automáticos
  (§10) para que sea imposible desviarse en un PR.

**Checklist — Nomenclatura**
- [ ] Convención definida y consistente por contexto (código, DB, API, env, git).
- [ ] Nombres descriptivos, sin abreviaturas crípticas ni números mágicos.
- [ ] Un solo idioma para identificadores en todo el codebase.
- [ ] Convención impuesta por linter/formatter automático.

## 09 Documentación

La documentación viable es la que vive con el código y se mantiene sola
donde es posible. **Docs-as-code**: versionada, revisada en PRs y generada
desde la fuente cuando aplica. Documentar decisiones y "por qué", no solo el
"qué".

- **MUST** — Todo repo debe tener un **README** con: qué es, cómo
  instalar/correr, cómo probar, cómo desplegar y a quién contactar. Debe
  permitir a alguien nuevo arrancar el proyecto sin ayuda.
- **MUST** — Las APIs se documentan con su **spec OpenAPI/schema** como
  fuente de verdad, publicada y siempre sincronizada con la implementación.
- **SHOULD** — Registrar decisiones de arquitectura con **ADRs** (contexto,
  decisión, consecuencias) y mantener diagramas **C4**/arc42 del sistema.
- **SHOULD** — Mantener un **CHANGELOG** (estilo *Keep a Changelog*) y
  **runbooks** operativos para incidentes comunes (cómo reiniciar, restaurar,
  rotar credenciales).
- **SHOULD** — Comentar el **porqué**, no el **qué**. El código explica el
  "cómo"; los comentarios explican decisiones no obvias. Documentación de API
  a nivel de función donde aporte valor.
- **MAY** — Publicar un portal de documentación (docs site) generado desde
  el repo para consumo interno y de clientes.

> **Prueba del recién llegado.** Una persona nueva debe poder clonar,
> instalar, correr los tests y entender la arquitectura solo con la
> documentación del repo. Si no puede, la documentación está incompleta.

**Checklist — Documentación**
- [ ] README completo (qué, instalar, correr, probar, desplegar, contacto).
- [ ] Spec OpenAPI/schema publicada y sincronizada con el código.
- [ ] ADRs y diagramas C4/arc42 vigentes.
- [ ] CHANGELOG y runbooks operativos actualizados.

## 10 Calidad de código y entrega

Calidad significa que el software es correcto, mantenible y observable, y que
se puede entregar de forma frecuente y segura. Se mide (DORA), se automatiza
(CI/CD) y se instrumenta (observabilidad).

### Pruebas y revisión

- **MUST** — **Pirámide de pruebas:** muchas unitarias rápidas, menos de
  integración, pocas end-to-end. Toda lógica de negocio y todo bug corregido
  debe tener pruebas automatizadas.
- **MUST** — Todo cambio pasa por **Pull Request con revisión** de al menos
  otra persona (o revisión humana si lo generó un agente). El CI debe estar
  en verde para poder mergear.
- **SHOULD** — Definir un umbral de **cobertura** significativo y vigilar su
  tendencia (la cobertura es señal, no meta). Priorizar cubrir caminos
  críticos y de error.
- **MUST** — **Linter + formatter** automáticos ejecutados en CI y en
  pre-commit. El estilo no se discute en revisiones: lo impone la
  herramienta.

### Control de versiones y entrega

- **MUST** — **Conventional Commits** para mensajes y **Semantic Versioning
  (SemVer)** para releases (MAJOR.MINOR.PATCH). Un breaking change debe subir
  la versión mayor.
- **MUST** — **CI/CD automatizado:** build, test, análisis y despliegue
  reproducibles. Nada de despliegues manuales desde una laptop. Rollback
  rápido disponible.
- **SHOULD** — Estrategia de branching simple (trunk-based o similar), ramas
  de vida corta y **feature flags** para desacoplar despliegue de
  liberación.

### Observabilidad y métricas

- **MUST** — Instrumentar los **tres pilares** —**logs** estructurados,
  **métricas** y **trazas**— preferentemente con **OpenTelemetry**. Logs sin
  PII ni secretos, con correlación por request/trace ID.
- **MUST** — Registrar y **alertar** sobre eventos de seguridad y errores
  (OWASP A09). Definir SLIs/SLOs para lo que le importa al usuario.
- **SHOULD** — Medir la salud de entrega con las **4 métricas DORA**
  —frecuencia de despliegue, lead time de cambios, tasa de fallo de cambios y
  tiempo de restauración— más fiabilidad, y usarlas para mejorar, no para
  castigar.

**Checklist — Calidad & entrega**
- [ ] Pirámide de pruebas; toda lógica y todo bug con test automatizado.
- [ ] PR con revisión + CI en verde obligatorio para mergear.
- [ ] Linter/formatter en CI y pre-commit; cobertura vigilada.
- [ ] Conventional Commits + SemVer; CI/CD con rollback rápido.
- [ ] Logs/métricas/trazas (OTel), alertas de seguridad, SLOs y DORA.

## 11 Definition of Done — checklist maestro de PR

El filtro único antes de mergear cualquier cambio. Si algo aquí no se
cumple, el trabajo **no está terminado**. Úsalo tal cual en la plantilla de
Pull Request.

**Definition of Done**
- [ ] **Funciona:** cumple el requisito, con casos límite y de error contemplados.
- [ ] **Probado:** tests automatizados nuevos/actualizados; CI en verde.
- [ ] **Revisado:** aprobado por otra persona (revisión humana si lo generó un agente).
- [ ] **Seguro:** sin secretos; validación de entrada; autorización a nivel de objeto; sin nuevos hallazgos OWASP.
- [ ] **Datos:** cambios de esquema por migración versionada con rollback; queries parametrizadas.
- [ ] **API:** contrato/OpenAPI actualizado; sin cambios incompatibles no versionados.
- [ ] **Estilo:** linter/formatter en verde; nomenclatura consistente.
- [ ] **Observable:** logs/métricas/trazas donde corresponde; sin PII en logs.
- [ ] **Documentado:** README/CHANGELOG/ADR actualizados según el cambio.
- [ ] **Versionado:** Conventional Commit; impacto de versión (SemVer) correcto.
- [ ] **Reversible:** se puede desplegar y revertir sin dejar estado inconsistente.

> **Cómo adoptarlo.** Pega la Definition of Done como plantilla de PR en tu
> repositorio, copia el checklist de cada sección al `AGENTS.md`, y convierte
> los `MUST` en reglas bloqueantes de CI donde sea automatizable (linters,
> escaneo de secretos, SCA, tests, validación de OpenAPI).

## 12 Fuentes y estándares de referencia

**Seguridad**
- [OWASP Top 10 — 2021 (Web Application Security Risks)](https://owasp.org/Top10/2021/)
- [OWASP API Security Top 10 — 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP Top 10 for LLM Applications — 2025](https://genai.owasp.org/llm-top-10/)
- [OWASP Top 10 for Agentic Applications — 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)
- [OWASP ASVS — Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)

**Identidad y autenticación**
- [NIST SP 800-63B-4 — Digital Identity Guidelines (Authentication)](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [OAuth 2.1 Authorization Framework (IETF draft)](https://oauth.net/2.1/)
- [OpenID Connect](https://openid.net/developers/how-connect-works/)

**Arquitectura, APIs y agentes**
- [The Twelve-Factor App](https://12factor.net/)
- [C4 Model](https://c4model.com/) · [arc42](https://arc42.org/) · [Architecture Decision Records](https://adr.github.io/)
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [AGENTS.md — estándar abierto para agentes de código](https://agents.md/)

**Entrega y calidad**
- [Conventional Commits](https://www.conventionalcommits.org/) · [Semantic Versioning](https://semver.org/)
- [DORA — DevOps Research & Assessment (Four Keys)](https://dora.dev/)
- [OpenTelemetry — observabilidad (logs, métricas, trazas)](https://opentelemetry.io/)

Handbook generado el 17 de julio de 2026. Documento vivo: revisa las fuentes
originales para las versiones más recientes, ya que OWASP, NIST e IETF se
actualizan periódicamente.
