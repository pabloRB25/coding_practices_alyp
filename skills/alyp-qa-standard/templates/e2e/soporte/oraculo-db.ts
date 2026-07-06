import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Oráculo DB — qa-standard: v1
 * Verifica el estado PERSISTIDO tras un flujo (lo que la UI muestra puede mentir).
 * Usa service role: estas credenciales solo existen en el runner/CI, jamás en el repo,
 * y el config prohíbe apuntarlas a prod.
 */
let cliente: SupabaseClient | null = null;

export function clienteDb(): SupabaseClient {
  const url = process.env.QA_SUPABASE_URL;
  const key = process.env.QA_SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error(
      "[qa-standard] Faltan QA_SUPABASE_URL / QA_SUPABASE_SERVICE_ROLE en el ambiente",
    );
  }
  cliente ??= createClient(url, key, { auth: { persistSession: false } });
  return cliente;
}

/** Espera hasta que exista una fila que cumpla el filtro (consistencia eventual). */
export async function esperarFila<T extends Record<string, unknown>>(
  tabla: string,
  filtro: Record<string, unknown>,
  opciones: { timeoutMs?: number; intervaloMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 15_000, intervaloMs = 500 } = opciones;
  const inicio = Date.now();
  let ultimoError = "sin filas";
  while (Date.now() - inicio < timeoutMs) {
    const { data, error } = await clienteDb().from(tabla).select("*").match(filtro).limit(1);
    if (error) ultimoError = error.message;
    else if (data && data.length > 0) return data[0] as T;
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  throw new Error(
    `[oraculo-db] ${tabla} sin fila para ${JSON.stringify(filtro)} tras ${timeoutMs}ms (${ultimoError})`,
  );
}

export async function contarFilas(
  tabla: string,
  filtro: Record<string, unknown> = {},
): Promise<number> {
  const { count, error } = await clienteDb()
    .from(tabla)
    .select("*", { count: "exact", head: true })
    .match(filtro);
  if (error) throw new Error(`[oraculo-db] contar ${tabla}: ${error.message}`);
  return count ?? 0;
}
