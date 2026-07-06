#!/usr/bin/env node
// scripts/agent-gps.mjs
// Extractor multi-proveedor de logs. Uso: node scripts/agent-gps.mjs <traceId>
// LOG_PROVIDER=local | axiom | http

import { readFileSync } from 'fs';

const [, , traceId] = process.argv;
if (!traceId) { console.error('Uso: node scripts/agent-gps.mjs <traceId>'); process.exit(1); }

const provider = process.env.LOG_PROVIDER ?? 'local';

async function fetchLogs() {
  if (provider === 'local') {
    const file = process.env.LOG_LOCAL_FILE ?? 'logs/dev.log';
    try {
      return readFileSync(file, 'utf8').split('\n').filter(Boolean);
    } catch {
      console.error(`No se encontró ${file}. ¿Estás corriendo con: next dev | tee logs/dev.log?`);
      process.exit(1);
    }
  }

  if (provider === 'axiom' || provider === 'http') {
    const url     = process.env.LOG_PROVIDER_API_URL;
    const token   = process.env.LOG_PROVIDER_TOKEN;
    const dataset = process.env.LOG_DATASET;
    if (!url || !token) { console.error('Faltan LOG_PROVIDER_API_URL y LOG_PROVIDER_TOKEN'); process.exit(1); }

    const body = provider === 'axiom'
      ? JSON.stringify({ apl: `['${dataset}'] | where traceId == '${traceId}' | limit 50` })
      : JSON.stringify({ query: `traceId:${traceId}`, size: 50 });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();
    const rows = provider === 'axiom' ? (data.matches ?? []).map((m) => m.data) : (data.results ?? []);
    return rows.map((r) => JSON.stringify(r));
  }

  console.error(`LOG_PROVIDER desconocido: ${provider}`); process.exit(1);
}

const lines = await fetchLogs();
const entries = lines
  .map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter((e) => e && e.traceId === traceId);

if (!entries.length) {
  console.log(`No se encontraron logs para traceId: ${traceId}`);
  process.exit(0);
}

console.log(`\n=== GPS para traceId: ${traceId} ===\n`);
for (const e of entries) {
  if (e.nivel === 'error' && e.error) {
    console.log(`[ERROR] ${e.timestamp} | ${e.contexto}`);
    console.log(`  Mensaje:   ${e.error.mensaje}`);
    console.log(`  Código:    ${e.error.codigo}`);
    console.log(`  Ubicación: ${e.error.ubicacion_exacta}`);
    console.log(`  Stack:     ${(e.error.stack_snippet ?? []).join('\n             ')}`);
    console.log('');
    console.log('<<<AGENT_GPS_JSON>>>');
    console.log(JSON.stringify({
      archivo:  e.error.archivo,
      linea:    e.error.linea,
      funcion:  e.error.funcion,
      codigo:   e.error.codigo,
      mensaje:  e.error.mensaje,
      contexto: e.contexto,
    }, null, 2));
    console.log('<<<END_AGENT_GPS_JSON>>>');
  } else {
    console.log(`[${e.nivel?.toUpperCase()}] ${e.timestamp} | ${e.contexto} | ${e.mensaje ?? ''}`);
  }
}
