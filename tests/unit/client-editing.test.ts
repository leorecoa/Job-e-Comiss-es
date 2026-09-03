import { describe, expect, it } from 'vitest';
import { resolveClientEditTarget } from '../../clientEditing';
import { Appointment, Client, ClientType, ServiceType } from '../../types';

const appointment: Appointment = {
  id: 'appointment-1',
  barbershopId: 'shop-1',
  barberId: 'barber-1',
  serviceId: 'service-1',
  clientName: 'Cliente',
  barberName: 'Barbeiro',
  serviceType: 'Corte',
  serviceValue: 50,
  startAt: '2026-09-03T12:00:00.000Z',
  endAt: '2026-09-03T12:30:00.000Z',
  status: 'scheduled',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z'
};

const client: Client = {
  id: 'client-1',
  appointmentId: appointment.id,
  name: 'Cliente',
  barberName: 'Barbeiro',
  serviceType: ServiceType.CUT,
  clientType: ClientType.RETURNING,
  serviceValue: 50,
  extraValue: 0,
  totalValue: 50,
  commissionValue: 20,
  timestamp: Date.parse(appointment.startAt),
  description: '',
  products: []
};

describe('resolveClientEditTarget', () => {
  it('routes a linked client to its modern appointment editor', () => {
    expect(resolveClientEditTarget(client, [appointment])).toEqual({
      type: 'appointment',
      appointment,
      readOnly: false
    });
  });

  it('keeps a legacy local client in the legacy editor', () => {
    expect(resolveClientEditTarget({ ...client, appointmentId: undefined }, [appointment])).toEqual({
      type: 'legacy'
    });
  });

  it('makes completed or financially linked appointments read-only', () => {
    const completed = { ...appointment, status: 'completed' as const, financialRecordId: 'financial-1' };

    expect(resolveClientEditTarget(client, [completed])).toEqual({
      type: 'appointment',
      appointment: completed,
      readOnly: true
    });
  });

  it('does not fall back to legacy editing when a linked appointment is missing', () => {
    expect(resolveClientEditTarget(client, [])).toEqual({ type: 'missing-appointment' });
  });
});
