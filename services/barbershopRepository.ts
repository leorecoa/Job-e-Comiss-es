import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Barbershop } from '../types';

type DatabaseBarbershopRow = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  active: boolean;
};

export const getBarbershopBySlug = async (slug: string): Promise<Barbershop | null> => {
  if (!isSupabaseConfigured || !supabase) return null; // No local storage fallback for barbershops

  const { data, error } = await supabase
    .from('barbershops')
    .select('id,name,slug,phone,address,active')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle<DatabaseBarbershopRow>();

  if (error) throw error;

  return data || null;
};