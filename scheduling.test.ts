import { describe, expect, it } from 'vitest';
import { Appointment, AppSettings, DEFAULT_SETTINGS } from './types';
import {
  buildWhatsAppLink,
  completeAppointmentFinancialRecord,
  createPublicAppointment,
  getAvailableTimeSlots,
  hasAppointmentConflict,
  TimeSlot,
  validatePublicBookingInput
} from './scheduling';

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appointment-1',
  clientName: 'Joao',
  clientPhone: '(11) 99999-0000',
  barberName: 'Carlos',
  serviceType: 'Corte',
  serviceValue: 50,
  startAt: new Date(2026, 5, 4, 10, 0).toISOString(),
  endAt: new Date(2026, 5, 4, 10, 30).toISOString(),
  status: 'scheduled',
  createdAt: new Date(2026, 5, 1, 8, 0).toISOString(),
  updatedAt: new Date(2026, 5, 1, 8, 0).toISOString(),
  ...overrides
});

const settings: AppSettings = {
  ...DEFAULT_SETTINGS,
  commissionRate: 50
};

describe('hasAppointmentConflict', () => {
  it('detects overlapping appointments for the same barber', () => {
    const existing = makeAppointment();
    const candidate = makeAppointment({
      id: 'appointment-2',
      startAt: new Date(2026, 5, 4, 10, 15).toISOString(),
      endAt: new Date(2026, 5, 4, 10, 45).toISOString()
    });

    expect(hasAppointmentConflict([existing], candidate)).toBe(true);
  });

  it('allows adjacent appointments without overlap', () => {
    const existing = makeAppointment();
    const candidate = makeAppointment({
      id: 'appointment-2',
      startAt: existing.endAt,
      endAt: new Date(2026, 5, 4, 11, 0).toISOString()
    });

    expect(hasAppointmentConflict([existing], candidate)).toBe(false);
  });

  it('does not block different barbers', () => {
    const existing = makeAppointment();
    const candidate = makeAppointment({ id: 'appointment-2', barberName: 'Marcos' });

    expect(hasAppointmentConflict([existing], candidate)).toBe(false);
  });

  it('ignores cancelled appointments', () => {
    const existing = makeAppointment({ status: 'cancelled' });
    const candidate = makeAppointment({ id: 'appointment-2' });

    expect(hasAppointmentConflict([existing], candidate)).toBe(false);
  });
});

describe('buildWhatsAppLink', () => {
  it('builds a manual wa.me link with sanitized phone and encoded message', () => {
    const link = buildWhatsAppLink(makeAppointment());

    expect(link).toContain('https://wa.me/5511999990000?text=');
    expect(decodeURIComponent(link || '')).toContain('Ola, Joao.');
    expect(decodeURIComponent(link || '')).toContain('Servico: Corte.');
  });

  it('returns null without a phone', () => {
    expect(buildWhatsAppLink(makeAppointment({ clientPhone: undefined }))).toBeNull();
  });
});

describe('completeAppointmentFinancialRecord', () => {
  it('does not duplicate financial records for the same completed appointment', () => {
    const appointment = makeAppointment({ status: 'completed' });
    const first = completeAppointmentFinancialRecord(appointment, [], settings, () => 'client-1');
    const second = completeAppointmentFinancialRecord(appointment, first.clients, settings, () => 'client-2');

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.clients).toHaveLength(1);
    expect(second.clients[0].appointmentId).toBe('appointment-1');
    expect(second.clients[0].commissionValue).toBe(25);
  });
});

