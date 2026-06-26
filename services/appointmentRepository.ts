
import { assertOperationalSupabase, shouldUseLocalFallback, supabase } from '../lib/supabase';
import { Appointment } from '../types';
import { APPOINTMENT_STORAGE_KEY, getAppointmentDateInput, hasAppointmentConflict } from '../scheduling';

export type DatabaseAppointmentRow = {
  id: string;
  barbershop_id: string | null; // Added for multi-tenancy
  client_name: string;
  client_phone: string;
  barber_id: string | null;
  barber_name: string;
  service_id: string | null;
  service_type: string;
  service_value: number | string;
  start_at: string;
  end_at: string;
  status: Appointment['status'];
  notes: string | null;
  financial_record_id: string | null;
  created_at: string;
  updated_at: string;
};

type DatabaseAppointmentInsert = Omit<
  DatabaseAppointmentRow,
  'id' | 'created_at' | 'updated_at'
>;

type DatabasePublicAppointmentSlotRow = {
  barber_id: string | null;
  barber_name: string;
  barbershop_id: string | null; // Added for multi-tenancy
  start_at: string;
  end_at: string;
  status: Appointment['status'];
};

type DatabaseTenantEntityRow = {
  id: string;
  barbershop_id: string | null;
};

const nullableUuid = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const mapAppointmentFromDb = (row: DatabaseAppointmentRow): Appointment => ({
  id: row.id,
  barbershopId: row.barbershop_id || undefined,
  barberId: row.barber_id || undefined,
  serviceId: row.service_id || undefined,
  financialRecordId: row.financial_record_id || undefined,
  clientName: row.client_name,
  clientPhone: row.client_phone,
  barberName: row.barber_name,
  serviceType: row.service_type,
  serviceValue: Number(row.service_value) || 0,
  startAt: row.start_at,
  endAt: row.end_at,
  status: row.status,
  notes: row.notes || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapAppointmentToDb = (appointment: Appointment): DatabaseAppointmentInsert => ({
  barbershop_id: nullableUuid(appointment.barbershopId),
  client_name: appointment.clientName,
  client_phone: appointment.clientPhone || '',
  barber_id: nullableUuid(appointment.barberId),
  barber_name: appointment.barberName,
  service_id: nullableUuid(appointment.serviceId),
  service_type: appointment.serviceType,
  service_value: appointment.serviceValue,
  start_at: appointment.startAt,
  end_at: appointment.endAt,
  status: appointment.status,
  notes: appointment.notes || null,
  financial_record_id: appointment.financialRecordId || null
});

const readLocalAppointments = (): Appointment[] => {
  try {
    const saved = localStorage.getItem(APPOINTMENT_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalAppointments = (appointments: Appointment[]) => {
  localStorage.setItem(APPOINTMENT_STORAGE_KEY, JSON.stringify(appointments));
};

const countLocalAppointmentsBy = (
  field: 'barberId' | 'serviceId',
  entityId: string,
  barbershopId?: string
): number => {
  return readLocalAppointments().filter((appointment) => (
    appointment[field] === entityId
    && (!barbershopId || appointment.barbershopId === barbershopId)
  )).length;
};

const countRemoteAppointmentsBy = async (
  column: 'barber_id' | 'service_id',
  entityId: string,
  barbershopId?: string
): Promise<number> => {
  if (!supabase) return 0;

  let query = supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq(column, entityId);

  if (barbershopId) {
    query = query.eq('barbershop_id', barbershopId);
  }

  const { count, error } = await query;

  if (error) throw error;

  return count || 0;
};

export const countAppointmentsForBarber = async (barberId: string, barbershopId?: string): Promise<number> => {
  if (!barberId.trim()) return 0;
  if (shouldUseLocalFallback) {
    return countLocalAppointmentsBy('barberId', barberId, barbershopId);
  }
  assertOperationalSupabase();

  return countRemoteAppointmentsBy('barber_id', barberId, barbershopId);
};

export const countAppointmentsForService = async (serviceId: string, barbershopId?: string): Promise<number> => {
  if (!serviceId.trim()) return 0;
  if (shouldUseLocalFallback) {
    return countLocalAppointmentsBy('serviceId', serviceId, barbershopId);
  }
  assertOperationalSupabase();

  return countRemoteAppointmentsBy('service_id', serviceId, barbershopId);
};

export const listInternalAppointments = async (barbershopId?: string, barberId?: string): Promise<Appointment[]> => {
  if (shouldUseLocalFallback) return readLocalAppointments();
  assertOperationalSupabase();

  let query = supabase
    .from('appointments')
    .select('*');

  if (barbershopId) {
    query = query.eq('barbershop_id', barbershopId);
  }

  query = query
    .order('start_at', { ascending: true });

  if (barberId) {
    query = query.eq('barber_id', barberId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return ((data || []) as DatabaseAppointmentRow[]).map(mapAppointmentFromDb);
};

export const listPublicAppointmentSlots = async (barbershopId?: string): Promise<Appointment[]> => {
  if (shouldUseLocalFallback) return readLocalAppointments();
  assertOperationalSupabase();

  let query = supabase
    .from('public_appointment_slots')
    .select('barbershop_id,barber_id,barber_name,start_at,end_at,status');

  if (barbershopId) {
    query = query.eq('barbershop_id', barbershopId);
  }

  const { data, error } = await query
    .order('start_at', { ascending: true });

  if (error) throw error;

  return ((data || []) as DatabasePublicAppointmentSlotRow[]).map((row, index) => ({
    id: `slot-${row.barber_id || row.barber_name}-${row.start_at}-${index}`,
    barberId: row.barber_id || undefined,
    barbershopId: row.barbershop_id || undefined,
    clientName: 'Horario ocupado',
    clientPhone: '',
    barberName: row.barber_name,
    serviceType: 'Ocupado',
    serviceValue: 0,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    createdAt: row.start_at,
    updatedAt: row.start_at,
    notes: undefined
  }));
};

export const listAppointmentsByDate = async (date: string): Promise<Appointment[]> => {
  const appointments = await listInternalAppointments();

  return appointments.filter(appointment => getAppointmentDateInput(appointment) === date);
};

const assertAppointmentTenantIntegrity = async (appointment: Appointment): Promise<void> => {
  const barbershopId = nullableUuid(appointment.barbershopId);

  if (shouldUseLocalFallback || !barbershopId) return;
  assertOperationalSupabase();

  const checks: Array<Promise<void>> = [];

  if (appointment.barberId) {
    checks.push((async () => {
      const { data, error } = await supabase
        .from('barbers')
        .select('id,barbershop_id')
        .eq('id', appointment.barberId)
        .eq('active', true)
        .maybeSingle<DatabaseTenantEntityRow>();

      if (error) throw error;
      if (!data || data.barbershop_id !== barbershopId) {
        throw new Error('Barbeiro invalido para esta barbearia.');
      }
    })());
  }

  if (appointment.serviceId) {
    checks.push((async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id,barbershop_id')
        .eq('id', appointment.serviceId)
        .eq('active', true)
        .maybeSingle<DatabaseTenantEntityRow>();

      if (error) throw error;
      if (!data || data.barbershop_id !== barbershopId) {
        throw new Error('Servico invalido para esta barbearia.');
      }
    })());
  }

  await Promise.all(checks);
};

export const createAppointment = async ( // This function is used by both internal and public booking
  appointment: Appointment,
  existingAppointments?: Appointment[]
): Promise<Appointment> => {
  const appointments = existingAppointments || await listPublicAppointmentSlots(appointment.barbershopId);

  if (hasAppointmentConflict(appointments, appointment)) {
    throw new Error('Horario indisponivel para este barbeiro.');
  }

  if (shouldUseLocalFallback) {
    writeLocalAppointments([appointment, ...appointments]);
    return appointment;
  }
  assertOperationalSupabase();

  await assertAppointmentTenantIntegrity(appointment);

  // Public booking must insert without requesting RETURNING rows, so anon does not need SELECT on appointments.
  const { error } = await supabase
    .from('appointments')
    .insert(mapAppointmentToDb(appointment), { defaultToNull: true });

  if (error) {
    console.error('Failed to create appointment', error);
    throw error;
  }

  return appointment;
};

export const updateAppointment = async (
  id: string,
  patch: Partial<Appointment>
): Promise<Appointment> => {
  if (shouldUseLocalFallback) {
    const appointments = readLocalAppointments();

    const updated = appointments.map(appointment => (
      appointment.id === id
        ? { ...appointment, ...patch, updatedAt: patch.updatedAt || new Date().toISOString() }
        : appointment
    ));

    writeLocalAppointments(updated);

    const result = updated.find(appointment => appointment.id === id);
    if (!result) throw new Error('Agendamento nao encontrado.');

    return result;
  }
  assertOperationalSupabase();

  const current = (await listInternalAppointments()).find(appointment => appointment.id === id);
  if (!current) throw new Error('Agendamento nao encontrado.');

  const next = {
    ...current,
    ...patch,
    updatedAt: patch.updatedAt || new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('appointments')
    .update(mapAppointmentToDb(next))
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update appointment', error);
    throw error;
  }

  return mapAppointmentFromDb(data as DatabaseAppointmentRow);
};

export const deleteAppointment = async (id: string): Promise<void> => {
  if (shouldUseLocalFallback) {
    writeLocalAppointments(readLocalAppointments().filter(appointment => appointment.id !== id));
    return;
  }
  assertOperationalSupabase();

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete appointment', error);
    throw error;
  }
};
