import { Appointment, Client } from './types';

export type ClientEditTarget =
  | { type: 'legacy' }
  | { type: 'missing-appointment' }
  | { type: 'appointment'; appointment: Appointment; readOnly: boolean };

export const resolveClientEditTarget = (
  client: Client,
  appointments: Appointment[]
): ClientEditTarget => {
  if (!client.appointmentId) {
    return { type: 'legacy' };
  }

  const appointment = appointments.find(item => item.id === client.appointmentId);
  if (!appointment) {
    return { type: 'missing-appointment' };
  }

  return {
    type: 'appointment',
    appointment,
    readOnly: appointment.status === 'completed' || Boolean(appointment.financialRecordId)
  };
};

export const getClientHistoryEditLabel = (
  client: Client,
  appointments: Appointment[]
): 'Editar' | 'Ver detalhes' => {
  const target = resolveClientEditTarget(client, appointments);
  return target.type === 'appointment' && target.readOnly ? 'Ver detalhes' : 'Editar';
};

export const canDeleteClientHistory = (
  client: Client,
  useLocalFallback: boolean
): boolean => useLocalFallback || !client.appointmentId;
