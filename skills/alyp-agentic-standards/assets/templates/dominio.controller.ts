// features/<dominio>/<dominio>.controller.ts — lógica real
import { type NextRequest, NextResponse } from 'next/server';
import { crearLoggerDeRuta, nuevoTraceId } from '@/utils/logger';
import { <Dominio>Schema } from './index';

export async function POST(req: NextRequest) {
  const log = crearLoggerDeRuta(nuevoTraceId(), '<dominio>:crear');
  try {
    const body = await req.json();
    const result = <Dominio>Schema.safeParse(body);
    if (!result.success) {
      log.warn('validación fallida', { errores: result.error.flatten() });
      return NextResponse.json({ error: 'ERR_VALIDACION' }, { status: 400 });
    }
    // lógica de negocio...
    log.info('completado');
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error(err, { codigo: 'ERR_NEGOCIO_GENERICO' });
    return NextResponse.json({ error: 'ERR_INTERNO' }, { status: 500 });
  }
}
