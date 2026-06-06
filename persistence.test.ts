import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Appointment } from './types';
import {
  createAppointment,
  mapAppointmentFromDb,
  mapAppointmentToDb,
  updateAppointment
} from './services/appointmentRepository';
import { APPOINTMENT_STORAGE_KEY, getAvailableTimeSlots } from './scheduling';

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appointment-1',
  barberId: 'barber-1',
  serviceId: 'service-1',
  clientName: 'Joao',
  clientPhone: '11999990000',
  barberName: 'Carlos',
  serviceType: 'Corte',
  serviceValue: 50,
  startAt: new Date(2026, 5, 10, 9, 0).toISOString(),
  endAt: new Date(2026, 5, 10, 9, 30).toISOString(),
  status: 'scheduled',
  createdAt: new Date(2026, 5, 1, 8, 0).toISOString(),
  updatedAt: new Date(2026, 5, 1, 8, 0).toISOString(),
  ...overrides
});

const installLocalStorageMock = () => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear()
  });
};

describe('appointment persistence mappers', () => {
  it('maps appointment app model to database shape and back', () => {
    const appointment = makeAppointment({ financialRecordId: 'client-1' });
    const db = mapAppointmentToDb(appointment);
    const mapped = mapAppointmentFromDb({
      ...db,
      created_at: appointment.createdAt,
      updated_at: appointment.updatedAt
    });

    expect(db.client_name).toBe('Joao');
    expect(db.client_phone).toBe('11999990000');
    expect(db.service_value).toBe(50);
    expect(db.start_at).toBe(appointment.startAt);
    expect(db.financial_record_id).toBe('client-1');
    expect(mapped).toEqual(appointment);
  });
});

describe('appointment repository local fallback', () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it('creates appointments in localStorage when Supabase is not configured', async () => {
    const created = await createAppointment(makeAppointment(), []);
    const saved = JSON.parse(localStorage.getItem(APPOINTMENT_STORAGE_KEY) || '[]');

    expect(created.status).toBe('scheduled');
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('appointment-1');
  });

  it('validates conflict before saving in fallback mode', async () => {
    const existing = makeAppointment();
    await expect(createAppointment(makeAppointment({ id: 'appointment-2' }), [existing]))
      .rejects
      .toThrow('Horario indisponivel para este barbeiro.');
  });

  it('updates a completed appointment with financial record reference', async () => {
    const appointment = makeAppointment();
    localStorage.setItem(APPOINTMENT_STORAGE_KEY, JSON.stringify([appointment]));

    const updated = await updateAppointment(appointment.id, {
      status: 'completed',
      financialRecordId: 'client-1'
    });

    expect(updated.status).toBe('completed');
    expect(updated.financialRecordId).toBe('client-1');
  });

  it('generates slots from appointments loaded through repository fallback', async () => {
    const appointment = makeAppointment({
      startAt: new Date(2026, 5, 10, 9, 30).toISOString(),
      endAt: new Date(2026, 5, 10, 10, 0).toISOString()
    });

    const slots = getAvailableTimeSlots({
      date: '2026-06-10',
      barberName: 'Carlos',
      serviceDurationMinutes: 30,
      appointments: [appointment],
      workdayStart: '09:00',
      workdayEnd: '10:30',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 9, 8, 0)
    });

    expect(slots.find(slot => slot.label === '09:30')?.available).toBe(false);
  });
});
