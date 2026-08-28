---
name: alyp-token-savings
version: 1.0.1
provides: [token-savings]
description: Instala o audita el setup de ahorro de tokens de Claude Code de Alyp Studio en ~/.claude — statusline de contexto (K/% vivo), hook context-guard (aviso no-bloqueante al cruzar 200K), política RTK explícita, y el merge de keys en settings.json. Se instala vía el installer del ecosistema (node scripts/install.mjs, modos --copy/--link) de coding_practices_alyp. Invocar cuando el usuario pida "instalar el ahorro de tokens", "montar la statusline de contexto", "setup de tokens en esta máquina", "auditar el ahorro de tokens", o al configurar una máquina/perfil nuevo de Claude Code.
---

# alyp-token-savings

Parte del ecosistema `coding_practices_alyp`. Monta el setup de optimización de tokens
de Claude Code en `~/.claude`. Idempotente: reinstalar re-sincroniza sin romper config.

## Qué instala

| Artefacto | Destino | Qué hace |
|---|---|---|
| `artifacts/statusline-context.py` | `~/.claude/` | Barra de estado: `modelo · ⛁ NK (P%) · ⎇ rama · $costo`, color 🟢/🟡/🔴 a los 200K |
| `artifacts/hooks/context-guard.py` | `~/.claude/hooks/` | UserPromptSubmit **no-bloqueante**: banda 150K/300K, 1 aviso por tramo por sesión |
| `artifacts/hooks/precompact-preserve.py` | `~/.claude/hooks/` | PreCompact **no-bloqueante**: checklist de preservación + ledger en disco |
| `artifacts/token-audit.sh` | `~/.claude/scripts/` | Mide el consumo real de contexto desde los transcripts |
| `artifacts/RTK.md` | `~/.claude/` | Política: usar `rtk` explícito siempre (el hook PreToolUse no reescribe) |
| keys `statusLine` + `UserPromptSubmit` + `PreCompact` | `~/.claude/settings.json` | Merge preservando lo existente (respalda antes) |

## Cómo instalar

Se instala con el installer del ecosistema — el mismo que monta skills y agentes:

```bash
git clone https://github.com/pabloRB25/coding_practices_alyp.git
cd coding_practices_alyp
node scripts/install.mjs            # universal (macOS · Linux · Windows)
# convenience: ./scripts/install.sh (Unix) · .\scripts\install.ps1 (Windows)
node scripts/install.mjs --link     # symlinks/junctions al repo (dev, cero drift)
```

El `install.mjs` — además de skills + agentes — copia los artefactos de este skill a
`~/.claude`, mergea las keys en `settings.json` (con backup) y valida el JSON.

**En Windows, statusline/hook requieren Python 3 en el PATH** (`python` o `python3`);
el instalador lo detecta y, si falta, saltea el cableado con aviso.

**Después: reiniciá Claude Code** — statusline y hook aplican al reiniciar (no con
`/statusline`, que reconfigura en vez de recargar).

## Cómo auditar (sin reinstalar)

```bash
test -f ~/.claude/statusline-context.py && echo "statusline OK"
test -f ~/.claude/hooks/context-guard.py && echo "hook OK"
# Windows sin Git Bash usa `python`; macOS/Linux `python3`.
PY=$(command -v python3 || command -v python)
"$PY" -c "import json,os;d=json.load(open(os.path.expanduser('~/.claude/settings.json')));\
print('statusLine:', 'statusLine' in d);\
print('ctx-guard:', any('context-guard' in h.get('command','') \
for b in d.get('hooks',{}).get('UserPromptSubmit',[]) for h in b.get('hooks',[])))"
```

## Principios (por qué existe)

- El costo real en sesiones largas es el **cache-read** (todo el prefijo se re-lee cada
  turno, y por cada subagente). La statusline lo hace **visible siempre**; el hook
  recuerda **compactar antes** del premium long-context de Opus [1M] (>200K).
- El hook **nunca bloquea** (`exit 0` siempre): un `exit 2` en UserPromptSubmit cuelga la
  sesión. Solo avisa vía `systemMessage`, throttled por tramo de 100K.
- **RTK explícito**: el hook `PreToolUse` intenta reescribir comandos pero el harness no
  aplica el `updatedInput` de forma confiable (~0.9% cobertura). Por eso la política es
  prependar `rtk` a mano en lecturas/búsquedas/git/build. Aplica al agente y a subagentes.

## Ajustes comunes

- Formato de la statusline → editar `artifacts/statusline-context.py` (sacar costo, mostrar
  tokens exactos en vez de %, cambiar umbrales de color) y reinstalar.
- Umbral del aviso → `THRESHOLD` / `BUCKET` / `HARD_CEILING` en
  `artifacts/hooks/context-guard.py` (default: piso 150K, tramo 150K, techo duro 300K).
- Qué preservar al compactar → `PRESERVAR` en `artifacts/hooks/precompact-preserve.py`.

## Cómo medir si está funcionando

```bash
~/.claude/scripts/token-audit.sh                    # todo el histórico
~/.claude/scripts/token-audit.sh --since 2026-09-01 # desde una fecha
```

La métrica principal es la **altura de compactación**: a qué tamaño de contexto se
compacta en promedio. Medida en agosto 2026 era **388.723 tokens** — plena zona cara.
Objetivo con la banda 150K/300K: **<200K**.

El costo por request escala fuerte con el contexto: $0,059 (50-150K) → $0,127 (150-300K)
→ $0,235 (300-500K) → $0,435 (500-800K). Compactar cerca de 150K rinde **2,6×** más que
dejar correr hasta 300K, así que el escalón de 300K endurece el mensaje en vez de repetirlo.

### Tres trampas del método de medición

1. Extraer con `xargs -P N > archivo` **único corrompe el TSV** (escrituras interleavadas):
   un archivo por proceso.
2. Deduplicar por `requestId` a secas **descarta líneas** — un mensaje del asistente se
   parte en varias entradas JSONL. Para `usage`, dedup por `(requestId, message.id)`;
   para herramientas, contar **IDs únicos de `tool_use`** por request.
3. **Separar `isSidechain` antes de cualquier serie temporal.** Los subagentes corren a
   ~128K y el loop principal a ~266K: mezclarlos produce una serie plana que parece
   compactación automática y no lo es (error cometido y corregido el 2026-08-28).

Y una trampa al analizar comandos: calcular "encadenado" o "`cd` suelto" sobre un comando
**truncado** esconde los `&&` fuera de la ventana. Con 60 caracteres daban 13.229 `cd`
sueltos; con el comando entero, 2.290.
