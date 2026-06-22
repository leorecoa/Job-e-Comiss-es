import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { BarberOption } from '../types';

// This key is for local storage fallback when Supabase is not configured
const SETTINGS_STORAGE_KEY = 'barbearia_settings';

type DatabaseBarberRow = {
  id: string;
  name: string;
  barbershop_id: string | null;
  active: boolean; // Assuming active is always present in DB
};

const isLocalTenantMatch = (itemBarbershopId: string | undefined, barbershopId?: string): boolean => {
  if (!barbershopId) return true;
  if (barbershopId === 'local-barbershop') return !itemBarbershopId || itemBarbershopId === barbershopId;
  return itemBarbershopId === barbershopId;
};

const listLocalBarbers = (barbershopId?: string): BarberOption[] => {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = saved ? JSON.parse(saved) : {};
    // For local storage, barbers might just be strings. Convert to BarberOption.
    const localBarbers = Array.isArray(settings.barbers) && settings.barbers.every((b: any) => typeof b === 'string' || (typeof b === 'object' && 'name' in b && 'id' in b))
      ? settings.barbers.map((b: string | BarberOption) =>
          typeof b === 'string' ? { id: b, name: b } : b
        )
      : [];

    return localBarbers.filter((barber: BarberOption) => isLocalTenantMatch(barber.barbershopId, barbershopId));
  } catch {
    return [];
  }
};

export const listBarbers = async (barbershopId?: string): Promise<BarberOption[]> => {
  if (!isSupabaseConfigured || !supabase) return listLocalBarbers(barbershopId);

  let query = supabase
    .from('barbers')
    .select('id,name,barbershop_id,active')
    .eq('active', true);
  
  if (barbershopId) {
    query = query.eq('barbershop_id', barbershopId);
  }

  const { data, error } = await query
    .order('name', { ascending: true })
    .returns<DatabaseBarberRow[]>(); // Explicitly cast to ensure type safety

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    barbershopId: row.barbershop_id || undefined
  }));
};

export const createBarber = async (name: string): Promise<BarberOption> => {
  if (!isSupabaseConfigured || !supabase) {
    return {
      id: name,
      name
    };
  }
  // TODO: When multi-tenancy is fully implemented, barbershopId should be passed here.
  const { data, error } = await supabase
    .from('barbers')
    .insert({ name })
    .select('id,name,barbershop_id') // Select fields to return BarberOption
    .single()
    .returns<DatabaseBarberRow>(); // Explicitly cast to ensure type safety
  
  if (error) throw error;
  return { id: data.id, name: data.name, barbershopId: data.barbershop_id || undefined };
};
