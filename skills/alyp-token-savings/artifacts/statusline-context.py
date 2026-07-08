#!/usr/bin/env python3
"""
Statusline — tamaño de contexto SIEMPRE visible.

Claude Code invoca este script en cada turno y pasa por stdin un JSON con
session_id, transcript_path, model, cwd, cost, exceeds_200k_tokens, etc.
La primera línea de stdout se muestra como barra de estado.

Muestra: modelo · contexto ~NK (P%) · rama git · costo — con color según el
umbral de 200K (premium long-context en Opus [1M]).
"""
import json
import os
import subprocess
import sys

WINDOW = 1_000_000       # ventana de Opus [1M]
PREMIUM = 200_000        # umbral de pricing premium long-context
TAIL_BYTES = 262_144     # leemos solo la cola del transcript

# ANSI
DIM = "\033[2m"
RESET = "\033[0m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
CYAN = "\033[36m"


def ctx_tokens(transcript_path):
    """Último uso de tokens = tamaño real del contexto que se re-lee cada turno."""
    if not transcript_path or not os.path.exists(transcript_path):
        return 0
    try:
        size = os.path.getsize(transcript_path)
        with open(transcript_path, "rb") as f:
            if size > TAIL_BYTES:
                f.seek(size - TAIL_BYTES)
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


def git_branch(cwd):
    try:
        out = subprocess.run(
            ["git", "-C", cwd or ".", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=1,
        )
        b = out.stdout.strip()
        return b if out.returncode == 0 and b else None
    except Exception:
        return None


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}

    model = ((data.get("model") or {}).get("display_name")
             or (data.get("model") or {}).get("id") or "?")
    cwd = (data.get("workspace") or {}).get("current_dir") or data.get("cwd") or "."
    ctx = ctx_tokens(data.get("transcript_path"))
    k = round(ctx / 1000)
    pct = round(ctx / WINDOW * 100)

    if ctx >= PREMIUM:
        color, flag = RED, " ⚠️>200K"
    elif ctx >= PREMIUM * 0.75:  # 150K, aviso temprano
        color, flag = YELLOW, ""
    else:
        color, flag = GREEN, ""

    parts = [
        f"{CYAN}{model}{RESET}",
        f"{color}⛁ {k}K ({pct}%){flag}{RESET}",
    ]

    branch = git_branch(cwd)
    if branch:
        parts.append(f"{DIM}⎇ {branch}{RESET}")

    cost = (data.get("cost") or {}).get("total_cost_usd")
    if isinstance(cost, (int, float)) and cost > 0:
        parts.append(f"{DIM}${cost:.2f}{RESET}")

    print(f" {DIM}·{RESET} ".join(parts))


if __name__ == "__main__":
    main()
