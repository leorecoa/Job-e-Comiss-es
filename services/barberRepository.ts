import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { BarberOption } from '../types';

type DatabaseBarberRow = {
  id: string;
  name: string;
  active: boolean;
};

const LOCAL_BARBERS_STORAGE_KEY = 'gestao-maxima-barbers';

const mapBarberFromDb = (row: DatabaseBarberRow): BarberOption => ({
  id: row.id,
  name: row.name
});

const normalizeLocalBarber = (barber: unknown, index: number): BarberOption | null => {
  if (typeof barber === 'string') {
    const name = barber.trim();

    if (!name) return null;

    return {
      id: `local-barber-${index}`,
      name
    };
  }

  if (
    typeof barber === 'object' &&
    barber !== null &&
    'id' in barber &&
    'name' in barber
  ) {
    const candidate = barber as Partial<BarberOption>;
    const name = candidate.name?.trim();

    if (!name) return null;

    return {
      id: candidate.id?.trim() || `local-barber-${index}`,
      name
    };
  }

  return null;
};

const readLocalBarbers = (): BarberOption[] => {
  try {
    const saved = localStorage.getItem(LOCAL_BARBERS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeLocalBarber)
      .filter((barber): barber is BarberOption => Boolean(barber));
  } catch {
    return [];
  }
};

export const listBarbers = async (): Promise<BarberOption[]> => {
  if (!isSupabaseConfigured || !supabase) {
    return readLocalBarbers();
  }

  const { data, error } = await supabase
    .from('barbers')
    .select('id,name,active')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) throw error;

  return ((data || []) as DatabaseBarberRow[]).map(mapBarberFromDb);
};