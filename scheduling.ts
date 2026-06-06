import { Appointment, AppSettings, Client, ClientType, Service, ServiceType } from './types';

export const APPOINTMENT_STORAGE_KEY = 'barbearia_appointments';
export const PUBLIC_BOOKING_WORKDAY_START = '09:00';
export const PUBLIC_BOOKING_WORKDAY_END = '18:00';
export const PUBLIC_BOOKING_SLOT_STEP_MINUTES = 30;

export type TimeSlot = {
  startAt: string;
  endAt: string;
  label: string;
  available: boolean;
};

export type PublicBookingInput = {
  clientName: string;
  clientPhone: string;
  barberName: string;
  service?: Service;
  selectedSlot?: TimeSlot | null;
  notes?: string;
};

export type PublicBookingValidationResult = {
  valid: boolean;
  errors: string[];
};

export const normalizePhoneDigits = (phone?: string): string => {
  return (phone || '').replace(/\D/g, '');
};

export const toLocalDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toLocalTimeInputValue = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const buildLocalDateTimeIso = (dateInput: string, timeInput: string): string => {
  const [year, month, day] = dateInput.split('-').map(Number);
  const [hours, minutes] = timeInput.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes || 0, 0, 0).toISOString();
};

export const addMinutesIso = (isoDate: string, minutes: number): string => {
  return new Date(new Date(isoDate).getTime() + minutes * 60 * 1000).toISOString();
};

const getMinutesFromTimeInput = (timeInput: string): number => {
  const [hours, minutes] = timeInput.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const getTimeInputFromMinutes = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const getAppointmentDateInput = (appointment: Appointment): string => {
  return toLocalDateInputValue(new Date(appointment.startAt));
};

export const hasAppointmentConflict = (
  appointments: Appointment[],
  candidate: Pick<Appointment, 'barberName' | 'startAt' | 'endAt'>,
  editingAppointmentId?: string
): boolean => {
  const newStart = new Date(candidate.startAt).getTime();
  const newEnd = new Date(candidate.endAt).getTime();

  return appointments.some(existing => {
    if (existing.id === editingAppointmentId) return false;
    if (existing.status === 'cancelled') return false;
    if (existing.barberName !== candidate.barberName) return false;

    const existingStart = new Date(existing.startAt).getTime();
    const existingEnd = new Date(existing.endAt).getTime();
    return newStart < existingEnd && newEnd > existingStart;
  });
};

export const getAvailableTimeSlots = (params: {
  date: string;
  barberName: string;
  serviceDurationMinutes: number;
  appointments: Appointment[];
  workdayStart?: string;
  workdayEnd?: string;
  slotStepMinutes?: number;
  now?: Date;
}): TimeSlot[] => {
  const {
    date,
    barberName,
    serviceDurationMinutes,
    appointments,
    workdayStart = PUBLIC_BOOKING_WORKDAY_START,
    workdayEnd = PUBLIC_BOOKING_WORKDAY_END,
    slotStepMinutes = PUBLIC_BOOKING_SLOT_STEP_MINUTES,
    now = new Date()
  } = params;

  if (!date || !barberName || serviceDurationMinutes <= 0) return [];

  const startMinutes = getMinutesFromTimeInput(workdayStart);
  const endMinutes = getMinutesFromTimeInput(workdayEnd);
  const slots: TimeSlot[] = [];

  for (let minutes = startMinutes; minutes + serviceDurationMinutes <= endMinutes; minutes += slotStepMinutes) {
    const startAt = buildLocalDateTimeIso(date, getTimeInputFromMinutes(minutes));
    const endAt = addMinutesIso(startAt, serviceDurationMinutes);
    const startDate = new Date(startAt);

    if (startDate.getTime() <= now.getTime()) {
      continue;
    }

    const available = !hasAppointmentConflict(appointments, { barberName, startAt, endAt });
    slots.push({
      startAt,
      endAt,
      label: toLocalTimeInputValue(startDate),
      available
    });
  }

  return slots;
};

export const validatePublicBookingInput = (
  input: PublicBookingInput,
  appointments: Appointment[]
): PublicBookingValidationResult => {
  const errors: string[] = [];
  const phoneDigits = normalizePhoneDigits(input.clientPhone);

  if (!input.barberName) errors.push('Escolha um barbeiro.');
  if (!input.service) errors.push('Escolha um servico.');
  if (!input.selectedSlot) errors.push('Escolha um horario disponivel.');
  if (!input.clientName.trim()) errors.push('Informe seu nome.');
  if (!phoneDigits || phoneDigits.length < 10) errors.push('Informe um WhatsApp valido com DDD.');

  if (input.selectedSlot && input.barberName) {
    const hasConflict = hasAppointmentConflict(appointments, {
      barberName: input.barberName,
      startAt: input.selectedSlot.startAt,
      endAt: input.selectedSlot.endAt
    });
    if (hasConflict) errors.push('Este horario acabou de ficar indisponivel.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

export const createPublicAppointment = (
  input: PublicBookingInput,
  id: string,
  now: Date = new Date()
): Appointment => {
  if (!input.service || !input.selectedSlot) {
    throw new Error('Cannot create appointment without service and slot.');
  }

  const timestamp = now.toISOString();
  return {
    id,
    clientName: input.clientName.trim(),
    clientPhone: normalizePhoneDigits(input.clientPhone),
    barberName: input.barberName,
    serviceType: input.service.name,
    serviceValue: input.service.price,
    startAt: input.selectedSlot.startAt,
    endAt: input.selectedSlot.endAt,
    status: 'scheduled',
    notes: input.notes?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export const buildWhatsAppLink = (appointment: Appointment): string | null => {
  const digits = normalizePhoneDigits(appointment.clientPhone);
  if (!digits) return null;

  const localDate = new Date(appointment.startAt);
  const date = localDate.toLocaleDateString('pt-BR');
  const time = localDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const message = `Ola, ${appointment.clientName}. Seu horario com ${appointment.barberName} esta agendado para ${date} as ${time}. Servico: ${appointment.serviceType}.`;

  return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
};

export const serviceNameToServiceType = (serviceName: string): ServiceType => {
  const service = Object.values(ServiceType).find(value => value === serviceName);
  return service || ServiceType.OTHER;
};

export const appointmentToClient = (
  appointment: Appointment,
  settings: AppSettings,
  id: string
): Client => {
  const serviceType = serviceNameToServiceType(appointment.serviceType);
  const rate = settings.services.find(service => service.name === appointment.serviceType)?.commissionRate
    ?? settings.commissionRate;
  const commissionValue = serviceType === ServiceType.PRODUCT ? 0 : appointment.serviceValue * (rate / 100);

  return {
    id,
    appointmentId: appointment.id,
    name: appointment.clientName,
    phone: appointment.clientPhone,
    barberName: appointment.barberName,
    serviceType,
    clientType: ClientType.RETURNING,
    serviceValue: appointment.serviceValue,
    extraValue: 0,
    totalValue: appointment.serviceValue,
    commissionValue,
    timestamp: new Date(appointment.startAt).getTime(),
    description: appointment.notes ? `Agendamento: ${appointment.notes}` : 'Atendimento gerado pela agenda',
    products: []
  };
};

export const completeAppointmentFinancialRecord = (
  appointment: Appointment,
  clients: Client[],
  settings: AppSettings,
  createId: () => string
): { clients: Client[]; created: boolean } => {
  const alreadyExists = clients.some(client => client.appointmentId === appointment.id);
  if (alreadyExists) {
    return { clients, created: false };
  }

  return {
    clients: [appointmentToClient(appointment, settings, createId()), ...clients],
    created: true
  };
};
