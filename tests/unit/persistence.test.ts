
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Appointment, DEFAULT_SETTINGS } from '../../types';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppointmentModal } from '../../components/AppointmentModal';

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  isProductionWithoutSupabase: false,
  shouldUseLocalFallback: true,
  assertOperationalSupabase: vi.fn(),
  supabase: null
}));

import {
  createAppointment,
  mapAppointmentFromDb,
  mapAppointmentToDb,
  updateAppointment
} from '../../services/appointmentRepository';
import { mapFinancialRecordToClient } from '../../services/financialRecordRepository';
import {
  APPOINTMENT_STORAGE_KEY,
  getAvailableTimeSlots,
  PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE
} from '../../scheduling';

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appointment-1',
  barbershopId: 'shop-1',
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

    expect(db).not.toHaveProperty('id');
    expect(db.client_name).toBe('Joao');
    expect(db.client_phone).toBe('11999990000');
    expect(db.barber_id).toBe('barber-1');
    expect(db.service_id).toBe('service-1');
    expect(db.service_value).toBe(50);
    expect(db.start_at).toBe(appointment.startAt);
    expect(db.end_at).toBe(appointment.endAt);
    expect(db.financial_record_id).toBe('client-1');

    const mapped = mapAppointmentFromDb({
      id: appointment.id,
      ...db,
      created_at: appointment.createdAt,
      updated_at: appointment.updatedAt
    });

    expect(mapped).toEqual({
      ...appointment,
      notes: undefined
    });
  });

  it.each([
    ['financial-barber-1', '2026-09-15T23:30:00-03:00', '2026-09-16T00:10:00-03:00'],
    [null, '2026-09-30T23:30:00-03:00', '2026-10-01T00:10:00-03:00']
  ] as const)('maps persisted finance preserving barber_id=%s and completion time', (barberId, startAt, completedAt) => {
    const appointment = makeAppointment({ status: 'completed', startAt });
    const mapped = mapFinancialRecordToClient({
      id: 'financial-1',
      appointment_id: appointment.id,
      barbershop_id: 'shop-1',
      barber_id: barberId,
      service_id: 'service-1',
      service_type: 'Corte personalizado',
      service_value: 50,
      commission_rate: 40,
      commission_value: 20,
      completed_at: completedAt,
      created_at: appointment.updatedAt
    }, appointment);

    expect(mapped.id).toBe('financial-1');
    expect(mapped.appointmentId).toBe(appointment.id);
    expect(mapped.barberId).toBe(barberId ?? undefined);
    expect(mapped.barberName).toBe(appointment.barberName);
    expect(mapped.totalValue).toBe(50);
    expect(mapped.commissionValue).toBe(20);
    expect(mapped.serviceType).toBe('Corte personalizado');
    expect(mapped.timestamp).toBe(Date.parse(completedAt));
    expect(mapped.timestamp).not.toBe(Date.parse(appointment.startAt));
    expect(appointment.startAt).toBe(startAt);
  });

  it('maps empty uuid fields to null before sending to database', () => {
    const appointment = makeAppointment({
      barberId: '',
      serviceId: ''
    });

    const db = mapAppointmentToDb(appointment);

    expect(db).not.toHaveProperty('id');
    expect(db.barber_id).toBeNull();
    expect(db.service_id).toBeNull();
  });
});

describe('appointment repository local fallback', () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it.each([null, makeAppointment()])('keeps local create/edit price editable (%j)', initialData => {
    const html = renderToStaticMarkup(createElement(AppointmentModal, {
      isOpen: true, onClose: vi.fn(), onSave: vi.fn(), settings: DEFAULT_SETTINGS,
      selectedDate: '2026-06-10', selectedBarber: 'Carlos', createId: () => 'local-id', initialData
    }));
    const input = html.match(/<input[^>]*id="appointment-service-value"[^>]*>/)?.[0];
    expect(input).toBeDefined();
    expect(input).not.toMatch(/readonly|disabled/i);
    expect(html).not.toContain('Valor definido pelo catálogo');
  });

  it('creates appointments in localStorage when Supabase is not configured', async () => {
    const created = await createAppointment(makeAppointment(), []);
    const saved = JSON.parse(localStorage.getItem(APPOINTMENT_STORAGE_KEY) || '[]');

    expect(created).toEqual({ mode: 'local', appointment: makeAppointment() });
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('appointment-1');
  });

  it('validates conflict before saving in fallback mode', async () => {
    const existing = makeAppointment();

    await expect(createAppointment(makeAppointment({ id: 'appointment-2' }), [existing]))
      .rejects
      .toThrow(PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE);
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
      barbershopId: 'shop-1',
      barberId: 'barber-1',
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

