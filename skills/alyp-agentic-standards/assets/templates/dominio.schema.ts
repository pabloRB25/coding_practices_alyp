import { z } from 'zod';

// Una sola fuente: el tipo SE DERIVA del schema, nunca al revés
export const <Dominio>Schema = z.object({
  id:         z.string().uuid().optional(),
  nombre:     z.string().min(1).max(255),
  orgId:      z.string().uuid(),
  creadoEn:   z.string().datetime().optional(),
});

export type <Dominio> = z.infer<typeof <Dominio>Schema>;

// Schema para creación (sin id ni creadoEn)
export const Crear<Dominio>Schema = <Dominio>Schema.omit({ id: true, creadoEn: true });
export type Crear<Dominio>Input = z.infer<typeof Crear<Dominio>Schema>;
