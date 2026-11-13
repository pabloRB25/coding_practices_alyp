#!/bin/bash
# Uso: check-claude-md.sh <CLAUDE.md> [<dir rules>]
# Exit 0 + "OK" si pasa; exit 1 + líneas "FALLA: ..." si no.
exec python3 -I - "$@" <<'PY'
import os, re, sys, glob

args = sys.argv[1:]
if not args:
    print("FALLA: uso: check-claude-md.sh <CLAUDE.md> [<dir rules>]"); sys.exit(1)
claude = args[0]
rules_dir = args[1] if len(args) > 1 else None
fallas = []

def leer(p):
    with open(p, encoding="utf-8") as f:
        return f.read()

def visible(t):
    out = []
    en_bloque = False
    for linea in t.splitlines(keepends=True):
        if en_bloque:
            i = linea.find("-->")
            if i == -1:
                continue
            en_bloque = False
            resto = linea[i + 3:]
            if resto.strip():
                out.append(resto)
            continue
        if re.match(r" {0,3}<!--", linea):
            i = linea.find("-->")
            if i == -1:
                en_bloque = True
                continue
            resto = linea[i + 3:]
            if resto.strip():
                out.append(resto)
            continue
        out.append(linea)
    return "".join(out)

def nlineas(t):
    return len(t.splitlines())

if not os.path.isfile(claude):
    print(f"FALLA: no existe {claude}"); sys.exit(1)
rules = sorted(glob.glob(os.path.join(rules_dir, "*.md"))) if rules_dir else []

textos = {}
for p in [claude] + rules:
    t = leer(p)
    textos[p] = t
    if t.count("<!--") != t.count("-->"):
        fallas.append(f"FALLA: comentarios HTML desbalanceados en {p}")

vc = visible(textos[claude])
if nlineas(vc) > 80:
    fallas.append(f"FALLA: {claude} visible tiene {nlineas(vc)} líneas (máx 80)")
if len(vc.encode("utf-8")) > 5000:
    fallas.append(f"FALLA: {claude} visible tiene {len(vc.encode('utf-8'))} bytes (máx 5000)")
for r in rules:
    n = nlineas(visible(textos[r]))
    if n > 40:
        fallas.append(f"FALLA: {r} visible tiene {n} líneas (máx 40)")

for pro in ["@RTK.md", "REGLA DURA", "🛑", "🔴", "⚠️"]:
    if pro in vc:
        fallas.append(f"FALLA: texto prohibido \"{pro}\" en {claude}")

home = os.environ.get("HOME", "")
vis_todo = vc + "\n" + "\n".join(visible(textos[r]) for r in rules)
vistas = set()
for m in re.finditer(r"~/[^\s`)]*", vc):
    ruta = m.group(0).rstrip(".,:;")
    if ruta in vistas:
        continue
    vistas.add(ruta)
    if not os.path.exists(home + ruta[1:]):
        fallas.append(f"FALLA: ruta inexistente {ruta}")

for r in rules:
    t = textos[r]
    m = re.match(r"---\r?\n(.*?)\r?\n---", t, flags=re.S)
    if not (m and re.search(r"^paths:", m.group(1), flags=re.M)):
        fallas.append(f"FALLA: {r} sin frontmatter paths:")

low = vis_todo.lower()
for a in ["rtk find", "filtrá por errores", "planificar no es ejecutar", "devstral-orchestration",
          "alyp-exec", "explorador", "lsof -ti", "alyp-brain", "engram", "graphify", "Glob",
          "ast-grep", "Serena", "firma", "Código muerto", "Chrome DevTools", "compact"]:
    if a.lower() not in low:
        fallas.append(f"FALLA: falta ancla \"{a}\"")

if fallas:
    print("\n".join(fallas)); sys.exit(1)
print("OK")
PY
