import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_SETTINGS, Service } from '../types';

const SETTINGS_STORAGE_KEY = 'barbearia_settings';

type DatabaseServiceRow = {
  id: string;
  name: string;
  price: number | string;
  duration_minutes: number;
  commission_rate: number | string | null;
  active: boolean;
};

export const mapServiceFromDb = (row: DatabaseServiceRow): Service => ({
  id: row.id,
  name: row.name,
  price: Number(row.price) || 0,
  durationMinutes: Number(row.duration_minutes) || 30,
  commissionRate: row.commission_rate === null ? undefined : Number(row.commission_rate)
});

const listLocalServices = (): Service[] => {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = saved ? JSON.parse(saved) : {};
    return Array.isArray(settings.services) && settings.services.length > 0
      ? settings.services
      : DEFAULT_SETTINGS.services;
  } catch {
    return DEFAULT_SETTINGS.services;
  }
};

export const listServices = async (): Promise<Service[]> => {
  if (!isSupabaseConfigured || !supabase) return listLocalServices();

  const { data, error } = await supabase
    .from('services')
    .select('id,name,price,duration_minutes,commission_rate,active')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return ((data || []) as DatabaseServiceRow[]).map(mapServiceFromDb);
};

export const createService = async (service: Service): Promise<Service> => {
  if (!isSupabaseConfigured || !supabase) return service;

  const { data, error } = await supabase
    .from('services')
    .insert({
      id: service.id,
      name: service.name,
      price: service.price,
      duration_minutes: service.durationMinutes,
      commission_rate: service.commissionRate ?? null
    })
    .select('id,name,price,duration_minutes,commission_rate,active')
    .single();

  if (error) throw error;
  return mapServiceFromDb(data as DatabaseServiceRow);
};
