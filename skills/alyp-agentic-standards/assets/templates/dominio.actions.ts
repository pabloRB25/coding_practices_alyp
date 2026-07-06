// features/<dominio>/<dominio>.actions.ts
'use server';
import { Crear<Dominio>Schema } from './index';
import { agenticLogger, crearLoggerDeRuta, nuevoTraceId } from '@/utils/logger';
import { mapearCodigoPostgres } from '@/utils/error-codes';
import { createClient } from '@/lib/supabase/server';

export async function crear<Dominio>(formData: FormData) {
  const log = crearLoggerDeRuta(nuevoTraceId(), '<dominio>:crear');

  const result = Crear<Dominio>Schema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    log.warn('validación fallida', { errores: result.error.flatten() });
    return { error: 'ERR_VALIDACION', detalles: result.error.flatten() };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('<dominio>s')
      .insert(result.data)
      .select()
      .single();

    if (error) throw error;
    log.info('creado', { id: data.id });
    return { data };
  } catch (err) {
    log.error(err, { codigo: mapearCodigoPostgres((err as { code?: string }).code) });
    return { error: 'ERR_INTERNO' };
  }
}
