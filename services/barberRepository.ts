import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { BarberOption } from '../types';
import { generateId, isUuid } from '../utils';

// This key is for local storage fallback when Supabase is not configured
const SETTINGS_STORAGE_KEY = 'barbearia_settings';

type DatabaseBarberRow = {
  id: string;
  name: string;
  barbershop_id: string | null;
  active: boolean; // Assuming active is always present in DB
};

export type ListBarbersOptions = {
  includeInactive?: boolean;
};

export type CreateBarberInput = {
  name: string;
  barbershopId?: string;
  active?: boolean;
};

export type UpdateBarberInput = {
  name?: string;
  active?: boolean;
};

const readLocalSettings = (): { barbers?: Array<string | BarberOption> } => {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const writeLocalBarbers = (barbers: BarberOption[]) => {
  try {
    const current = readLocalSettings();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      ...current,
      barbers
    }));
  } catch {
    // Ignore local persistence failures.
  }
};

const isLocalTenantMatch = (itemBarbershopId: string | undefined, barbershopId?: string): boolean => {
  if (!barbershopId) return true;
  if (barbershopId === 'local-barbershop') return !itemBarbershopId || itemBarbershopId === barbershopId;
  return itemBarbershopId === barbershopId;
};

const listLocalBarbers = (barbershopId?: string, options?: ListBarbersOptions): BarberOption[] => {
  try {
    const settings = readLocalSettings();
    // For local storage, barbers might just be strings. Convert to BarberOption.
    const localBarbers = Array.isArray(settings.barbers) && settings.barbers.every((b: any) => typeof b === 'string' || (typeof b === 'object' && 'name' in b && 'id' in b))
      ? settings.barbers.map((b: string | BarberOption) =>
          typeof b === 'string' ? { id: b, name: b, active: true } : { ...b, active: b.active ?? true }
        )
      : [];

    return localBarbers.filter((barber: BarberOption) => (
      isLocalTenantMatch(barber.barbershopId, barbershopId)
      && (options?.includeInactive || barber.active !== false)
    ));
  } catch {
    return [];
  }
};

export const listBarbers = async (barbershopId?: string, options?: ListBarbersOptions): Promise<BarberOption[]> => {
  if (!isSupabaseConfigured || !supabase) return listLocalBarbers(barbershopId, options);

  let query = supabase
    .from('barbers')
    .select('id,name,barbershop_id,active');
  
  if (barbershopId) {
    query = query.eq('barbershop_id', barbershopId);
  }

  if (!options?.includeInactive) {
    query = query.eq('active', true);
  }

  const { data, error } = await query
    .order('name', { ascending: true })
    .returns<DatabaseBarberRow[]>(); // Explicitly cast to ensure type safety

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    barbershopId: row.barbershop_id || undefined,
    active: row.active
  }));
};

export const createBarber = async ({ name, barbershopId, active = true }: CreateBarberInput): Promise<BarberOption> => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Informe o nome do barbeiro.');
  }

  if (!isSupabaseConfigured || !supabase) {
    const created: BarberOption = {
      id: generateId(),
      name: trimmedName,
      barbershopId,
      active
    };
    const current = listLocalBarbers(undefined, { includeInactive: true });
    writeLocalBarbers([created, ...current.filter((barber) => barber.id !== created.id)]);
    return created;
  }

  if (!barbershopId) {
    throw new Error('Barbearia nao encontrada para criar barbeiro.');
  }

  if (!isUuid(barbershopId)) {
    throw new Error('Sua conta nao possui uma barbearia valida para cadastrar barbeiro.');
  }

  const { data, error } = await supabase
    .from('barbers')
    .insert({
      name: trimmedName,
      barbershop_id: barbershopId,
      active
    })
    .select('id,name,barbershop_id,active')
    .single()
    .returns<DatabaseBarberRow>(); // Explicitly cast to ensure type safety
  
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    barbershopId: data.barbershop_id || undefined,
    active: data.active
  };
};

export const updateBarber = async (
  barberId: string,
  patch: UpdateBarberInput,
  barbershopId?: string
): Promise<BarberOption> => {
  if (!barberId.trim()) {
    throw new Error('Barbeiro nao encontrado.');
  }

  const normalizedName = typeof patch.name === 'string' ? patch.name.trim() : undefined;

  if (normalizedName !== undefined && !normalizedName) {
    throw new Error('Informe o nome do barbeiro.');
  }

  if (!isSupabaseConfigured || !supabase) {
    const current = listLocalBarbers(undefined, { includeInactive: true });
    const next = current.map((barber) => (
      barber.id === barberId
        ? {
            ...barber,
            name: normalizedName ?? barber.name,
            active: patch.active ?? barber.active ?? true
          }
        : barber
    ));
    writeLocalBarbers(next);
    const updated = next.find((barber) => barber.id === barberId);
    if (!updated) throw new Error('Barbeiro nao encontrado.');
    return updated;
  }

  if (barbershopId && !isUuid(barbershopId)) {
    throw new Error('Sua conta nao possui uma barbearia valida para atualizar barbeiro.');
  }

  let query = supabase
    .from('barbers')
    .update({
      ...(normalizedName !== undefined ? { name: normalizedName } : {}),
      ...(typeof patch.active === 'boolean' ? { active: patch.active } : {})
    })
    .eq('id', barberId);

  if (barbershopId) {
    query = query.eq('barbershop_id', barbershopId);
  }

  const { data, error } = await query
    .select('id,name,barbershop_id,active')
    .single<DatabaseBarberRow>();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    barbershopId: data.barbershop_id || undefined,
    active: data.active
  };
};
