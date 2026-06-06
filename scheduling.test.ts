import { describe, expect, it } from 'vitest';
import { Appointment, AppSettings, DEFAULT_SETTINGS } from './types';
import { buildWhatsAppLink, completeAppointmentFinancialRecord, hasAppointmentConflict } from './scheduling';

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
