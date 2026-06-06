import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SETTINGS_STORAGE_KEY = 'barbearia_settings';

type DatabaseBarberRow = {
  id: string;
  name: string;
  active: boolean;
};

const listLocalBarbers = (): string[] => {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = saved ? JSON.parse(saved) : {};
    return Array.isArray(settings.barbers) ? settings.barbers : [];
  } catch {
    return [];
  }
};

export const listBarbers = async (): Promise<string[]> => {
  if (!isSupabaseConfigured || !supabase) return listLocalBarbers();

  const { data, error } = await supabase
    .from('barbers')
    .select('id,name,active')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return ((data || []) as DatabaseBarberRow[]).map(row => row.name);
};

export const createBarber = async (name: string): Promise<string> => {
  if (!isSupabaseConfigured || !supabase) return name;

  const { data, error } = await supabase
    .from('barbers')
    .insert({ name })
    .select('name')
    .single();

  if (error) throw error;
  return (data as { name: string }).name;
};
