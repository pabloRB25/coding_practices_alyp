#!/bin/zsh
# token-audit.sh — Auditoría de consumo de contexto de Claude Code
#
# Reproduce el baseline del plan ~/Dev/plan-optimizacion-tokens-claude-code.md
# Uso:  token-audit.sh [--since YYYY-MM-DD] [--projects <dir>]
#
# TRAMPAS DEL MÉTODO (no cambiar sin leer esto):
#  1) Extraer con `xargs -P N > archivo` ÚNICO corrompe el TSV: las escrituras de los
#     procesos paralelos se interleavan a mitad de línea. Un archivo por proceso.
#  2) Deduplicar por requestId a secas DESCARTA líneas: un mismo mensaje del asistente
#     se parte en varias entradas JSONL con el mismo requestId. Para usage se deduplica
#     por (requestId, message.id); para contar herramientas se cuentan IDs ÚNICOS de
#     tool_use por request.
#  3) Para cualquier serie temporal de contexto hay que SEPARAR isSidechain=true de
#     false ANTES de agregar. Los subagentes corren a ~129K y el loop principal a ~266K:
#     mezclarlos produce una serie plana que parece compactación automática y no lo es.

set -u
SINCE=""
PROJECTS="$HOME/.claude/projects"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --since)    SINCE="$2"; shift 2 ;;
    --projects) PROJECTS="$2"; shift 2 ;;
    -h|--help)  sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "opción desconocida: $1" >&2; exit 1 ;;
  esac
done

command -v jq >/dev/null || { echo "falta jq" >&2; exit 1; }
WORK=$(mktemp -d) || exit 1
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/u" "$WORK/t"

