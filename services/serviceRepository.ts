import { assertOperationalSupabase, shouldUseLocalFallback, supabase } from '../lib/supabase';
import { DEFAULT_SETTINGS, Service } from '../types';
import { generateId, isUuid } from '../utils';
import { countAppointmentsForService } from './appointmentRepository';

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

export type ListServicesOptions = {
  includeInactive?: boolean;
};

export type CreateServiceInput = {
  id?: string;
  name: string;
  price: number;
  durationMinutes: number;
  commissionRate?: number;
  barbershopId?: string;
  active?: boolean;
};

export type UpdateServiceInput = {
  name?: string;
  price?: number;
  durationMinutes?: number;
  commissionRate?: number;
  active?: boolean;
};

export type RemoveServiceResult = {
  action: 'deleted' | 'deactivated';
  serviceId: string;
};

const readLocalSettings = (): { services?: Service[] } => {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const writeLocalServices = (services: Service[]) => {
  try {
    const current = readLocalSettings();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      ...current,
      services
    }));
  } catch {
    // Ignore local persistence failures.
  }
};

export const mapServiceFromDb = (row: DatabaseServiceRow): Service => ({
  id: row.id,
  name: row.name,
  barbershopId: row.barbershop_id || undefined,
  price: Number(row.price) || 0,
  durationMinutes: Number(row.duration_minutes) || 30,
  commissionRate: row.commission_rate === null ? undefined : Number(row.commission_rate),
  active: row.active
});

const isLocalTenantMatch = (itemBarbershopId: string | undefined, barbershopId?: string): boolean => {
  if (!barbershopId) return true;
  if (barbershopId === 'local-barbershop') return !itemBarbershopId || itemBarbershopId === barbershopId;
  return itemBarbershopId === barbershopId;
};

const listLocalServices = (barbershopId?: string, options?: ListServicesOptions): Service[] => {
  try {
    const settings = readLocalSettings();
    // Ensure local services are always of type Service
    // Filter by barbershopId if provided, otherwise return all local services
    const allLocalServices = Array.isArray(settings.services)
      ? settings.services.map((s: any) => ({
          id: s.id || s.name, // Fallback ID if not present
          name: s.name,
          barbershopId: typeof s.barbershopId === 'string' ? s.barbershopId : undefined,
          price: Number(s.price) || 0,
          durationMinutes: Number(s.durationMinutes) || 30,
          commissionRate: s.commissionRate === undefined || s.commissionRate === null || s.commissionRate === ''
            ? undefined
            : Number(s.commissionRate),
          active: s.active !== false
        }))
      : DEFAULT_SETTINGS.services.map((service) => ({ ...service, active: true })); // Fallback to default if no services in local storage

    return allLocalServices.filter((service: Service) => (
      isLocalTenantMatch(service.barbershopId, barbershopId)
      && (options?.includeInactive || service.active !== false)
    ));
  } catch {
    return DEFAULT_SETTINGS.services
      .map((service) => ({ ...service, active: true }))
      .filter((service: Service) => isLocalTenantMatch(service.barbershopId, barbershopId));
  }
};

export const listServices = async (barbershopId?: string, options?: ListServicesOptions): Promise<Service[]> => {
  if (shouldUseLocalFallback) return listLocalServices(barbershopId, options);
  assertOperationalSupabase();

  let query = supabase
    .from('services')
    .select('id,name,barbershop_id,price,duration_minutes,commission_rate,active');

  if (barbershopId) {
    query = query.eq('barbershop_id', barbershopId);
  }

  if (!options?.includeInactive) {
    query = query.eq('active', true);
  }

  const { data, error } = await query
    .order('name', { ascending: true });

  if (error) throw error;
  return ((data || []) as DatabaseServiceRow[]).map(mapServiceFromDb);
};

export const createService = async (service: CreateServiceInput): Promise<Service> => {
  const name = service.name.trim();
  const price = Math.max(0, Number(service.price) || 0);
  const durationMinutes = Math.max(1, Number(service.durationMinutes) || 30);
  const commissionRate = service.commissionRate === undefined ? undefined : Math.max(0, Math.min(100, Number(service.commissionRate) || 0));

  if (!name) {
    throw new Error('Informe o nome do servico.');
  }

  if (shouldUseLocalFallback) {
    const created: Service = {
      id: service.id || generateId(),
      name,
      barbershopId: service.barbershopId,
      price,
      durationMinutes,
      commissionRate,
      active: service.active ?? true
    };
    const current = listLocalServices(undefined, { includeInactive: true });
    writeLocalServices([created, ...current.filter((item) => item.id !== created.id)]);
    return created;
  }
  assertOperationalSupabase();

  if (!service.barbershopId) {
    throw new Error('Barbearia nao encontrada para criar servico.');
  }

  if (!isUuid(service.barbershopId)) {
    throw new Error('Sua conta nao possui uma barbearia valida para cadastrar servico.');
  }

  const { data, error } = await supabase
    .from('services')
    .insert({
      name,
      barbershop_id: service.barbershopId,
      price,
      duration_minutes: durationMinutes,
      commission_rate: commissionRate ?? null,
      active: service.active ?? true
    })
    .select('id,name,barbershop_id,price,duration_minutes,commission_rate,active')
    .single();

  if (error) throw error;
  return mapServiceFromDb(data as DatabaseServiceRow);
};

