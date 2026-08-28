#!/usr/bin/env python3
"""
UserPromptSubmit hook — AVISO de contexto (NO bloquea nunca).

Banda de trabajo 150K – 300K (plan de optimización de tokens, 2026-08-28):

  150K  → piso de aviso:  "compactá cuando cierres lo que estás haciendo"
  300K+ → techo duro:     "compactá YA"

Entre 150K y 300K se trabaja sin ruido: un aviso por tramo por sesión.
Siempre exit 0 → jamás cuelga la sesión (un exit 2 en UserPromptSubmit la cuelga).

Por qué esta banda. Medido sobre 94.222 requests (30-may → 28-ago 2026): la altura
promedio a la que se compactaba era 388.723 tokens, plena zona cara. El costo por
request escala $0,059 (50-150K) → $0,127 (150-300K) → $0,235 (300-500K) →
$0,435 (500-800K). Simulación del ahorro según el techo efectivo que se sostenga:
150K → $3.600 (30% del costo) · 300K → $1.357 (11%). El ahorro lo define en qué
borde de la banda se actúa, no la banda: por eso el escalón de 300K no repite la
sugerencia, la endurece.

El hook AVISA, no compacta: un UserPromptSubmit sólo puede emitir systemMessage,
no puede ejecutar /compact. La compactación la hace la persona.
Medir la altura real con: ~/.claude/scripts/token-audit.sh
"""
import json
import os
import sys
import tempfile

THRESHOLD = 150_000       # piso: por debajo de esto, silencio
BUCKET = 150_000          # avisa a 150K, 300K, 450K … una vez por tramo por sesión
HARD_CEILING = 300_000    # a partir de acá el mensaje deja de ser una sugerencia
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
        emit()  # por debajo del piso, silencio

    # throttle por sesión: avisar solo cuando se cruza un nuevo tramo
    sid = data.get("session_id") or "default"
    marker = os.path.join(tempfile.gettempdir(), f"claude-ctxguard-{sid}")
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
    if ctx >= HARD_CEILING:
        emit(
            f"🔴 Contexto ~{k}K — pasaste el techo de {HARD_CEILING // 1000}K. "
            f"Cada turno acá cuesta ~4x lo que costaría a 150K, y se re-lee entero. "
            f"COMPACTÁ YA: /compact <qué preservar>  (o /clear si arrancás algo nuevo). "
            f"— aviso no bloqueante"
        )
    emit(
        f"🟡 Contexto ~{k}K (piso {THRESHOLD // 1000}K). Buen momento para /compact "
        f"cuando cierres lo que estás haciendo — no en medio de un debug. "
        f"Cuanto más cerca de {THRESHOLD // 1000}K compactes, más rinde. "
        f"— aviso no bloqueante"
    )


if __name__ == "__main__":
    main()