echo "▸ Extrayendo usage de $PROJECTS ..."
# TRAMPA 1: un archivo por proceso, nunca un único > compartido.
find "$PROJECTS" -name '*.jsonl' -print0 \
| xargs -0 -P 8 -n 40 sh -c 'jq -r "
    select(.type==\"assistant\" and (.message.usage != null))
    | [ (.requestId // \"-\"), (.message.id // \"-\"), (.timestamp // \"-\"),
        (.message.model // \"-\"),
        (.message.usage.input_tokens // 0), (.message.usage.output_tokens // 0),
        (.message.usage.cache_creation_input_tokens // 0),
        (.message.usage.cache_read_input_tokens // 0),
        (if .isSidechain then 1 else 0 end),
        (.cwd // \"-\"), (.sessionId // \"-\") ] | @tsv" "$@" 2>/dev/null \
    > "'"$WORK"'/u/p$$.tsv"' _

# TRAMPA 2: dedup por (requestId, message.id) + descarte de líneas corruptas.
cat "$WORK"/u/*.tsv 2>/dev/null \
| awk -F'\t' 'NF==11 && $5~/^[0-9]+$/ && $6~/^[0-9]+$/ && $7~/^[0-9]+$/ && $8~/^[0-9]+$/' \
| awk -F'\t' -v s="$SINCE" '(s=="" || $3>=s)' \
| awk -F'\t' '!seen[$1"|"$2]++' > "$WORK/usage.tsv"

N=$(wc -l < "$WORK/usage.tsv" | tr -d ' ')
[[ "$N" -eq 0 ]] && { echo "sin datos"; exit 1; }

echo "▸ Extrayendo tool_use ..."
# TRAMPA 4: los flags de encadenado / `cd` suelto se calculan sobre el comando COMPLETO,
# nunca sobre una versión truncada. Truncar a N caracteres esconde los `&&` que caen
# fuera de la ventana y hace parecer suelto un comando que sí encadena (verificado
# 2026-08-27: con 60 chars daba 13.229 `cd` sueltos; con el comando entero, 2.290).
find "$PROJECTS" -name '*.jsonl' -print0 \
| xargs -0 -P 8 -n 40 sh -c 'jq -r "
    select(.type==\"assistant\") | (.requestId // \"-\") as \$r
    | (.message.content[]? | select(.type==\"tool_use\")
       | ((.input.command // \"\") | sub(\"^ +\";\"\")) as \$c
       | [\$r, .id, .name,
          (if (\$c | test(\"&&|;|[|]\")) then 1 else 0 end),
          (if (\$c | test(\"^cd \")) and (\$c | test(\"&&|;\") | not) then 1 else 0 end),
          (\$c | split(\"\n\")[0] | .[0:80])] | @tsv)" "$@" 2>/dev/null \
    > "'"$WORK"'/t/p$$.tsv"' _
# TRAMPA 2 (bis): IDs únicos de tool_use, no líneas.
cat "$WORK"/t/*.tsv 2>/dev/null | awk -F'\t' '!s[$1"|"$2]++' > "$WORK/tools.tsv"

# ── precios de lista (USD/MTok): input, output=5x; cache write 1,25x; cache read 0,1x
read -r -d '' PRICE <<'AWK'
function pin(m){ if(m~/opus/) return 5; if(m=="claude-sonnet-5") return 2;
  if(m=="claude-sonnet-4-6") return 3; if(m~/haiku/) return 1;
  if(m~/fable/ || m~/mythos/) return 10; return 0 }
function cost(m,i,o,cc,cr,  p){ p=pin(m); if(p==0) return 0
  return (i*p + o*p*5 + cc*p*1.25 + cr*p*0.10)/1e6 }
AWK

echo
echo "════════════════════════════════════════════════════════════"
echo "  AUDITORÍA DE CONTEXTO — Claude Code"
[[ -n "$SINCE" ]] && echo "  desde: $SINCE"
echo "════════════════════════════════════════════════════════════"

awk -F'\t' "$PRICE"'
{ i+=$5; o+=$6; cc+=$7; cr+=$8; T+=cost($4,$5,$6,$7,$8); n++
  if(mn==""||$3<mn) mn=$3; if($3>mx) mx=$3 }
END{ printf "\n  período: %s → %s   requests únicos: %d\n", substr(mn,1,10), substr(mx,1,10), n
     printf "  volumen: input %.1fM · output %.1fM · cache_creation %.1fM · cache_read %.1fM\n", i/1e6,o/1e6,cc/1e6,cr/1e6
     printf "  cache_read = %.1f%% del volumen\n", 100*cr/(i+o+cc+cr)
     printf "  cache_creation/cache_read = %.1f%%  (>10%% = el prefijo se está invalidando)\n", 100*cc/cr
     printf "  COSTO-PROXY: $%.0f   (precios de lista; sobre suscripción = peso relativo)\n", T }' "$WORK/usage.tsv"

echo
echo "  ── por modelo ──"
awk -F'\t' "$PRICE"'
{ c=cost($4,$5,$6,$7,$8); M[$4]+=c; N[$4]++; T+=c }
END{ for(k in M) printf "  %-26s $%7.0f (%4.1f%%)  req:%6d\n", k, M[k], 100*M[k]/T, N[k] }' "$WORK/usage.tsv" | sort -t'$' -k2 -rn

echo
echo "  ── MÉTRICA PRINCIPAL: altura de compactación (loop principal) ──"
# TRAMPA 3: sólo loop principal ($9==0), ordenado por sesión y tiempo.
awk -F'\t' '$9==0 {print $11"\t"$3"\t"$5+$7+$8}' "$WORK/usage.tsv" | sort -k1,1 -k2,2 \
| awk -F'\t' '
  { if(prev_s==$1 && prev>150000 && $3 < prev*0.45){ n++; s+=prev; if(prev>mx)mx=prev
      b=int(prev/100000)*100; H[b]++ }
    prev=$3; prev_s=$1 }
  END{ if(!n){ print "    (sin resets detectados)"; exit }
       printf "    resets: %d   ALTURA PROMEDIO: %.0f tok   máxima: %.0f\n", n, s/n, mx
       print  "    ── desde qué altura ──"
       for(k in H) printf "      %4d-%4dK: %d\n", k, k+100, H[k] }' | sort -k1

echo
echo "  ── contexto por request ──"
awk -F'\t' '{print $5+$7+$8}' "$WORK/usage.tsv" | sort -n \
| awk '{a[NR]=$1} END{ printf "    p50 %dK · p75 %dK · p90 %dK · p99 %dK · máx %dK\n",
    a[int(NR*.5)]/1000, a[int(NR*.75)]/1000, a[int(NR*.9)]/1000, a[int(NR*.99)]/1000, a[NR]/1000 }'

awk -F'\t' "$PRICE"'
{ ctx=$5+$7+$8; c=cost($4,$5,$6,$7,$8); T+=c; NT++
  b = ctx<50000?"1 <50K": ctx<150000?"2 50-150K": ctx<300000?"3 150-300K": ctx<500000?"4 300-500K": ctx<800000?"5 500-800K":"6 >800K"
  C[b]+=c; N[b]++
  if(ctx>300000){ over+=c; overn++ } }
END{ for(k in C) printf "    %-11s $%7.0f (%4.1f%%)  %6d req  $%.3f/req\n", k, C[k], 100*C[k]/T, N[k], C[k]/N[k]
     printf "    ► costo en >300K: %.1f%%  (objetivo <25%%)\n", 100*over/T }' "$WORK/usage.tsv" | sort

echo
echo "  ── loop principal vs subagentes ──"
awk -F'\t' '{k=($9==1?"subagente":"principal"); n[k]++; s[k]+=$5+$7+$8; if($5+$7+$8>300000) o[k]++}
END{ for(k in n) printf "    %-10s req:%6d  ctx promedio:%7.0f  >300K: %.1f%%\n", k, n[k], s[k]/n[k], 100*o[k]/n[k] }' "$WORK/usage.tsv"

echo
echo "  ── round-trips ──"
awk -F'\t' '{r[$1]++} END{ for(k in r){n++; s+=r[k]} printf "    tool_use por request que usa herramientas: %.2f  (objetivo >1,5)\n", s/n }' "$WORK/tools.tsv"
# flags precalculados en jq sobre el comando completo: $4=encadenado, $5=cd suelto
awk -F'\t' '$3=="Bash"{ tot++; enc+=$4; cdsolo+=$5 }
END{ printf "    comandos Bash: %d   encadenados: %d (%.1f%%)\n", tot, enc, 100*enc/tot
     printf "    ► `cd` SUELTOS (round-trip vacío): %d   (objetivo <500)\n", cdsolo }' "$WORK/tools.tsv"

echo
echo "  ── top 8 herramientas por llamadas ──"
awk -F'\t' '{n[$3]++} END{for(k in n) printf "    %-42s %6d\n", k, n[k]}' "$WORK/tools.tsv" | sort -k2 -rn | head -8

echo
echo "════════════════════════════════════════════════════════════"
