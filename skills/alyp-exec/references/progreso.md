# progreso.json — el avance de una corrida, con un solo dueño

`estado.md` es la vista del orquestador: texto libre, una o varias líneas por
tarea, notas. Sirve para reanudar, no para contar. Dos lectores del mismo
`estado.md` dieron 29/41 y 31/41 en la misma corrida (fable-v1, nov-2026),
porque cada uno decidió distinto qué era "aceptada", qué tareas entraban en el
total y cuál de las líneas repetidas valía.

`progreso.json` resuelve eso con una regla: **el número lo escribe el
orquestador, una vez por ola, con `assets/progreso.sh`**. Nadie lo deduce.

## Cuándo se escribe

- Al crear el ledger: `ledger-init.sh` registra la corrida en el índice global
  (sin progreso todavía).
- En **F5**, al cerrar cada ola, y al cerrar el plan (G4).
- Cuando una tarea se bloquea o se desbloquea fuera de una ola.

```sh
sh <skill>/assets/progreso.sh .claude/run/<slug> \
  --total 41 --aceptadas 29 --en-curso 5 --bloqueadas 1 \
  --ola 6 --tarea "T40 · plantillas 33/36" --titulo "Integración Bitrix↔Skill v8"
```

## Qué cuenta

| Campo | Regla |
|---|---|
| `total` | Tareas del **plan** (los contratos previstos). Una tarea correctiva que nace en la corrida (I*) entra al total cuando se emite su contrato. |
| `aceptadas` | Pasaron G1/G2 (y la firma, si es riesgo 2). Una aceptación "con condiciones" abiertas cuenta como `en_curso`. |
| `en_curso` | Tienen contrato emitido y no están aceptadas ni bloqueadas. |
| `bloqueadas` | Esperan algo ajeno a la corrida: una autorización, un tercero, una decisión del usuario. |
| pendientes | No se escribe: `total − aceptadas − en_curso − bloqueadas`. |
| `ola` | La ola en curso o la última cerrada (texto libre: `"6"`, `"G4"`). |
| `tarea_actual` | Una línea: qué está pasando ahora. Sin datos personales ni secretos. |

El script rechaza conteos que no son enteros o cuya suma supera el total.

## Formato (v1)

```json
{"version":1,"plan":"fable-v1","titulo":"…","repo":"/abs/repo","total":41,
 "aceptadas":29,"en_curso":5,"bloqueadas":1,"ola":"6",
 "tarea_actual":"T40 · …","actualizado":"2026-11-10T19:00:00Z"}
```

## Índice global

Cada corrida deja un puntero en `~/.claude/run-index/<cksum de la ruta>.json`
(`${CLAUDE_CONFIG_DIR}` si está definido):

```json
{"version":1,"ledger":"/abs/repo/.claude/run/fable-v1","slug":"fable-v1",
 "repo":"/abs/repo","actualizado":"…"}
```

Un archivo por corrida, escrito con `mv` atómico: dos sesiones que registran a
la vez no se pisan. El mod `agent-steps` lee el índice y el `progreso.json` de
cada corrida, así que el avance se ve desde cualquier proyecto y ventana
(filtrado por proyecto por defecto). Si una corrida no tiene `progreso.json`,
el mod cae a una lectura tolerante de `estado.md` y la marca como **estimada**.

Borrar el ledger no borra el puntero: el mod ignora los punteros cuyo ledger ya
no existe.
