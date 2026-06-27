import { Appointment, AppSettings, BarbershopBusinessDay, BarbershopBusinessDayKey, BarbershopBusinessHours, Client, ClientType, Service, ServiceType } from './types';

export const APPOINTMENT_STORAGE_KEY = 'barbearia_appointments';

export const PUBLIC_BOOKING_WEEKDAY_START = '08:00';
export const PUBLIC_BOOKING_WEEKDAY_END = '20:00';
export const PUBLIC_BOOKING_SUNDAY_START = '10:00';
export const PUBLIC_BOOKING_SUNDAY_END = '18:00';
export const PUBLIC_BOOKING_SLOT_STEP_MINUTES = 30;

export const PUBLIC_BOOKING_WORKDAY_START = PUBLIC_BOOKING_WEEKDAY_START;
export const PUBLIC_BOOKING_WORKDAY_END = PUBLIC_BOOKING_WEEKDAY_END;
export const DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES = PUBLIC_BOOKING_SLOT_STEP_MINUTES;

export const DEFAULT_BARBERSHOP_BUSINESS_HOURS: BarbershopBusinessHours = {
  sunday: { active: true, open: PUBLIC_BOOKING_SUNDAY_START, close: PUBLIC_BOOKING_SUNDAY_END },
  monday: { active: false, open: PUBLIC_BOOKING_WEEKDAY_START, close: PUBLIC_BOOKING_WEEKDAY_END },
  tuesday: { active: true, open: PUBLIC_BOOKING_WEEKDAY_START, close: PUBLIC_BOOKING_WEEKDAY_END },
  wednesday: { active: true, open: PUBLIC_BOOKING_WEEKDAY_START, close: PUBLIC_BOOKING_WEEKDAY_END },
  thursday: { active: true, open: PUBLIC_BOOKING_WEEKDAY_START, close: PUBLIC_BOOKING_WEEKDAY_END },
  friday: { active: true, open: PUBLIC_BOOKING_WEEKDAY_START, close: PUBLIC_BOOKING_WEEKDAY_END },
  saturday: { active: true, open: PUBLIC_BOOKING_WEEKDAY_START, close: PUBLIC_BOOKING_WEEKDAY_END }
};

export type TimeSlot = {
  startAt: string;
  endAt: string;
  label: string;
  available: boolean;
};

export type PublicBookingInput = {
  clientName: string;
  clientPhone: string;
  barbershopId: string;
  barberId?: string;
  barberName: string;
  service?: Service;
  selectedSlot?: TimeSlot | null;
  notes?: string;
};

export type PublicBookingValidationResult = {
  valid: boolean;
  errors: string[];
};

export type PublicBookingWorkday = {
  start: string;
  end: string;
};

export const ACTIVE_APPOINTMENT_CONFLICT_STATUSES: Appointment['status'][] = [
  'scheduled',
  'confirmed',
  'completed'
];

export const APPOINTMENT_CONFLICT_ERROR_CODE = 'APPOINTMENT_ACTIVE_SLOT_CONFLICT';
export const PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE = 'Esse hor\u00E1rio acabou de ser reservado. Escolha outro hor\u00E1rio.';

export const createAppointmentConflictError = (
  message: string = PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE
): Error & { code: string } => {
  const error = new Error(message) as Error & { code: string };
  error.code = APPOINTMENT_CONFLICT_ERROR_CODE;
  return error;
};

export const isAppointmentConflictError = (error: unknown): error is Error & { code: string } => (
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && (error as { code?: string }).code === APPOINTMENT_CONFLICT_ERROR_CODE
);

const BUSINESS_DAY_KEYS: BarbershopBusinessDayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];

const DAY_KEY_BY_WEEKDAY: Record<number, BarbershopBusinessDayKey> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday'
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

const isValidTimeInput = (value: string): boolean => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

const normalizeBusinessDay = (
  fallback: BarbershopBusinessDay,
  input?: Partial<BarbershopBusinessDay> | null
): BarbershopBusinessDay => {
  const open = typeof input?.open === 'string' && isValidTimeInput(input.open) ? input.open : fallback.open;
  const close = typeof input?.close === 'string' && isValidTimeInput(input.close) ? input.close : fallback.close;

  return {
    active: typeof input?.active === 'boolean' ? input.active : fallback.active,
    open,
    close
  };
};

