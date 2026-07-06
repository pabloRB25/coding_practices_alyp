import { describe, it, expect, vi } from 'vitest';
import { Crear<Dominio>Schema } from './<dominio>.schema';

describe('<Dominio> schema', () => {
  it('valida input correcto', () => {
    const result = Crear<Dominio>Schema.safeParse({
      nombre: 'Test <Dominio>',
      orgId:  '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    const result = Crear<Dominio>Schema.safeParse({ nombre: '', orgId: 'uuid' });
    expect(result.success).toBe(false);
  });
});
