# Eval A/B del CLAUDE.md global

Mide el CLAUDE.md global antes y después de podarlo: 6 tareas (`tareas.yaml`, JSON válido) x 2 reps
con la configuración real de Claude Code, sobre un worktree desechable de nomi_v3.

1. Ver los 12 comandos sin ejecutar: `bash global/eval/correr.sh antes --imprimir`
2. Fase antes (CLAUDE.md actual): `bash global/eval/correr.sh antes`
3. Podar el CLAUDE.md, luego: `bash global/eval/correr.sh despues`
4. Puntuar: `python3 global/eval/puntuar.py global/eval/resultados/antes global/eval/resultados/despues`
5. Tests del puntuador: `python3 -m pytest global/eval/test_puntuar.py -q`

Salida: tokens del primer turno (delta %), turnos, pasa x/2 por tarea, `REGRESIONES: ...`, gasto.
Costo tope: 24 corridas x 0,50 USD = 4,80 USD por fase (EVAL_BUDGET=0.80 por corrida) (12 por fase = 6 USD). Los resultados `.jsonl` quedan en
`global/eval/resultados/<fase>/`. El worktree se borra al terminar (trap), incluso con fallos.
