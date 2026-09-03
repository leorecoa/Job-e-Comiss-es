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
