#!/usr/bin/env python3
"""
UserPromptSubmit hook — AVISO de contexto (NO bloquea nunca).

Cuando el contexto supera THRESHOLD tokens, muestra un systemMessage al usuario
sugiriendo /compact. Avisa una vez por tramo de 100K (200K, 300K, …), no en cada
turno. Siempre exit 0 → jamás cuelga la sesión.

Objetivo: recordar compactar antes/durante el premium de long-context en Opus [1M].
"""
import json
import os
import sys

THRESHOLD = 200_000
BUCKET = 100_000          # avisa una vez por cada tramo de 100K
TAIL_BYTES = 262_144      # solo leemos la cola del transcript (eficiente)

def emit(system_message=None):
    """Salida no bloqueante. systemMessage lo ve el usuario, no el modelo."""
    if system_message:
        print(json.dumps({"systemMessage": system_message, "suppressOutput": True}))
    sys.exit(0)

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        emit()

    tr = data.get("transcript_path")
    if not tr or not os.path.exists(tr):
        emit()

    # leer solo la cola del archivo (el último usage está cerca del final)
    try:
        size = os.path.getsize(tr)
        with open(tr, "rb") as f:
            if size > TAIL_BYTES:
                f.seek(size - TAIL_BYTES)
            chunk = f.read().decode("utf-8", errors="ignore")
    except Exception:
        emit()

    last = None
    for line in chunk.splitlines():
        try:
            o = json.loads(line)
        except Exception:
            continue  # línea parcial al inicio del chunk, o no-JSON
        u = (o.get("message") or {}).get("usage")
        if u:
            last = u
    if not last:
        emit()

    ctx = (
        last.get("input_tokens", 0)
        + last.get("cache_read_input_tokens", 0)
        + last.get("cache_creation_input_tokens", 0)
    )
    bucket = ctx // BUCKET
    if bucket < THRESHOLD // BUCKET:
        emit()  # por debajo de 200K, silencio

    # throttle por sesión: avisar solo cuando se cruza un nuevo tramo de 100K
    sid = data.get("session_id") or "default"
    marker = os.path.join("/tmp", f"claude-ctxguard-{sid}")
    last_bucket = -1
    try:
        with open(marker) as m:
            last_bucket = int(m.read().strip() or "-1")
    except Exception:
        pass

    if bucket <= last_bucket:
        emit()  # ya avisamos en este tramo

    try:
        with open(marker, "w") as m:
            m.write(str(bucket))
    except Exception:
        pass

    k = round(ctx / 1000)
    emit(
        f"⚠️ Contexto ~{k}K tokens (> {THRESHOLD // 1000}K). En Opus [1M] entrás en "
        f"pricing premium de long-context y se re-lee todo el contexto cada turno. "
        f"Considerá /compact (o /clear si arrancás algo nuevo). — aviso no bloqueante"
    )

if __name__ == "__main__":
    main()
