import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Barbershop } from '../types';

const DEFAULT_LOCAL_BARBERSHOP_SLUG = 'gestao-maxima';

type DatabaseBarbershopRow = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  active: boolean;
};

export const getBarbershopBySlug = async (slug: string): Promise<Barbershop | null> => {
  if (!isSupabaseConfigured || !supabase) {
    if (slug !== DEFAULT_LOCAL_BARBERSHOP_SLUG) return null;

    return {
      id: 'local-barbershop',
      name: 'Gestao Maxima',
      slug: DEFAULT_LOCAL_BARBERSHOP_SLUG,
      phone: null,
      address: null,
      active: true
    };
  }

  const { data, error } = await supabase
    .from('barbershops')
    .select('id,name,slug,phone,address,active')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle<DatabaseBarbershopRow>();

  if (error) throw error;

  return data || null;
};
