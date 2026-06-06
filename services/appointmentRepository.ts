import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Appointment } from '../types';
import { APPOINTMENT_STORAGE_KEY, getAppointmentDateInput, hasAppointmentConflict } from '../scheduling';

export type DatabaseAppointmentRow = {
  id: string;
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

type DatabaseAppointmentInsert = Omit<DatabaseAppointmentRow, 'created_at' | 'updated_at'>;

type DatabasePublicAppointmentSlotRow = {
  barber_id: string | null;
  barber_name: string;
  start_at: string;
  end_at: string;
  status: Appointment['status'];
};

export const mapAppointmentFromDb = (row: DatabaseAppointmentRow): Appointment => ({
  id: row.id,
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
  id: appointment.id,
  client_name: appointment.clientName,
  client_phone: appointment.clientPhone || '',
  barber_id: appointment.barberId || null,
  barber_name: appointment.barberName,
  service_id: appointment.serviceId || null,
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

export const listAppointments = async (): Promise<Appointment[]> => {
  if (!isSupabaseConfigured || !supabase) return readLocalAppointments();

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('start_at', { ascending: true });

  if (error) throw error;
  return ((data || []) as DatabaseAppointmentRow[]).map(mapAppointmentFromDb);
};

export const listPublicAppointmentSlots = async (): Promise<Appointment[]> => {
  if (!isSupabaseConfigured || !supabase) return readLocalAppointments();

  const { data, error } = await supabase
    .from('public_appointment_slots')
    .select('barber_id,barber_name,start_at,end_at,status')
    .order('start_at', { ascending: true });

  if (error) throw error;

  return ((data || []) as DatabasePublicAppointmentSlotRow[]).map((row, index) => ({
    id: `slot-${row.barber_id || row.barber_name}-${row.start_at}-${index}`,
    barberId: row.barber_id || undefined,
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
  const appointments = await listAppointments();
  return appointments.filter(appointment => getAppointmentDateInput(appointment) === date);
};

export const createAppointment = async (
  appointment: Appointment,
  existingAppointments?: Appointment[]
): Promise<Appointment> => {
  const appointments = existingAppointments || await listAppointments();
  if (hasAppointmentConflict(appointments, appointment)) {
    throw new Error('Horario indisponivel para este barbeiro.');
  }

  if (!isSupabaseConfigured || !supabase) {
    writeLocalAppointments([appointment, ...appointments]);
    return appointment;
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert(mapAppointmentToDb(appointment))
    .select()
    .single();

  if (error) throw error;
  return mapAppointmentFromDb(data as DatabaseAppointmentRow);
};

export const updateAppointment = async (
  id: string,
  patch: Partial<Appointment>
): Promise<Appointment> => {
  if (!isSupabaseConfigured || !supabase) {
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

  const current = (await listAppointments()).find(appointment => appointment.id === id);
  if (!current) throw new Error('Agendamento nao encontrado.');
  const next = { ...current, ...patch, updatedAt: patch.updatedAt || new Date().toISOString() };

  const { data, error } = await supabase
    .from('appointments')
    .update(mapAppointmentToDb(next))
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapAppointmentFromDb(data as DatabaseAppointmentRow);
};

export const deleteAppointment = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured || !supabase) {
    writeLocalAppointments(readLocalAppointments().filter(appointment => appointment.id !== id));
    return;
  }

  const { error } = await supabase.from('appointments').delete().eq('id', id);
  if (error) throw error;
};
