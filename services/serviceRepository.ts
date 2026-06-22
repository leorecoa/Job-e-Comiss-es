import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_SETTINGS, Service } from '../types';

const SETTINGS_STORAGE_KEY = 'barbearia_settings';

type DatabaseServiceRow = {
  id: string;
  name: string;
  barbershop_id: string | null;
  price: number | string;
  duration_minutes: number;
  commission_rate: number | string | null;
  active: boolean;
};

export const mapServiceFromDb = (row: DatabaseServiceRow): Service => ({
  id: row.id,
  name: row.name,
  barbershopId: row.barbershop_id || undefined,
  price: Number(row.price) || 0,
  durationMinutes: Number(row.duration_minutes) || 30,
  commissionRate: row.commission_rate === null ? undefined : Number(row.commission_rate)
});

const isLocalTenantMatch = (itemBarbershopId: string | undefined, barbershopId?: string): boolean => {
  if (!barbershopId) return true;
  if (barbershopId === 'local-barbershop') return !itemBarbershopId || itemBarbershopId === barbershopId;
  return itemBarbershopId === barbershopId;
};

const listLocalServices = (barbershopId?: string): Service[] => {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = saved ? JSON.parse(saved) : {};
    // Ensure local services are always of type Service
    // Filter by barbershopId if provided, otherwise return all local services
    const allLocalServices = Array.isArray(settings.services)
      ? settings.services.map((s: any) => ({
          id: s.id || s.name, // Fallback ID if not present
          name: s.name,
          barbershopId: typeof s.barbershopId === 'string' ? s.barbershopId : undefined,
          price: Number(s.price) || 0,
          durationMinutes: Number(s.durationMinutes) || 30,
          commissionRate: Number(s.commissionRate) || undefined
        }))
      : DEFAULT_SETTINGS.services; // Fallback to default if no services in local storage

    return allLocalServices.filter((service: Service) => isLocalTenantMatch(service.barbershopId, barbershopId));
  } catch {
    return DEFAULT_SETTINGS.services.filter((service: Service) => isLocalTenantMatch(service.barbershopId, barbershopId));
  }
};

export const listServices = async (barbershopId?: string): Promise<Service[]> => {
  if (!isSupabaseConfigured || !supabase) return listLocalServices(barbershopId);

  let query = supabase
    .from('services')
    .select('id,name,barbershop_id,price,duration_minutes,commission_rate,active')
    .eq('active', true);

  if (barbershopId) {
    query = query.eq('barbershop_id', barbershopId);
  }

  const { data, error } = await query
    .order('name', { ascending: true });

  if (error) throw error;
  return ((data || []) as DatabaseServiceRow[]).map(mapServiceFromDb);
};

export const createService = async (service: Service): Promise<Service> => {
  if (!isSupabaseConfigured || !supabase) return service;
  // TODO: When multi-tenancy is fully implemented, barbershopId should be passed here.
  const { data, error } = await supabase
    .from('services')
    .insert({
      id: service.id,
      name: service.name,
      price: service.price,
      duration_minutes: service.durationMinutes,
      commission_rate: service.commissionRate ?? null
    })
    .select('id,name,barbershop_id,price,duration_minutes,commission_rate,active')
    .single();

  if (error) throw error;
  return mapServiceFromDb(data as DatabaseServiceRow);
};
