#!/usr/bin/env python3
"""
PreCompact hook — PRESERVAR lo que la compactación se llevaría puesto.

Es la precondición de calidad de la banda 150K/300K: compactar más seguido es
compactar más veces de forma lossy. Sin esto, bajar el umbral duplica la frecuencia
de pérdida de decisiones y de caminos ya descartados — y el síntoma es reintentar
un enfoque que una sesión anterior había rechazado con motivo.

Hace dos cosas, en orden de robustez:

  1. LEDGER EN DISCO (lo único que no depende de nada más). Antes de que el contexto
     se destruya, deja una entrada en <config>/compact-log/<sesión>.md — donde <config>
     es $CLAUDE_CONFIG_DIR o, si no está seteada, ~/.claude — con el momento,
     el trigger y el tamaño del contexto. Sirve para dos cosas: reconstruir qué pasó,
     y MEDIR la altura real de compactación de forma directa — en vez de inferirla
     desde caídas de cache_read, que fue el error de método del 2026-08-27
     (el 89,8% de esas "caídas" eran subagentes intercalados, no compactaciones).

  2. Si la compactación es MANUAL y se disparó sin instrucciones, avisa que
     `/compact <qué preservar>` rinde mucho más que `/compact` pelado.

⚠️ PreCompact NO ACEPTA `hookSpecificOutput` — verificado 2026-08-27, en vivo.
Una versión anterior devolvía `{"hookSpecificOutput": {"hookEventName": "PreCompact",
"additionalContext": …}}` para inyectar una checklist de preservación. El harness
valida la salida contra un esquema donde `PreCompact` no está en el enum de
`hookEventName`, y al fallar **descarta el payload ENTERO** — se perdió también el
`systemMessage` — además de imprimir el esquema completo como error. Para PreCompact
sólo hay campos top-level: `systemMessage`, `decision`, `reason`, `continue`,
`stopReason`, `suppressOutput`, `terminalSequence`. No hay forma de inyectar contexto
en el prompt de compactación desde acá: lo único que la dirige es el argumento de
`/compact`, que lo escribe la persona. Por eso el empujón a usar ese argumento vive
en `context-guard.py` (UserPromptSubmit, a 150K/300K) — que dispara ANTES, cuando
todavía se puede actuar; acá sólo queda el recordatorio tardío.

NUNCA BLOQUEA. El CLI puede abortar una compactación si un PreCompact hook falla
("Compaction blocked by PreCompact hook"), así que acá todo va envuelto y el exit
es 0 siempre. Perder una compactación es peor que perder este hook.
"""
import json
import os
import sys
from datetime import datetime

# CLAUDE_CONFIG_DIR primero: quien mueve su config (perfiles, máquinas compartidas)
# espera que el ledger viaje con ella, no que quede huérfano en ~/.claude.
LOG_DIR = os.path.join(
    os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude"),
    "compact-log",
)

# Argumento sugerido para /compact. Corto a propósito: tiene que poder copiarse
# y pegarse de un tirón. La versión larga de qué preservar no cabe en un aviso.
COMPACT_SUGERIDO = (
    "/compact preservá decisiones y su motivo, caminos ya descartados, "
    "criterios de aceptación pendientes y correcciones del usuario"
)


def emit(payload=None):
    """Salida no bloqueante. Exit 0 SIEMPRE."""
    if payload:
        try:
            print(json.dumps(payload))
        except Exception:
            pass
    sys.exit(0)


def contexto_actual(transcript_path):
    """Último tamaño de contexto del transcript. Devuelve 0 si no se puede leer."""
    try:
        size = os.path.getsize(transcript_path)
        with open(transcript_path, "rb") as f:
            if size > 262_144:
                f.seek(size - 262_144)
            chunk = f.read().decode("utf-8", errors="ignore")
    except Exception:
        return 0

    last = None
    for line in chunk.splitlines():
        try:
            o = json.loads(line)
        except Exception:
            continue
        u = (o.get("message") or {}).get("usage")
        if u:
            last = u
    if not last:
        return 0
    return (
        last.get("input_tokens", 0)
        + last.get("cache_read_input_tokens", 0)
        + last.get("cache_creation_input_tokens", 0)
    )


def anotar_ledger(sid, trigger, ctx, instrucciones):
    """Deja rastro en disco antes de que el contexto desaparezca."""
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        path = os.path.join(LOG_DIR, f"{sid}.md")
        nuevo = not os.path.exists(path)
        with open(path, "a") as f:
            if nuevo:
                f.write(f"# Compactaciones — sesión {sid}\n\n")
                f.write("| momento | trigger | contexto | instrucciones |\n")
                f.write("|---|---|---:|---|\n")
            ts = datetime.now().strftime("%Y-%m-%d %H:%M")
            k = f"{round(ctx / 1000)}K" if ctx else "?"
            ins = (instrucciones or "").replace("|", "/").replace("\n", " ")[:80] or "—"
            f.write(f"| {ts} | {trigger} | {k} | {ins} |\n")
    except Exception:
        pass  # el ledger es best-effort; jamás debe impedir la compactación


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        emit()

    sid = data.get("session_id") or "default"
    trigger = data.get("trigger") or "?"
    instrucciones = data.get("custom_instructions") or ""
    ctx = contexto_actual(data.get("transcript_path") or "")

    anotar_ledger(sid, trigger, ctx, instrucciones)

    # Compactación manual sin instrucciones: esta ya se pierde, pero la próxima no.
    # Sólo `systemMessage` — ver la advertencia del docstring sobre hookSpecificOutput.
    if trigger == "manual" and not instrucciones.strip():
        # Si no se pudo medir el contexto, se omite el tamaño en vez de explicarlo:
        # "Compactando sin poder medir el contexto sin instrucciones" se leía pésimo.
        k = round(ctx / 1000) if ctx else 0
        cuanto = f" ~{k}K" if k else ""
        emit({
            "systemMessage": (
                f"💡 Compactando{cuanto} sin instrucciones. La próxima, pegá:\n"
                f"   {COMPACT_SUGERIDO}"
            )
        })

    emit()


if __name__ == "__main__":
    main()
