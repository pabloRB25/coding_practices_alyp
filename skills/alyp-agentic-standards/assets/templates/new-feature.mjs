#!/usr/bin/env node
// scripts/new-feature.mjs
// Uso: node scripts/new-feature.mjs <dominio>
// Ejemplo: node scripts/new-feature.mjs inventario

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const [,, dominio] = process.argv;
if (!dominio) {
  console.error('Uso: node scripts/new-feature.mjs <dominio>');
  process.exit(1);
}

// Capitalizar para nombres de tipo
const Dominio = dominio.charAt(0).toUpperCase() + dominio.slice(1);

// Detectar src dir (monorepo vs simple)
const srcBase = existsSync('apps/app/src') ? 'apps/app/src' : 'src';
const dir = join(srcBase, 'features', dominio);

if (existsSync(dir)) {
  console.error(`❌ La feature "${dominio}" ya existe en ${dir}`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });

const files = {
  [`${dominio}.schema.ts`]: `import { z } from 'zod';

export const ${Dominio}Schema = z.object({
  id:       z.string().uuid().optional(),
  nombre:   z.string().min(1).max(255),
  orgId:    z.string().uuid(),
});

export type ${Dominio} = z.infer<typeof ${Dominio}Schema>;
export const Crear${Dominio}Schema = ${Dominio}Schema.omit({ id: true });
export type Crear${Dominio}Input = z.infer<typeof Crear${Dominio}Schema>;
`,

  [`${dominio}.queries.ts`]: `import { createClient } from '@/lib/supabase/server';
import type { ${Dominio} } from './index';

export async function get${Dominio}s(orgId: string): Promise<${Dominio}[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('${dominio}s')
    .select('*')
    .eq('org_id', orgId);
  if (error) throw error;
  return data ?? [];
}
`,

  [`${dominio}.actions.ts`]: `'use server';
import { crearLoggerDeRuta, nuevoTraceId } from '@/utils/logger';
import { mapearCodigoPostgres } from '@/utils/error-codes';
import { createClient } from '@/lib/supabase/server';
import { Crear${Dominio}Schema } from './index';

export async function crear${Dominio}(formData: FormData) {
  const log = crearLoggerDeRuta(nuevoTraceId(), '${dominio}:crear');
  const result = Crear${Dominio}Schema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    log.warn('validación fallida', { errores: result.error.flatten() });
    return { error: 'ERR_VALIDACION', detalles: result.error.flatten() };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('${dominio}s').insert(result.data).select().single();
    if (error) throw error;
    log.info('creado', { id: data.id });
    return { data };
  } catch (err) {
    log.error(err, { codigo: mapearCodigoPostgres((err as { code?: string }).code) });
    return { error: 'ERR_INTERNO' };
  }
}
`,

  [`${dominio}.controller.ts`]: `import { type NextRequest, NextResponse } from 'next/server';
import { crearLoggerDeRuta, nuevoTraceId } from '@/utils/logger';
import { Crear${Dominio}Schema } from './index';

export async function POST(req: NextRequest) {
  const log = crearLoggerDeRuta(nuevoTraceId(), '${dominio}:crear');
  try {
    const body = await req.json();
    const result = Crear${Dominio}Schema.safeParse(body);
    if (!result.success) {
      log.warn('validación fallida', { errores: result.error.flatten() });
      return NextResponse.json({ error: 'ERR_VALIDACION' }, { status: 400 });
    }
    // TODO: implementar lógica
    log.info('completado');
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    log.error(err, { codigo: 'ERR_NEGOCIO_GENERICO' });
    return NextResponse.json({ error: 'ERR_INTERNO' }, { status: 500 });
  }
}
`,

  [`${dominio}.test.ts`]: `import { describe, it, expect, vi } from 'vitest';
import { Crear${Dominio}Schema } from './${dominio}.schema';

describe('${Dominio} schema', () => {
  it('valida input correcto', () => {
    const result = Crear${Dominio}Schema.safeParse({
      nombre: 'Test ${Dominio}',
      orgId:  '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    const result = Crear${Dominio}Schema.safeParse({ nombre: '', orgId: 'uuid' });
    expect(result.success).toBe(false);
  });
});
`,

  [`index.ts`]: `// API pública de la feature ${dominio}
// Solo lo que está aquí es importable desde fuera de este módulo.
// No hacer deep imports: importar desde '@/features/${dominio}', no desde archivos internos.

export { ${Dominio}Schema, Crear${Dominio}Schema } from './${dominio}.schema';
export type { ${Dominio}, Crear${Dominio}Input }   from './${dominio}.schema';
export { get${Dominio}s }                          from './${dominio}.queries';
export { crear${Dominio} }                         from './${dominio}.actions';
`,
};

for (const [filename, content] of Object.entries(files)) {
  writeFileSync(join(dir, filename), content, 'utf8');
  console.log(`  ✓ ${dir}/${filename}`);
}

// Generar migration stub
const now = new Date();
const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
const migrationDir = 'supabase/migrations';
const migrationFile = `${ts}_add_${dominio}.sql`;
const migrationContent = `-- Migration: add_${dominio}
-- Generada por: pnpm new-feature ${dominio}

CREATE TABLE IF NOT EXISTS public.${dominio}s (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  org_id     uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX ON public.${dominio}s(org_id);

-- RLS (OBLIGATORIO — deny by default)
ALTER TABLE public.${dominio}s ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: miembros de la org pueden leer
CREATE POLICY "${dominio}s_select" ON public.${dominio}s
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT auth.user_orgs()));

-- Policy INSERT: miembros admin+ pueden crear
CREATE POLICY "${dominio}s_insert" ON public.${dominio}s
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT auth.user_orgs()));

-- Policy UPDATE/DELETE: owner/admin solo
-- (añadir cuando se necesite)
`;

if (existsSync(migrationDir)) {
  writeFileSync(`${migrationDir}/${migrationFile}`, migrationContent, 'utf8');
  console.log(`  ✓ ${migrationDir}/${migrationFile}`);
} else {
  console.log(`  ⚠️  supabase/migrations/ no existe — crear migración manualmente`);
}

console.log(`\n✅ Feature "${dominio}" creada en ${dir}/`);
console.log(`\n📋 RUNBOOK — pasos siguientes en orden:`);
console.log(`\n  1. Editar la migración SQL:`);
console.log(`     ${migrationDir}/${migrationFile}`);
console.log(`     → ajustar columnas, agregar más policies RLS si necesario`);
console.log(`\n  2. Aplicar migración local:`);
console.log(`     supabase db reset        # resetea + aplica todo + seed`);
console.log(`     # o solo la nueva:`);
console.log(`     supabase db push --local`);
console.log(`\n  3. Regenerar tipos TypeScript:`);
console.log(`     pnpm supabase:gen:local`);
console.log(`\n  4. Implementar lógica en:`);
console.log(`     ${dir}/${dominio}.queries.ts  ← lecturas`);
console.log(`     ${dir}/${dominio}.actions.ts  ← mutaciones (Server Actions)`);
console.log(`     ${dir}/${dominio}.controller.ts ← route handler`);
console.log(`\n  5. Crear route delgado:`);
console.log(`     app/api/${dominio}/route.ts`);
console.log(`     → export { POST, GET } from '@/features/${dominio}/${dominio}.controller';`);
console.log(`\n  6. pnpm verify  (debe pasar en verde)`);
console.log(`\n  ⚠️  Si la tabla devuelve 0 filas: verificar RLS policies y memberships del usuario`);
console.log(`\n  📖 Guía completa: ver sección "Flujo de nueva feature" en CLAUDE.md\n`);
