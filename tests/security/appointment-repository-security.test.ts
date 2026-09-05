import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn()
}));

vi.mock('../../lib/supabase', () => ({
  shouldUseLocalFallback: false,
  assertOperationalSupabase: vi.fn(),
  supabase: { rpc: rpcMock, from: fromMock }
}));

import { createBarberAppointment, listInternalAppointments, updateAppointment } from '../../services/appointmentRepository';
import type { Appointment } from '../../types';

const baseRow = {
  id: '60000000-0000-4000-8000-000000000001',
  barbershop_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  client_name: 'Cliente Teste',
  client_phone: '85999999999',
  barber_id: '11111111-1111-4111-8111-111111111111',
  barber_name: 'Barbeiro Alpha',
  service_id: '33333333-3333-4333-8333-333333333333',
  service_type: 'Corte',
  service_value: 60,
  commission_rate: 50,
  start_at: '2026-08-24T12:00:00.000Z',
  end_at: '2026-08-24T12:30:00.000Z',
  status: 'scheduled' as const,
  notes: 'Observacao privada',
  financial_record_id: 'finance-1',
  created_at: '2026-08-20T12:00:00.000Z',
  updated_at: '2026-08-20T12:00:00.000Z'
};

describe('controlled internal appointment access', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the full owner contract without sending role or tenant arguments', async () => {
    rpcMock.mockResolvedValue({ data: [{ ...baseRow, viewer_role: 'owner' }], error: null });

    const [appointment] = await listInternalAppointments('untrusted-tenant', 'untrusted-barber');

    expect(rpcMock).toHaveBeenCalledWith('get_internal_appointments');
    expect(appointment).toMatchObject({
      clientPhone: baseRow.client_phone,
      notes: baseRow.notes,
      serviceValue: 60,
      commissionRate: 50,
      financialRecordId: 'finance-1'
    });
  });

  it('maps the barber contract without sensitive or financial properties', async () => {
    rpcMock.mockResolvedValue({
      data: [{
        ...baseRow,
        viewer_role: 'barber',
        client_phone: null,
        notes: null,
        service_value: null,
        commission_rate: null,
        financial_record_id: null,
        created_at: null,
        updated_at: null
      }],
      error: null
    });

    const [appointment] = await listInternalAppointments();

    expect(appointment).toMatchObject({
      id: baseRow.id,
      clientName: baseRow.client_name,
      serviceType: baseRow.service_type,
      status: 'scheduled'
    });
    for (const field of ['clientPhone', 'notes', 'serviceValue', 'commissionRate', 'financialRecordId']) {
      expect(appointment).not.toHaveProperty(field);
    }
  });

  it('updates an owner appointment through the tenant-derived RPC only', async () => {
    rpcMock.mockImplementation(async (name: string) => ({
      data: name === 'get_internal_appointments'
        ? [{ ...baseRow, viewer_role: 'owner' }]
        : [{ ...baseRow, status: 'cancelled', notes: 'Cancelado pelo owner' }],
      error: null
    }));

    const updated = await updateAppointment(baseRow.id, {
      status: 'cancelled',
      notes: 'Cancelado pelo owner'
    });

    expect(updated.status).toBe('cancelled');
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenLastCalledWith('update_owner_appointment', expect.not.objectContaining({
      p_barbershop_id: expect.anything(),
      p_financial_record_id: expect.anything()
    }));
  });

  it('creates a barber appointment without sending tenant, barber, duration, or financial snapshots', async () => {
    const appointment: Appointment = {
      id: 'client-generated-id',
      barbershopId: 'untrusted-tenant',
      barberId: 'untrusted-barber',
      serviceId: baseRow.service_id,
      clientName: 'Cliente Teste',
      clientPhone: '85999999999',
      barberName: 'Nome adulterado',
      serviceType: 'Servico adulterado',
      serviceValue: 999,
      commissionRate: 100,
      startAt: '2099-08-24T12:00:00.000Z',
      endAt: '2099-08-24T18:00:00.000Z',
      status: 'scheduled',
      notes: 'Observacao permitida',
      createdAt: '2099-08-20T12:00:00.000Z',
      updatedAt: '2099-08-20T12:00:00.000Z'
    };
    rpcMock.mockResolvedValue({
      data: [{
        id: baseRow.id,
        barbershop_id: baseRow.barbershop_id,
        client_name: appointment.clientName,
        barber_id: baseRow.barber_id,
        barber_name: baseRow.barber_name,
        service_id: baseRow.service_id,
        service_type: baseRow.service_type,
        start_at: appointment.startAt,
        end_at: '2099-08-24T12:30:00.000Z',
        status: 'scheduled'
      }],
      error: null
    });

    const created = await createBarberAppointment(appointment, []);

    expect(rpcMock).toHaveBeenCalledWith('create_barber_appointment', {
      p_service_id: baseRow.service_id,
      p_client_name: appointment.clientName,
      p_client_phone: appointment.clientPhone,
      p_start_at: appointment.startAt,
      p_notes: appointment.notes
    });
    expect(rpcMock.mock.calls[0]?.[1]).not.toEqual(expect.objectContaining({
      p_barbershop_id: expect.anything(),
      p_barber_id: expect.anything(),
      p_service_value: expect.anything(),
      p_commission_rate: expect.anything(),
      p_end_at: expect.anything()
    }));
    expect(created).toMatchObject({
      id: baseRow.id,
      barbershopId: baseRow.barbershop_id,
      barberId: baseRow.barber_id,
      barberName: baseRow.barber_name,
      serviceType: baseRow.service_type,
      serviceValue: 0,
      commissionRate: undefined,
      endAt: '2099-08-24T12:30:00.000Z',
      status: 'scheduled'
    });
    expect(created.serviceValue).not.toBe(appointment.serviceValue);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('contains no direct appointment delete path', () => {
    const source = readFileSync(new URL('../../services/appointmentRepository.ts', import.meta.url), 'utf8');

    expect(source).not.toContain('deleteAppointment');
    expect(source).not.toMatch(/from\(['"]appointments['"]\)[\s\S]{0,120}\.delete\(/);
  });
});
