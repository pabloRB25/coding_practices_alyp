#!/usr/bin/env python3
"""
Statusline — tamaño de contexto SIEMPRE visible.

Claude Code invoca este script en cada turno y pasa por stdin un JSON con
session_id, transcript_path, model, cwd, cost, exceeds_200k_tokens, etc.
La primera línea de stdout se muestra como barra de estado.

Muestra: modelo · contexto NK/ventana (P%) · rama git · costo — con color
según el umbral de 200K (premium long-context) o el % de la ventana, lo que
llegue primero. La ventana sale de `context_window.context_window_size`, que
Claude Code ajusta al modelo vigente (200K, 1M…).
"""
import json
import os
import subprocess
import sys

WINDOW = 1_000_000       # respaldo si Claude Code no manda context_window
PREMIUM = 200_000        # umbral de pricing premium long-context
TAIL_BYTES = 262_144     # leemos solo la cola del transcript

# ANSI
DIM = "\033[2m"
RESET = "\033[0m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
CYAN = "\033[36m"
MAGENTA = "\033[35m"


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


def fmt_tokens(n):
    """200000 → 200K, 1000000 → 1M."""
    if n >= 1_000_000 and n % 1_000_000 == 0:
        return f"{n // 1_000_000}M"
    return f"{round(n / 1000)}K"


def git_branch(cwd):
    """`repo:rama*` — repo = raíz del árbol (en un worktree, su carpeta),
    `*` = cambios sin commitear, `@sha` si el HEAD está desacoplado.
    Una sola llamada a git; los untracked se ignoran para que sea rápida."""
    try:
        out = subprocess.run(
            ["git", "-C", cwd or ".", "status", "--porcelain=v2", "--branch",
             "--untracked-files=no"],
            capture_output=True, text=True, timeout=1,
        )
        if out.returncode != 0:
            return None
        head = oid = None
        dirty = False
        for line in out.stdout.splitlines():
            if line.startswith("# branch.head "):
                head = line.split(" ", 2)[2]
            elif line.startswith("# branch.oid "):
                oid = line.split(" ", 2)[2]
            elif not line.startswith("#"):
                dirty = True
        if not head:
            return None
        if head == "(detached)":
            head = f"@{(oid or '')[:7]}"
        top = subprocess.run(
            ["git", "-C", cwd or ".", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, timeout=1,
        ).stdout.strip()
        repo = os.path.basename(top) if top else ""
        return f"{repo}:{head}{'*' if dirty else ''}" if repo else head
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
    cw = data.get("context_window") or {}
    window = cw.get("context_window_size") or WINDOW
    if cw.get("current_usage"):
        ctx = cw.get("total_input_tokens") or 0
    else:  # sin mensajes todavía (p. ej. tras --resume) o Claude Code viejo
        ctx = ctx_tokens(data.get("transcript_path"))
    k = round(ctx / 1000)
    pct = round(ctx / window * 100)

    if ctx >= PREMIUM:
        color, flag = RED, " ⚠️>200K"
    elif pct >= 90:
        color, flag = RED, ""
    elif ctx >= PREMIUM * 0.75 or pct >= 75:  # 150K o 75%, aviso temprano
        color, flag = YELLOW, ""
    else:
        color, flag = GREEN, ""

    parts = [
        f"{CYAN}{model}{RESET}",
        f"{color}⛁ {k}K/{fmt_tokens(window)} ({pct}%){flag}{RESET}",
    ]

    branch = git_branch(cwd)
    if branch:
        parts.append(f"{MAGENTA}⎇ {branch}{RESET}")

    cost = (data.get("cost") or {}).get("total_cost_usd")
    if isinstance(cost, (int, float)) and cost > 0:
        parts.append(f"{DIM}${cost:.2f}{RESET}")

    print(f" {DIM}·{RESET} ".join(parts))


if __name__ == "__main__":
    main()