export const updateService = async (
  serviceId: string,
  patch: UpdateServiceInput,
  barbershopId?: string
): Promise<Service> => {
  if (!serviceId.trim()) {
    throw new Error('Servico nao encontrado.');
  }

  const normalizedName = typeof patch.name === 'string' ? patch.name.trim() : undefined;

  if (normalizedName !== undefined && !normalizedName) {
    throw new Error('Informe o nome do servico.');
  }

  const updatePayload = {
    ...(normalizedName !== undefined ? { name: normalizedName } : {}),
    ...(patch.price !== undefined ? { price: Math.max(0, Number(patch.price) || 0) } : {}),
    ...(patch.durationMinutes !== undefined ? { duration_minutes: Math.max(1, Number(patch.durationMinutes) || 30) } : {}),
    ...(patch.commissionRate !== undefined ? { commission_rate: Math.max(0, Math.min(100, Number(patch.commissionRate) || 0)) } : {}),
    ...(typeof patch.active === 'boolean' ? { active: patch.active } : {})
  };

  if (shouldUseLocalFallback) {
    const current = listLocalServices(undefined, { includeInactive: true });
    const next = current.map((service) => (
      service.id === serviceId
        ? {
            ...service,
            name: normalizedName ?? service.name,
            price: patch.price !== undefined ? Math.max(0, Number(patch.price) || 0) : service.price,
            durationMinutes: patch.durationMinutes !== undefined ? Math.max(1, Number(patch.durationMinutes) || 30) : service.durationMinutes,
            commissionRate: patch.commissionRate !== undefined ? Math.max(0, Math.min(100, Number(patch.commissionRate) || 0)) : service.commissionRate,
            active: patch.active ?? service.active ?? true
          }
        : service
    ));
    writeLocalServices(next);
    const updated = next.find((service) => service.id === serviceId);
    if (!updated) throw new Error('Servico nao encontrado.');
    return updated;
  }
  assertOperationalSupabase();

  if (barbershopId && !isUuid(barbershopId)) {
    throw new Error('Sua conta nao possui uma barbearia valida para atualizar servico.');
  }

  let query = supabase
    .from('services')
    .update(updatePayload)
    .eq('id', serviceId);

  if (barbershopId) {
    query = query.eq('barbershop_id', barbershopId);
  }

  const { data, error } = await query
    .select('id,name,barbershop_id,price,duration_minutes,commission_rate,active')
    .single<DatabaseServiceRow>();

  if (error) throw error;

  return mapServiceFromDb(data);
};

export const removeService = async (
  serviceId: string,
  barbershopId?: string
): Promise<RemoveServiceResult> => {
  if (!serviceId.trim()) {
    throw new Error('Servico nao encontrado.');
  }

  if (shouldUseLocalFallback) {
    const appointmentsCount = await countAppointmentsForService(serviceId, barbershopId);
    const current = listLocalServices(undefined, { includeInactive: true });

    if (appointmentsCount > 0) {
      const next = current.map((service) => (
        service.id === serviceId
          ? { ...service, active: false }
          : service
      ));
      writeLocalServices(next);
      return {
        action: 'deactivated',
        serviceId
      };
    }

    writeLocalServices(current.filter((service) => service.id !== serviceId));
    return {
      action: 'deleted',
      serviceId
    };
  }
  assertOperationalSupabase();

  if (!barbershopId) {
    throw new Error('Barbearia nao encontrada para remover servico.');
  }

  if (!isUuid(barbershopId)) {
    throw new Error('Sua conta nao possui uma barbearia valida para remover servico.');
  }

  const appointmentsCount = await countAppointmentsForService(serviceId, barbershopId);

  if (appointmentsCount > 0) {
    await updateService(serviceId, { active: false }, barbershopId);
    return {
      action: 'deactivated',
      serviceId
    };
  }

  const { error } = await supabase!
    .from('services')
    .delete()
    .eq('id', serviceId)
    .eq('barbershop_id', barbershopId);

  if (error) throw error;

  return {
    action: 'deleted',
    serviceId
  };
};
