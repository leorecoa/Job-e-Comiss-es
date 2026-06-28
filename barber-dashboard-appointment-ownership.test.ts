import { describe, expect, it } from 'vitest';
import { Appointment } from './types';
import {
  BARBER_PROFILE_INCOMPLETE_MESSAGE,
  buildBarberOwnedAppointment
} from './components/BarberDashboard';

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'app-1',
  clientName: 'Cliente Teste',
  clientPhone: '85999999999',
  barberName: 'Outro Nome',
  barberId: 'other-barber-id',
  barbershopId: 'other-barbershop-id',
  serviceId: 'service-1',
  serviceType: 'Corte',
  serviceValue: 50,
  startAt: '2026-06-28T12:00:00.000Z',
  endAt: '2026-06-28T12:30:00.000Z',
  status: 'scheduled',
  createdAt: '2026-06-28T10:00:00.000Z',
  updatedAt: '2026-06-28T10:00:00.000Z',
  ...overrides
});

describe('barber dashboard appointment ownership', () => {
  it('allows a barber with valid barbershopId and barberId to create an appointment for themselves', () => {
    const result = buildBarberOwnedAppointment({
      appointment: makeAppointment(),
      authSession: {
        userId: 'barber-user-1',
        email: 'barber@example.com',
        role: 'barber',
        displayName: 'Leo',
        barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce',
        barberId: '252b5551-b8e7-4693-ab07-d0bbfde6ec05'
      },
      currentBarberName: 'Leo'
    });

    expect(result.barbershopId).toBe('0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce');
    expect(result.barberId).toBe('252b5551-b8e7-4693-ab07-d0bbfde6ec05');
    expect(result.barberName).toBe('Leo');
  });

  it('overwrites barberId coming from the modal with authSession.barberId', () => {
    const result = buildBarberOwnedAppointment({
      appointment: makeAppointment({
        barberId: 'barber-id-from-modal',
        barberName: 'Nome do modal'
      }),
      authSession: {
        userId: 'barber-user-1',
        email: 'barber@example.com',
        role: 'barber',
        displayName: 'Leo',
        barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce',
        barberId: '252b5551-b8e7-4693-ab07-d0bbfde6ec05'
      },
      currentBarberName: 'Leo Real'
    });

    expect(result.barberId).toBe('252b5551-b8e7-4693-ab07-d0bbfde6ec05');
    expect(result.barberName).toBe('Leo Real');
  });

  it('overwrites barbershopId coming from the modal with authSession.barbershopId', () => {
    const result = buildBarberOwnedAppointment({
      appointment: makeAppointment({
        barbershopId: 'tenant-from-modal'
      }),
      authSession: {
        userId: 'barber-user-1',
        email: 'barber@example.com',
        role: 'barber',
        displayName: 'Leo',
        barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce',
        barberId: '252b5551-b8e7-4693-ab07-d0bbfde6ec05'
      },
      currentBarberName: 'Leo'
    });

    expect(result.barbershopId).toBe('0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce');
  });

  it('shows a friendly error when the barber profile has no barberId', () => {
    expect(() => buildBarberOwnedAppointment({
      appointment: makeAppointment(),
      authSession: {
        userId: 'barber-user-1',
        email: 'barber@example.com',
        role: 'barber',
        displayName: 'Leo',
        barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce'
      },
      currentBarberName: 'Leo'
    })).toThrow(BARBER_PROFILE_INCOMPLETE_MESSAGE);
  });

  it('shows a friendly error when the barber profile has no barbershopId', () => {
    expect(() => buildBarberOwnedAppointment({
      appointment: makeAppointment(),
      authSession: {
        userId: 'barber-user-1',
        email: 'barber@example.com',
        role: 'barber',
        displayName: 'Leo',
        barberId: '252b5551-b8e7-4693-ab07-d0bbfde6ec05'
      },
      currentBarberName: 'Leo'
    })).toThrow(BARBER_PROFILE_INCOMPLETE_MESSAGE);
  });

  it('does not allow a non-barber role through the barber-only path', () => {
    expect(() => buildBarberOwnedAppointment({
      appointment: makeAppointment(),
      authSession: {
        userId: 'owner-user-1',
        email: 'owner@example.com',
        role: 'owner',
        displayName: 'Owner',
        barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce'
      },
      currentBarberName: 'Leo'
    })).toThrow(BARBER_PROFILE_INCOMPLETE_MESSAGE);
  });
});
