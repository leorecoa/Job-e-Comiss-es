import { Appointment, AppSettings, Client, ClientType, ServiceType } from './types';

export const APPOINTMENT_STORAGE_KEY = 'barbearia_appointments';

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