export const normalizeBarbershopBusinessHours = (
  input?: Partial<Record<BarbershopBusinessDayKey, Partial<BarbershopBusinessDay> | null>> | null
): BarbershopBusinessHours => {
  return BUSINESS_DAY_KEYS.reduce((acc, dayKey) => {
    acc[dayKey] = normalizeBusinessDay(DEFAULT_BARBERSHOP_BUSINESS_HOURS[dayKey], input?.[dayKey]);
    return acc;
  }, {} as BarbershopBusinessHours);
};

export const normalizeBarbershopSlotStepMinutes = (value?: number | null): number => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES;
  }

  return Math.max(5, Math.min(120, Math.round(numeric)));
};

const getLocalDayOfWeekFromDateInput = (dateInput: string): number | null => {
  const [year, month, day] = dateInput.split('-').map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day).getDay();
};

export const getPublicBookingWorkdayForDate = (
  dateInput: string,
  businessHours?: Partial<Record<BarbershopBusinessDayKey, Partial<BarbershopBusinessDay> | null>> | null
): PublicBookingWorkday | null => {
  const dayOfWeek = getLocalDayOfWeekFromDateInput(dateInput);

  if (dayOfWeek === null) return null;

  const normalizedBusinessHours = normalizeBarbershopBusinessHours(businessHours);
  const dayKey = DAY_KEY_BY_WEEKDAY[dayOfWeek];
  const workday = normalizedBusinessHours[dayKey];

  if (!workday.active) {
    return null;
  }

  return {
    start: workday.open,
    end: workday.close
  };
};

export const getAppointmentDateInput = (appointment: Appointment): string => {
  return toLocalDateInputValue(new Date(appointment.startAt));
};

const hasActiveConflictStatus = (status: Appointment['status']): boolean => (
  ACTIVE_APPOINTMENT_CONFLICT_STATUSES.includes(status)
);

const isSameBarberForConflict = (
  existing: Pick<Appointment, 'barberId'>,
  candidate: Pick<Appointment, 'barberId'>
): boolean => {
  if (!existing.barberId || !candidate.barberId) {
    return false;
  }

  return existing.barberId === candidate.barberId;
};

const isSameBarbershopForConflict = (
  existing: Pick<Appointment, 'barbershopId'>,
  candidate: Pick<Appointment, 'barbershopId'>
): boolean => {
  if (!existing.barbershopId || !candidate.barbershopId) {
    return false;
  }

  return existing.barbershopId === candidate.barbershopId;
};

export const hasAppointmentConflict = (
  appointments: Appointment[],
  candidate: Pick<Appointment, 'barbershopId' | 'barberId' | 'startAt' | 'endAt'>,
  editingAppointmentId?: string
): boolean => {
  const newStart = new Date(candidate.startAt).getTime();
  const newEnd = new Date(candidate.endAt).getTime();

  return appointments.some((existing) => {
    if (existing.id === editingAppointmentId) return false;
    if (!hasActiveConflictStatus(existing.status)) return false;
    if (!isSameBarbershopForConflict(existing, candidate)) return false;
    if (!isSameBarberForConflict(existing, candidate)) return false;

    const existingStart = new Date(existing.startAt).getTime();
    const existingEnd = new Date(existing.endAt).getTime();

    return newStart < existingEnd && newEnd > existingStart;
  });
};

