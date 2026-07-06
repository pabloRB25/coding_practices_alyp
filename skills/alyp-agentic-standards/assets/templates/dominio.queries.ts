import { createClient } from '@/lib/supabase/server';
import type { <Dominio> } from './index';

export async function get<Dominio>s(orgId: string): Promise<<Dominio>[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('<dominio>s')
    .select('*')
    .eq('org_id', orgId);
  if (error) throw error;
  return data ?? [];
}
