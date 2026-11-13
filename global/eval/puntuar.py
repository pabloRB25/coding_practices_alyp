#!/usr/bin/env python3
"""Puntúa corridas A/B de Claude Code. Uso: puntuar.py <dir_antes> <dir_despues>"""
import json
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))


def cargar_tareas():
    with open(os.path.join(AQUI, "tareas.yaml"), encoding="utf-8") as f:
        return {t["id"]: t for t in json.load(f)}


def leer_eventos(ruta):
    eventos = []
    with open(ruta, encoding="utf-8", errors="replace") as f:
        for linea in f:
            linea = linea.strip()
            if not linea:
                continue
            try:
                ev = json.loads(linea)
            except ValueError:
                continue
            if isinstance(ev, dict):
                eventos.append(ev)
    return eventos


def _contenido(ev):
    msg = ev.get("message")
    c = msg.get("content") if isinstance(msg, dict) else None
    return c if isinstance(c, list) else []


def tool_uses(eventos):
    for ev in eventos:
        if ev.get("type") == "assistant":
            for it in _contenido(ev):
                if isinstance(it, dict) and it.get("type") == "tool_use":
                    yield it.get("name", ""), it.get("input") or {}


def tool_results_texto(eventos):
    for ev in eventos:
        if ev.get("type") == "user":
            for it in _contenido(ev):
                if isinstance(it, dict) and it.get("type") == "tool_result":
                    c = it.get("content")
                    if isinstance(c, list):
                        c = " ".join(x.get("text", "") for x in c if isinstance(x, dict))
                    yield str(c or "")


def comandos_bash(eventos):
    return [str(i.get("command", "")) for n, i in tool_uses(eventos) if n == "Bash"]


def texto_final(eventos):
    for ev in reversed(eventos):
        if ev.get("type") == "result":
            return str(ev.get("result") or "")
    return ""


def tokens_primer_turno(eventos):
    for ev in eventos:
        if ev.get("type") == "assistant":
            u = (ev.get("message") or {}).get("usage") or {}
            return sum(int(u.get(k) or 0) for k in
                       ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
    return 0


def evaluar(criterio, eventos):
    tipo = criterio.get("tipo")
    val = criterio.get("valor")
    cmds = comandos_bash(eventos)
    if tipo == "texto_contiene":
        return val in texto_final(eventos)
    if tipo == "sin_escritura_fuera_de_docs":
        for n, i in tool_uses(eventos):
            if n == "Workflow":
                return False
            if n in ("Edit", "Write") and "/docs/" not in str(i.get("file_path", "")):
                return False
        return not any("git commit" in c for c in cmds)
    if tipo == "bash_empieza_con":
        return any(c.lstrip().startswith(val) for c in cmds)
    if tipo == "sin_bash_con":
        return not any(v in c for c in cmds for v in val)
    if tipo == "kill_correcto":
        ok = any("lsof -ti" in c or "kill $!" in c or re.search(r"\bkill\s+(-\w+\s+)?\d+", c)
                 for c in cmds)
        bloqueado = any("BLOQUEADO por guarda-kill" in t for t in tool_results_texto(eventos))
        return ok and not bloqueado
    if tipo == "skill_o_texto":
        if any(n == "Skill" and i.get("skill") == val for n, i in tool_uses(eventos)):
            return True
        return val in texto_final(eventos)
    return False


def metricas(ruta, tarea):
    ev = leer_eventos(ruta)
    res = next((e for e in reversed(ev) if e.get("type") == "result"), {})
    return {
        "tokens": tokens_primer_turno(ev),
        "turnos": int(res.get("num_turns") or 0),
        "costo": float(res.get("total_cost_usd") or 0.0),
        "error": str(res.get("subtype") or "error") if res.get("is_error") else "",
        "pasa": (not res.get("is_error")) and evaluar(tarea["criterio"], ev),
    }


def cargar_dir(directorio, tareas):
    """{id: [metricas...]} para los .jsonl <id>-<rep>.jsonl del directorio."""
    out = {}
    if not os.path.isdir(directorio):
        return out
    for nombre in sorted(os.listdir(directorio)):
        m = re.match(r"^(.+)-(\d+)\.jsonl$", nombre)
        if m and m.group(1) in tareas:
            out.setdefault(m.group(1), []).append(
                metricas(os.path.join(directorio, nombre), tareas[m.group(1)]))
    return out


def prom(runs, k):
    return sum(r[k] for r in runs) / len(runs) if runs else 0.0


def regresiones(antes, despues):
    return [i for i, rs in antes.items()
            if len(rs) >= 2 and all(r["pasa"] for r in rs)
            and not all(r["pasa"] for r in despues.get(i, []))]


def main(argv):
    if len(argv) != 3:
        print("uso: puntuar.py <dir_antes> <dir_despues>", file=sys.stderr)
        return 2
    tareas = cargar_tareas()
    a, d = cargar_dir(argv[1], tareas), cargar_dir(argv[2], tareas)
    print("| tarea | tok1 antes | tok1 después | delta % | turnos a/d | pasa antes | pasa después | error |")
    print("|---|---|---|---|---|---|---|---|")
    for i in tareas:
        ra, rd = a.get(i, []), d.get(i, [])
        ta, td = prom(ra, "tokens"), prom(rd, "tokens")
        delta = "n/a" if not ta else "%+.1f%%" % ((td - ta) / ta * 100)
        print("| %s | %.0f | %.0f | %s | %.1f/%.1f | %d/%d | %d/%d | %s |" % (
            i, ta, td, delta, prom(ra, "turnos"), prom(rd, "turnos"),
            sum(r["pasa"] for r in ra), len(ra), sum(r["pasa"] for r in rd), len(rd),
            ",".join(sorted({r["error"] for r in ra + rd if r["error"]})) or "-"))
    reg = regresiones(a, d)
    print("REGRESIONES: " + (", ".join(reg) if reg else "ninguna"))
    gasto = sum(r["costo"] for rs in a.values() for r in rs)
    if os.path.abspath(argv[1]) != os.path.abspath(argv[2]):
        gasto += sum(r["costo"] for rs in d.values() for r in rs)
    print("Gasto total: %.2f USD" % gasto)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
