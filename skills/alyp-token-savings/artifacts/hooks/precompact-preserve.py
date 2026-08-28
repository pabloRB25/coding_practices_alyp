#!/usr/bin/env python3
"""
PreCompact hook — PRESERVAR lo que la compactación se llevaría puesto.

Es la precondición de calidad de la banda 150K/300K: compactar más seguido es
compactar más veces de forma lossy. Sin esto, bajar el umbral duplica la frecuencia
de pérdida de decisiones y de caminos ya descartados — y el síntoma es reintentar
un enfoque que una sesión anterior había rechazado con motivo.

Hace tres cosas, en orden de robustez:

  1. LEDGER EN DISCO (lo único que no depende de nada más). Antes de que el contexto
     se destruya, deja una entrada en ~/.claude/compact-log/<sesión>.md con el momento,
     el trigger y el tamaño del contexto. Sirve para dos cosas: reconstruir qué pasó,
     y MEDIR la altura real de compactación de forma directa — en vez de inferirla
     desde caídas de cache_read, que fue el error de método del 2026-08-28
     (el 89,8% de esas "caídas" eran subagentes intercalados, no compactaciones).

  2. additionalContext con la checklist de preservación (best-effort: si el harness
     lo incorpora al prompt de compactación, mejor; si no, no rompe nada).

  3. Si la compactación es MANUAL y se disparó sin instrucciones, avisa que
     `/compact <qué preservar>` rinde mucho más que `/compact` pelado.

NUNCA BLOQUEA. El CLI puede abortar una compactación si un PreCompact hook falla
("Compaction blocked by PreCompact hook"), así que acá todo va envuelto y el exit
es 0 siempre. Perder una compactación es peor que perder este hook.
"""
import json
import os
import sys
from datetime import datetime

LOG_DIR = os.path.expanduser("~/.claude/compact-log")

PRESERVAR = """Al compactar, preservá explícitamente:
1. DECISIONES TOMADAS y su motivo (no solo el resultado).
2. CAMINOS YA DESCARTADOS y por qué — es lo que evita reintentarlos.
3. CRITERIOS DE ACEPTACIÓN pendientes y qué falta para cumplirlos.
4. Estado del ledger de la ola en curso: qué tareas cerraron y cuáles no.
5. Correcciones de rumbo del usuario (valen más que el resto del historial).
6. Rutas de archivo y comandos exactos ya verificados que sigan siendo necesarios.
Podés descartar: salidas de herramientas ya consumidas, exploración que no
concluyó en nada, y reformulaciones de algo que ya quedó decidido."""


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

    payload = {
        "hookSpecificOutput": {
            "hookEventName": "PreCompact",
            "additionalContext": PRESERVAR,
        }
    }

    # Compactación manual sin instrucciones: la ocasión de mejorarla es ahora.
    if trigger == "manual" and not instrucciones.strip():
        k = round(ctx / 1000) if ctx else 0
        payload["systemMessage"] = (
            f"💡 Compactando ~{k}K sin instrucciones. La próxima, "
            f"`/compact preservá decisiones, caminos descartados y criterios pendientes` "
            f"conserva bastante más de lo que importa."
        )

    emit(payload)


if __name__ == "__main__":
    main()
