import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DailySchedule, appointmentStatusLabels } from './components/DailySchedule';
import { Appointment, AppointmentStatus, ServiceType } from './types';

const makeAppointment = (status: AppointmentStatus, hour: number): Appointment => ({
  id: `appointment-${status}`,
  barbershopId: 'barbershop-1',
  barberId: 'barber-1',
  barberName: 'Leo Barber',
  clientName: `Cliente ${status}`,
  clientPhone: '',
  serviceId: 'service-1',
  serviceType: ServiceType.CUT,
  serviceValue: 50,
  commissionRate: 50,
  startAt: `2026-08-12T${String(hour).padStart(2, '0')}:00:00-03:00`,
  endAt: `2026-08-12T${String(hour).padStart(2, '0')}:30:00-03:00`,
  status,
  createdAt: '2026-08-01T12:00:00Z',
  updatedAt: '2026-08-01T12:00:00Z'
});

const renderSchedule = (appointments: Appointment[]) => renderToStaticMarkup(
  <DailySchedule
    appointments={appointments}
    selectedDate="2026-08-12"
    selectedBarber="Leo Barber"
    barberOptions={['Leo Barber']}
    onDateChange={vi.fn()}
    onBarberChange={vi.fn()}
    onNew={vi.fn()}
    onEdit={vi.fn()}
    onStatusChange={vi.fn()}
    onCancel={vi.fn()}
  />
);

describe('daily scheduling workspace', () => {
  it('labels date, professional and every supported appointment status', () => {
    const statuses = Object.keys(appointmentStatusLabels) as AppointmentStatus[];
    const html = renderSchedule(statuses.map((status, index) => makeAppointment(status, 9 + index)));

    expect(html).toContain('for="schedule-date"');
    expect(html).toContain('for="schedule-barber"');
    statuses.forEach((status) => expect(html).toContain(appointmentStatusLabels[status]));
    expect(html).toContain('Profissional: Leo Barber');
  });

  it('keeps appointments chronological and active actions available', () => {
    const html = renderSchedule([
      makeAppointment('confirmed', 14),
      makeAppointment('scheduled', 9)
    ]);

    expect(html.indexOf('Cliente scheduled')).toBeLessThan(html.indexOf('Cliente confirmed'));
    for (const action of ['Editar', 'Confirmar', 'Concluir', 'Nao veio', 'Cancelar']) {
      expect(html).toContain(action);
    }
  });

  it('provides an actionable empty state without changing the current filter', () => {
    const html = renderSchedule([]);

    expect(html).toContain('Nenhum agendamento nesta data.');
    expect(html).toContain('Quando Leo Barber tiver agendamentos nesta data');
    expect(html).toContain('Criar agendamento');
  });
});
