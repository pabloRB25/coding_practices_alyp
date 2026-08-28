#!/usr/bin/env python3
"""Valida los hooks de ahorro de tokens. Uso: validar_hooks.py <dir-con-los-hooks>

No corre una compactación: alimenta los hooks por stdin y verifica el JSON de salida.
Regla dura: PreCompact NO admite `hookSpecificOutput` — si aparece, el harness
descarta el payload ENTERO (incluido systemMessage) y escupe el esquema como error.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

WT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.claude/hooks")

# Campos top-level que el harness listó como válidos en su mensaje de error.
PERMITIDOS = {"continue", "suppressOutput", "stopReason", "decision",
              "reason", "systemMessage", "terminalSequence", "hookSpecificOutput"}

fallos = []
CFG = tempfile.mkdtemp(prefix="cfg-")   # CLAUDE_CONFIG_DIR aislado: no toca ~/.claude
ENV = {**os.environ, "CLAUDE_CONFIG_DIR": CFG}


def transcript_falso(ctx):
    fd, path = tempfile.mkstemp(suffix=".jsonl")
    with os.fdopen(fd, "w") as f:
        f.write(json.dumps({"message": {"usage": {
            "input_tokens": 10, "cache_read_input_tokens": ctx - 10,
            "cache_creation_input_tokens": 0}}}) + "\n")
    return path


def correr(hook, entrada, stdin_crudo=None):
    return subprocess.run([sys.executable, os.path.join(WT, hook)],
                          input=stdin_crudo if stdin_crudo is not None else json.dumps(entrada),
                          capture_output=True, text=True, env=ENV)


def revisar(nombre, p, espera_mensaje, prohibir_hso=True):
    if p.returncode != 0:
        fallos.append(f"{nombre}: exit {p.returncode} (debe ser 0 SIEMPRE)")
        return None
    out = p.stdout.strip()
    if not out:
        if espera_mensaje:
            fallos.append(f"{nombre}: no emitió nada y se esperaba systemMessage")
        else:
            print(f"  ✓ {nombre}: sin salida, exit 0")
        return None
    try:
        d = json.loads(out)
    except Exception as e:
        fallos.append(f"{nombre}: stdout no es JSON válido ({e})")
        return None
    ajenas = set(d) - PERMITIDOS
    if ajenas:
        fallos.append(f"{nombre}: claves fuera del esquema: {sorted(ajenas)}")
    if prohibir_hso and "hookSpecificOutput" in d:
        fallos.append(f"{nombre}: emite hookSpecificOutput — el harness descarta TODO")
    if espera_mensaje and "systemMessage" not in d:
        fallos.append(f"{nombre}: falta systemMessage")
    if not espera_mensaje:
        fallos.append(f"{nombre}: emitió {sorted(d)} y se esperaba silencio")
    print(f"  ✓ {nombre}: claves {sorted(d)}")
    return d


def mostrar(d):
    print("    ", d["systemMessage"].replace("\n", "\n     "))


print(f"hooks bajo prueba: {WT}\n")
print("PreCompact — precompact-preserve.py")
tp = transcript_falso(357_000)
try:
    d = revisar("manual sin instrucciones",
                correr("precompact-preserve.py",
                       {"session_id": "TEST-val", "trigger": "manual",
                        "transcript_path": tp, "custom_instructions": ""}), True)
    if d:
        mostrar(d)
        if "/compact " not in d["systemMessage"]:
            fallos.append("PreCompact: el aviso no trae el comando listo para pegar")
        if "~357K" not in d["systemMessage"]:
            fallos.append("PreCompact: no reporta el tamaño medido")

    # sin transcript legible: debe OMITIR el tamaño, no explicarlo con una frase rota
    d = revisar("manual sin poder medir",
                correr("precompact-preserve.py",
                       {"session_id": "TEST-val", "trigger": "manual",
                        "transcript_path": "/no/existe", "custom_instructions": ""}), True)
    if d:
        mostrar(d)
        if "Compactando sin instrucciones" not in d["systemMessage"]:
            fallos.append("PreCompact: la frase sin medición no quedó limpia")

    revisar("manual CON instrucciones (debe callarse)",
            correr("precompact-preserve.py",
                   {"session_id": "TEST-val", "trigger": "manual",
                    "transcript_path": tp, "custom_instructions": "preservá X"}), False)

    revisar("trigger auto (debe callarse)",
            correr("precompact-preserve.py",
                   {"session_id": "TEST-val", "trigger": "auto",
                    "transcript_path": tp, "custom_instructions": ""}), False)

    p = correr("precompact-preserve.py", None, stdin_crudo="{no es json")
    if p.returncode != 0:
        fallos.append(f"PreCompact stdin corrupto: exit {p.returncode}, debe ser 0")
    else:
        print("  ✓ stdin corrupto: exit 0")

    # el ledger tiene que haber ido al CLAUDE_CONFIG_DIR, NO a ~/.claude
    lg = os.path.join(CFG, "compact-log", "TEST-val.md")
    if os.path.exists(lg):
        print(f"\n  ✓ ledger en CLAUDE_CONFIG_DIR ({len(open(lg).readlines()) - 3} compactaciones):")
        print("   ", open(lg).read().strip().replace("\n", "\n    "))
    else:
        fallos.append("el ledger NO se escribió en CLAUDE_CONFIG_DIR")
    if os.path.exists(os.path.expanduser("~/.claude/compact-log/TEST-val.md")):
        fallos.append("FUGA: el ledger escribió en ~/.claude ignorando CLAUDE_CONFIG_DIR")

    print("\nUserPromptSubmit — context-guard.py")
    for ctx, etiqueta, espera in ((120_000, "120K (bajo el piso, silencio)", False),
                                  (210_000, "210K (banda 🟡)", True),
                                  (357_000, "357K (techo 🔴)", True)):
        t = transcript_falso(ctx)
        d = revisar(etiqueta,
                    correr("context-guard.py",
                           {"session_id": f"TEST-cg-{ctx}", "transcript_path": t}),
                    espera, prohibir_hso=False)
        if d:
            mostrar(d)
            if "/compact " not in d["systemMessage"]:
                fallos.append(f"context-guard {etiqueta}: sin comando para pegar")
        os.unlink(t)
        m = os.path.join(tempfile.gettempdir(), f"claude-ctxguard-TEST-cg-{ctx}")
        if os.path.exists(m):
            os.unlink(m)

    # throttle: el segundo aviso en el mismo tramo y sesión debe callarse
    t = transcript_falso(210_000)
    correr("context-guard.py", {"session_id": "TEST-throttle", "transcript_path": t})
    revisar("mismo tramo, 2da vez (throttle)",
            correr("context-guard.py", {"session_id": "TEST-throttle", "transcript_path": t}),
            False, prohibir_hso=False)
    os.unlink(t)
    m = os.path.join(tempfile.gettempdir(), "claude-ctxguard-TEST-throttle")
    if os.path.exists(m):
        os.unlink(m)
finally:
    os.unlink(tp)
    shutil.rmtree(CFG, ignore_errors=True)

print()
if fallos:
    print("✗ FALLOS:")
    for f in fallos:
        print("   ", f)
    sys.exit(1)
print("✓ exit 0 siempre · esquema válido · sin hookSpecificOutput · ledger en "
      "CLAUDE_CONFIG_DIR · throttle OK")