describe('getAvailableTimeSlots', () => {
  it('generates slots inside the workday', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-10',
      barberName: 'Carlos',
      serviceDurationMinutes: 30,
      appointments: [],
      workdayStart: '09:00',
      workdayEnd: '10:00',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 9, 8, 0)
    });

    expect(slots.map(slot => slot.label)).toEqual(['09:00', '09:30']);
    expect(slots.every(slot => slot.available)).toBe(true);
  });

  it('marks occupied slots unavailable', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-10',
      barberName: 'Carlos',
      serviceDurationMinutes: 30,
      appointments: [makeAppointment({
        startAt: new Date(2026, 5, 10, 9, 30).toISOString(),
        endAt: new Date(2026, 5, 10, 10, 0).toISOString()
      })],
      workdayStart: '09:00',
      workdayEnd: '10:30',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 9, 8, 0)
    });

    expect(slots.find(slot => slot.label === '09:30')?.available).toBe(false);
  });

  it('does not block slots with cancelled appointments', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-10',
      barberName: 'Carlos',
      serviceDurationMinutes: 30,
      appointments: [makeAppointment({
        status: 'cancelled',
        startAt: new Date(2026, 5, 10, 9, 30).toISOString(),
        endAt: new Date(2026, 5, 10, 10, 0).toISOString()
      })],
      workdayStart: '09:00',
      workdayEnd: '10:30',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 9, 8, 0)
    });

    expect(slots.find(slot => slot.label === '09:30')?.available).toBe(true);
  });

  it('does not block slots for another barber', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-10',
      barberName: 'Marcos',
      serviceDurationMinutes: 30,
      appointments: [makeAppointment({
        barberName: 'Carlos',
        startAt: new Date(2026, 5, 10, 9, 30).toISOString(),
        endAt: new Date(2026, 5, 10, 10, 0).toISOString()
      })],
      workdayStart: '09:00',
      workdayEnd: '10:30',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 9, 8, 0)
    });

    expect(slots.find(slot => slot.label === '09:30')?.available).toBe(true);
  });

  it('uses longer service duration to block overlapping slots', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-10',
      barberName: 'Carlos',
      serviceDurationMinutes: 60,
      appointments: [makeAppointment({
        startAt: new Date(2026, 5, 10, 10, 30).toISOString(),
        endAt: new Date(2026, 5, 10, 11, 0).toISOString()
      })],
      workdayStart: '10:00',
      workdayEnd: '12:00',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 9, 8, 0)
    });

    expect(slots.find(slot => slot.label === '10:00')?.available).toBe(false);
    expect(slots.find(slot => slot.label === '11:00')?.available).toBe(true);
  });

  it('does not include past slots for today', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-06',
      barberName: 'Carlos',
      serviceDurationMinutes: 30,
      appointments: [],
      workdayStart: '09:00',
      workdayEnd: '12:00',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 6, 10, 15)
    });

    expect(slots.map(slot => slot.label)).not.toContain('09:00');
    expect(slots.map(slot => slot.label)).not.toContain('10:00');
    expect(slots.map(slot => slot.label)).toContain('10:30');
  });
});

describe('public booking helpers', () => {
  const slot: TimeSlot = {
    startAt: new Date(2026, 5, 10, 9, 0).toISOString(),
    endAt: new Date(2026, 5, 10, 9, 30).toISOString(),
    label: '09:00',
    available: true
  };

  it('creates a scheduled appointment from public booking input', () => {
    const appointment = createPublicAppointment({
      clientName: ' Maria ',
      clientPhone: '(85) 98888-7777',
      barberName: 'Carlos',
      service: settings.services[0],
      selectedSlot: slot,
      notes: 'Preferencia por maquina 1'
    }, 'public-1', new Date(2026, 5, 9, 8, 0));

    expect(appointment.id).toBe('public-1');
    expect(appointment.status).toBe('scheduled');
    expect(appointment.clientName).toBe('Maria');
    expect(appointment.clientPhone).toBe('85988887777');
    expect(appointment.serviceType).toBe(settings.services[0].name);
  });

  it('validates required public booking fields', () => {
    const result = validatePublicBookingInput({
      clientName: '',
      clientPhone: '',
      barberName: '',
      service: undefined,
      selectedSlot: null
    }, []);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Escolha um barbeiro.');
    expect(result.errors).toContain('Escolha um servico.');
    expect(result.errors).toContain('Escolha um horario disponivel.');
    expect(result.errors).toContain('Informe seu nome.');
    expect(result.errors).toContain('Informe um WhatsApp valido com DDD.');
  });
});