export const getAvailableTimeSlots = (params: {
  date: string;
  barbershopId?: string;
  barberId?: string;
  barberName: string;
  serviceDurationMinutes: number;
  appointments: Appointment[];
  businessHours?: Partial<Record<BarbershopBusinessDayKey, Partial<BarbershopBusinessDay> | null>> | null;
  workdayStart?: string;
  workdayEnd?: string;
  slotStepMinutes?: number;
  now?: Date;
}): TimeSlot[] => {
  const {
    date,
    barbershopId,
    barberId,
    barberName,
    serviceDurationMinutes,
    appointments,
    businessHours,
    workdayStart,
    workdayEnd,
    slotStepMinutes = DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES,
    now = new Date()
  } = params;

  if (!date || !barberName || serviceDurationMinutes <= 0) return [];

  const publicWorkday = getPublicBookingWorkdayForDate(date, businessHours);
  const resolvedSlotStepMinutes = normalizeBarbershopSlotStepMinutes(slotStepMinutes);

  if (!publicWorkday && (!workdayStart || !workdayEnd)) {
    return [];
  }

  const resolvedWorkdayStart = workdayStart || publicWorkday?.start;
  const resolvedWorkdayEnd = workdayEnd || publicWorkday?.end;

  if (!resolvedWorkdayStart || !resolvedWorkdayEnd) {
    return [];
  }

  const startMinutes = getMinutesFromTimeInput(resolvedWorkdayStart);
  const endMinutes = getMinutesFromTimeInput(resolvedWorkdayEnd);

  if (startMinutes >= endMinutes) {
    return [];
  }

  const slots: TimeSlot[] = [];

  for (
    let minutes = startMinutes;
    minutes + serviceDurationMinutes <= endMinutes;
    minutes += resolvedSlotStepMinutes
  ) {
    const startAt = buildLocalDateTimeIso(date, getTimeInputFromMinutes(minutes));
    const endAt = addMinutesIso(startAt, serviceDurationMinutes);
    const startDate = new Date(startAt);

    if (startDate.getTime() <= now.getTime()) {
      continue;
    }

    const available = !hasAppointmentConflict(appointments, {
      barbershopId,
      barberId,
      startAt,
      endAt
    });

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
  if (!input.barberId) errors.push('Selecione um barbeiro.');
  if (!input.service?.id) errors.push('Selecione um servico.');

  if (!input.barbershopId) errors.push('Barbearia nao encontrada ou indisponivel.');
  if (!input.barberName) errors.push('Escolha um barbeiro.');
  if (!input.service) errors.push('Escolha um servico.');
  if (!input.selectedSlot) errors.push('Escolha um horario disponivel.');
  if (!input.clientName.trim()) errors.push('Informe seu nome.');
  if (!phoneDigits || phoneDigits.length < 10) errors.push('Informe um WhatsApp valido com DDD.');

  if (input.selectedSlot && input.barberName) {
    const hasConflict = hasAppointmentConflict(appointments, {
      barbershopId: input.barbershopId,
      barberId: input.barberId,
      startAt: input.selectedSlot.startAt,
      endAt: input.selectedSlot.endAt
    });

    if (hasConflict) {
      errors.push(PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE);
    }
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
  if (!input.barbershopId) throw new Error('Barbearia nao encontrada ou indisponivel.');
  if (!input.barberId) throw new Error('Selecione um barbeiro.');
  if (!input.service?.id) throw new Error('Selecione um servico.');
  if (!input.selectedSlot) throw new Error('Selecione um horario.');

  const timestamp = now.toISOString();

  return {
    id,
    barbershopId: input.barbershopId,
    barberId: input.barberId,
    serviceId: input.service.id,
    clientName: input.clientName.trim(),
    clientPhone: normalizePhoneDigits(input.clientPhone),
    barberName: input.barberName,
    serviceType: input.service.name,
    serviceValue: input.service.price,
    commissionRate: input.service.commissionRate,
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
  const time = localDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const message = `Ola, ${appointment.clientName}. Seu horario com ${appointment.barberName} esta agendado para ${date} as ${time}. Servico: ${appointment.serviceType}.`;

  return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
};

export const serviceNameToServiceType = (serviceName: string): ServiceType => {
  const service = Object.values(ServiceType).find((value) => value === serviceName);

  return service || ServiceType.OTHER;
};

export const appointmentToClient = (
  appointment: Appointment,
  settings: AppSettings,
  id: string
): Client => {
  const serviceType = serviceNameToServiceType(appointment.serviceType);

  const rate =
    appointment.commissionRate ??
    settings.services.find((service) => service.name === appointment.serviceType)?.commissionRate ??
    settings.commissionRate;

  const commissionValue =
    serviceType === ServiceType.PRODUCT
      ? 0
      : appointment.serviceValue * (rate / 100);

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
  const alreadyExists = clients.some((client) => client.appointmentId === appointment.id);

  if (alreadyExists) {
    return {
      clients,
      created: false
    };
  }

  return {
    clients: [appointmentToClient(appointment, settings, createId()), ...clients],
    created: true
  };
};
