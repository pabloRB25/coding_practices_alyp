import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import puntuar  # noqa: E402

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
TAREAS = puntuar.cargar_tareas()


def test_tokens_primer_turno_suma_tres_campos_y_tolera_basura():
    ev = puntuar.leer_eventos(os.path.join(FIX, "rtk_pasa.jsonl"))
    assert puntuar.tokens_primer_turno(ev) == 1210


def test_criterio_rtk_pasa_y_falla():
    c = TAREAS["rtk"]["criterio"]
    assert puntuar.evaluar(c, puntuar.leer_eventos(os.path.join(FIX, "rtk_pasa.jsonl"))) is True
    assert puntuar.evaluar(c, puntuar.leer_eventos(os.path.join(FIX, "rtk_falla.jsonl"))) is False


def test_regresiones_detecta_2de2_antes_y_no_despues():
    ok, mal = {"pasa": True}, {"pasa": False}
    antes = {"rtk": [ok, ok], "nav": [ok, mal], "kill": [ok, ok]}
    despues = {"rtk": [ok, mal], "nav": [mal, mal], "kill": [ok, ok]}
    assert puntuar.regresiones(antes, despues) == ["rtk"]


def test_tareas_son_6_y_correr_imprime_12():
    assert len(TAREAS) == 6


def test_is_error_no_cuenta_como_pasa(tmp_path):
    f = tmp_path / "rtk-1.jsonl"
    f.write_text(json.dumps({"type": "assistant", "message": {"usage": {}, "content": [
        {"type": "tool_use", "name": "Bash", "input": {"command": "rtk git status"}}]}}) + "\n"
        + json.dumps({"type": "result", "is_error": True, "subtype": "error_max_budget_usd"}) + "\n")
    m = puntuar.metricas(str(f), TAREAS["rtk"])
    assert m["pasa"] is False and m["error"] == "error_max_budget_usd"
