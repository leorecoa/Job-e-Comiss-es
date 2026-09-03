import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn()
}));

vi.mock('../../lib/supabase', () => ({
  assertOperationalSupabase: vi.fn(),
  supabase: supabaseMock
}));

import { completeAppointmentWithFinancialRecord } from '../../services/financialRecordRepository';
import { OperationalError } from '../../utils/operationalError';

describe('financial completion error metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves a known public code with a friendly message', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'FINANCIAL_COMPLETION_FORBIDDEN',
        details: 'client_name=Private Client',
        hint: 'notes=private'
      },
      status: 403
    });

    const error = await completeAppointmentWithFinancialRecord('appointment-1').catch((caught) => caught);

    expect(error).toBeInstanceOf(OperationalError);
    expect(error).toMatchObject({
      message: 'Voce nao tem permissao para concluir este agendamento.',
      publicCode: 'FINANCIAL_COMPLETION_FORBIDDEN',
      providerCode: 'P0001',
      httpStatus: 403
    });
    expect(error).not.toHaveProperty('details');
    expect(error).not.toHaveProperty('hint');
  });

  it('preserves only safe metadata from an unexpected provider error', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: {
        code: '23514',
        message: 'check constraint failed for client_name=Private Client',
        details: 'SQL and private payload',
        hint: 'Authorization: Bearer secret'
      },
      status: 500
    });

    const error = await completeAppointmentWithFinancialRecord('appointment-1').catch((caught) => caught);

    expect(error).toMatchObject({
      message: 'Nao foi possivel concluir o agendamento e salvar o financeiro. Tente novamente.',
      publicCode: undefined,
      providerCode: '23514',
      httpStatus: 500
    });
    expect(JSON.stringify(error)).not.toMatch(/Private Client|SQL|Bearer|secret/);
  });

  it('classifies a rejected request as a privacy-safe network error', async () => {
    supabaseMock.rpc.mockRejectedValue(new Error('Failed to fetch client_name=Private Client'));

    const error = await completeAppointmentWithFinancialRecord('appointment-1').catch((caught) => caught);

    expect(error).toMatchObject({
      message: 'Nao foi possivel conectar ao Supabase para concluir o agendamento.',
      providerCode: 'NETWORK_ERROR'
    });
    expect(JSON.stringify(error)).not.toContain('Private Client');
  });

  it('classifies a Supabase fetch response as a privacy-safe network error', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'TypeError: Failed to fetch client_name=Private Client' },
      status: 0
    });

    const error = await completeAppointmentWithFinancialRecord('appointment-1').catch((caught) => caught);

    expect(error).toMatchObject({
      message: 'Nao foi possivel conectar ao Supabase para concluir o agendamento.',
      providerCode: 'NETWORK_ERROR',
      httpStatus: undefined
    });
    expect(JSON.stringify(error)).not.toContain('Private Client');
  });

  it('preserves the successful completion contract', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{ appointment_id: 'appointment-1', financial_record_id: 'financial-1' }],
      error: null,
      status: 200
    });

    await expect(completeAppointmentWithFinancialRecord('appointment-1')).resolves.toEqual({
      appointmentId: 'appointment-1',
      financialRecordId: 'financial-1'
    });
  });
});
