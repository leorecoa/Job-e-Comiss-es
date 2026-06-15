import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Barbershop } from '../types';

const DEFAULT_LOCAL_BARBERSHOP_SLUG = 'gestao-maxima';
const LOCAL_BARBERSHOP_STORAGE_KEY = 'barbearia_barbershop_branding';

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
  primary_color: string | null;
  secondary_color: string | null;
};

export type BarbershopBrandingInput = {
  name: string;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
  whatsapp?: string | null;
  instagramUrl?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
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
  primaryColor: 'primary_color' in row ? row.primary_color : null,
  secondaryColor: 'secondary_color' in row ? row.secondary_color : null,
  active: row.active
});

const isMissingBrandingColumnError = (error: { message?: string; code?: string }): boolean => {
  const message = error.message || '';
  return error.code === '42703' || /logo_url|cover_image_url|instagram_url|whatsapp|description|primary_color|secondary_color/i.test(message);
};

const readLocalBarbershop = (): Barbershop => {
  const fallback: Barbershop = {
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
      primaryColor: null,
      secondaryColor: null,
      active: true
    };

  try {
    const saved = localStorage.getItem(LOCAL_BARBERSHOP_STORAGE_KEY);
    if (!saved) return fallback;

    return {
      ...fallback,
      ...JSON.parse(saved),
      id: fallback.id,
      slug: fallback.slug,
      active: true
    };
  } catch {
    return fallback;
  }
};

const writeLocalBarbershop = (barbershop: Barbershop): void => {
  try {
    localStorage.setItem(LOCAL_BARBERSHOP_STORAGE_KEY, JSON.stringify(barbershop));
  } catch {
    // Ignore local persistence failures; the in-memory caller state still updates.
  }
};

const BRANDING_SELECT = 'id,name,slug,phone,address,logo_url,cover_image_url,description,instagram_url,whatsapp,primary_color,secondary_color,active';
const BASIC_SELECT = 'id,name,slug,phone,address,active';

const getActiveBarbershopBy = async (column: 'id' | 'slug', value: string): Promise<Barbershop | null> => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('barbershops')
    .select(BRANDING_SELECT)
    .eq(column, value)
    .eq('active', true)
    .maybeSingle<DatabaseBarbershopBrandingRow>();

  if (error) {
    if (!isMissingBrandingColumnError(error)) throw error;

    const fallback = await supabase
      .from('barbershops')
      .select(BASIC_SELECT)
      .eq(column, value)
      .eq('active', true)
      .maybeSingle<DatabaseBarbershopRow>();

    if (fallback.error) throw fallback.error;

    return fallback.data ? mapBarbershopRow(fallback.data) : null;
  }

  return data ? mapBarbershopRow(data) : null;
};

export const getBarbershopBySlug = async (slug: string): Promise<Barbershop | null> => {
  if (!isSupabaseConfigured || !supabase) {
    if (slug !== DEFAULT_LOCAL_BARBERSHOP_SLUG) return null;
    return readLocalBarbershop();
  }

  return getActiveBarbershopBy('slug', slug);
};

export const getBarbershopById = async (id: string): Promise<Barbershop | null> => {
  if (!isSupabaseConfigured || !supabase) {
    return id === 'local-barbershop' ? readLocalBarbershop() : null;
  }

  return getActiveBarbershopBy('id', id);
};

const cleanOptional = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed || null;
};

export const toBarbershopBrandingPayload = (input: BarbershopBrandingInput) => ({
  name: input.name.trim(),
  phone: cleanOptional(input.phone),
  address: cleanOptional(input.address),
  description: cleanOptional(input.description),
  whatsapp: cleanOptional(input.whatsapp),
  instagram_url: cleanOptional(input.instagramUrl),
  logo_url: cleanOptional(input.logoUrl),
  cover_image_url: cleanOptional(input.coverImageUrl),
  primary_color: cleanOptional(input.primaryColor),
  secondary_color: cleanOptional(input.secondaryColor)
});

export const updateCurrentBarbershopBranding = async (
  barbershopId: string,
  input: BarbershopBrandingInput
): Promise<Barbershop> => {
  const payload = toBarbershopBrandingPayload(input);

  if (!payload.name) {
    throw new Error('Informe o nome da barbearia.');
  }

  if (!isSupabaseConfigured || !supabase) {
    const updated = {
      ...readLocalBarbershop(),
      ...input,
      id: 'local-barbershop',
      slug: DEFAULT_LOCAL_BARBERSHOP_SLUG,
      name: payload.name,
      phone: payload.phone,
      address: payload.address,
      description: payload.description,
      whatsapp: payload.whatsapp,
      instagramUrl: input.instagramUrl || null,
      logoUrl: input.logoUrl || null,
      coverImageUrl: input.coverImageUrl || null,
      primaryColor: input.primaryColor || null,
      secondaryColor: input.secondaryColor || null,
      active: true
    };
    writeLocalBarbershop(updated);
    return updated;
  }

  const { data, error } = await supabase
    .from('barbershops')
    .update(payload)
    .eq('id', barbershopId)
    .select(BRANDING_SELECT)
    .single<DatabaseBarbershopBrandingRow>();

  if (error) throw error;

  return mapBarbershopRow(data);
};
