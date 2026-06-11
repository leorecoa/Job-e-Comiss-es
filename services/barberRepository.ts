import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { BarberOption } from '../types';

// This key is for local storage fallback when Supabase is not configured
const SETTINGS_STORAGE_KEY = 'barbearia_settings';

type DatabaseBarberRow = {
  id: string;
  name: string;
  active: boolean; // Assuming active is always present in DB
};

const listLocalBarbers = (): BarberOption[] => {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = saved ? JSON.parse(saved) : {};
    // For local storage, barbers might just be strings. Convert to BarberOption.
    return Array.isArray(settings.barbers) && settings.barbers.every((b: any) => typeof b === 'string' || (typeof b === 'object' && 'name' in b && 'id' in b))
      ? settings.barbers.map((b: string | BarberOption) =>
          typeof b === 'string' ? { id: b, name: b } : b
        )
      : [];
  } catch {
    return [];
  }
};

export const listBarbers = async (barbershopId?: string): Promise<BarberOption[]> => {
  if (!isSupabaseConfigured || !supabase) return listLocalBarbers();

  let query = supabase
    .from('barbers')
    .select('id,name,active')
    .eq('active', true);
  
  if (barbershopId) {
    query = query.eq('barbershop_id', barbershopId);
  }

  const { data, error } = await query
    .order('name', { ascending: true })
    .returns<DatabaseBarberRow[]>(); // Explicitly cast to ensure type safety

  if (error) throw error;
  return (data || []).map(row => ({ id: row.id, name: row.name }));
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
    .select('id,name') // Select id and name to return BarberOption
    .single()
    .returns<DatabaseBarberRow>(); // Explicitly cast to ensure type safety
  
  if (error) throw error;
  return { id: data.id, name: data.name };
};
