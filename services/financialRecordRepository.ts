import { assertOperationalSupabase, supabase } from '../lib/supabase';
import { Appointment, Client, ClientType, ServiceType } from '../types';
import { OperationalError, sanitizeTechnicalCode } from '../utils/operationalError';

export type FinancialRecordRow = {
  id: string;
  appointment_id: string;
  barbershop_id: string;
  barber_id: string | null;
  service_id: string | null;
  service_type: string;
  service_value: number | string;
  commission_rate: number | string;
  commission_value: number | string;
  completed_at: string;
  created_at: string;
};

export type FinancialCompletionResult = {
  appointmentId: string;
  financialRecordId: string;
};

const FINANCIAL_COMPLETION_ERRORS: Record<string, string> = {
  FINANCIAL_COMPLETION_UNAUTHENTICATED: 'Sua sessao expirou. Entre novamente antes de concluir o agendamento.',
  FINANCIAL_COMPLETION_FORBIDDEN: 'Voce nao tem permissao para concluir este agendamento.',
  FINANCIAL_COMPLETION_APPOINTMENT_NOT_FOUND: 'Agendamento nao encontrado ou indisponivel para este usuario.',
  FINANCIAL_COMPLETION_INVALID_STATUS: 'Agendamentos cancelados ou marcados como falta nao podem ser concluidos.'
};

export const mapFinancialRecordToClient = (
  row: FinancialRecordRow,
  appointment: Appointment
): Client => ({
  id: row.id,
  appointmentId: row.appointment_id,
  name: appointment.clientName,
  phone: appointment.clientPhone,
  barberName: appointment.barberName,
  serviceType: Object.values(ServiceType).includes(row.service_type as ServiceType)
    ? row.service_type as ServiceType
    : ServiceType.OTHER,
  clientType: ClientType.RETURNING,
  serviceValue: Number(row.service_value),
  extraValue: 0,
  totalValue: Number(row.service_value),
  commissionValue: Number(row.commission_value),
  timestamp: new Date(row.completed_at).getTime(),
  description: appointment.notes ? `Agendamento: ${appointment.notes}` : 'Atendimento gerado pela agenda',
  products: []
});

export const listFinancialRecords = async (barbershopId: string): Promise<FinancialRecordRow[]> => {
  assertOperationalSupabase();

  const { data, error } = await supabase
    .from('financial_records')
    .select('id,appointment_id,barbershop_id,barber_id,service_id,service_type,service_value,commission_rate,commission_value,completed_at,created_at')
    .eq('barbershop_id', barbershopId)
    .order('completed_at', { ascending: false });

  if (error) throw error;
  return (data || []) as FinancialRecordRow[];
};

export const completeAppointmentWithFinancialRecord = async (
  appointmentId: string
): Promise<FinancialCompletionResult> => {
  assertOperationalSupabase();

  let response;
  try {
    response = await supabase.rpc('complete_appointment_with_financial_record', {
      p_appointment_id: appointmentId
    });
  } catch {
    throw new OperationalError('Nao foi possivel conectar ao Supabase para concluir o agendamento.', {
      providerCode: 'NETWORK_ERROR'
    });
  }

  const { data, error, status } = response;

  if (error) {
    const details = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
    const publicCode = Object.keys(FINANCIAL_COMPLETION_ERRORS).find((candidate) => details.includes(candidate));
    const isNetworkError = /failed to fetch|fetcherror|network|timeout/i.test(details);
    throw new OperationalError(
      publicCode
        ? FINANCIAL_COMPLETION_ERRORS[publicCode]
        : isNetworkError
          ? 'Nao foi possivel conectar ao Supabase para concluir o agendamento.'
        : 'Nao foi possivel concluir o agendamento e salvar o financeiro. Tente novamente.',
      {
        publicCode,
        providerCode: isNetworkError ? 'NETWORK_ERROR' : sanitizeTechnicalCode(error.code),
        httpStatus: status
      }
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.appointment_id || !row?.financial_record_id) {
    throw new OperationalError('O Supabase nao confirmou a conclusao financeira. Tente novamente.', {
      providerCode: 'INVALID_RPC_RESPONSE',
      httpStatus: status
    });
  }

  return {
    appointmentId: row.appointment_id,
    financialRecordId: row.financial_record_id
  };
};
