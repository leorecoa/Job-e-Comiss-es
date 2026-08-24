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

import { listInternalAppointments, updateAppointment } from '../../services/appointmentRepository';

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

  it('contains no direct appointment delete path', () => {
    const source = readFileSync(new URL('../../services/appointmentRepository.ts', import.meta.url), 'utf8');

    expect(source).not.toContain('deleteAppointment');
    expect(source).not.toMatch(/from\(['"]appointments['"]\)[\s\S]{0,120}\.delete\(/);
  });
});
