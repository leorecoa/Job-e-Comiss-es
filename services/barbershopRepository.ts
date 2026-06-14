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

type DatabaseBarbershopBrandingRow = DatabaseBarbershopRow & {
  logo_url: string | null;
  cover_image_url: string | null;
  description: string | null;
  instagram_url: string | null;
  whatsapp: string | null;
};

const mapBarbershopRow = (row: DatabaseBarbershopRow | DatabaseBarbershopBrandingRow): Barbershop => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  phone: row.phone,
  address: row.address,
  logoUrl: 'logo_url' in row ? row.logo_url : null,
  coverImageUrl: 'cover_image_url' in row ? row.cover_image_url : null,
  description: 'description' in row ? row.description : null,
  instagramUrl: 'instagram_url' in row ? row.instagram_url : null,
  whatsapp: 'whatsapp' in row ? row.whatsapp : null,
  active: row.active
});

const isMissingBrandingColumnError = (error: { message?: string; code?: string }): boolean => {
  const message = error.message || '';
  return error.code === '42703' || /logo_url|cover_image_url|instagram_url|whatsapp|description/i.test(message);
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
      logoUrl: null,
      coverImageUrl: null,
      description: null,
      instagramUrl: null,
      whatsapp: null,
      active: true
    };
  }

  const { data, error } = await supabase
    .from('barbershops')
    .select('id,name,slug,phone,address,logo_url,cover_image_url,description,instagram_url,whatsapp,active')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle<DatabaseBarbershopBrandingRow>();

  if (error) {
    if (!isMissingBrandingColumnError(error)) throw error;

    const fallback = await supabase
      .from('barbershops')
      .select('id,name,slug,phone,address,active')
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle<DatabaseBarbershopRow>();

    if (fallback.error) throw fallback.error;

    return fallback.data ? mapBarbershopRow(fallback.data) : null;
  }

  return data ? mapBarbershopRow(data) : null;
};
