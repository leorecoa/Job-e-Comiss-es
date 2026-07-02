import { assertOperationalSupabase, shouldUseLocalFallback, supabase } from '../lib/supabase';
import { BarberOption } from '../types';
import { isUuid } from '../utils';

export const BARBER_PROFILE_LINKING_SUCCESS_MESSAGE = 'Conta vinculada ao profissional.';
export const BARBER_PROFILE_LINKING_GENERIC_ERROR_MESSAGE = 'Nao foi possivel vincular este usuario.';

export type LinkedBarberProfile = {
  profileId: string;
  displayName: string | null;
  role: string;
  active: boolean;
  barbershopId: string | null;
  barberId: string | null;
};

type BarberProfileLinkingErrorCode =
  | 'TARGET_EMAIL_REQUIRED'
  | 'TARGET_BARBER_REQUIRED'
  | 'BARBER_NOT_IN_TENANT'
  | 'TARGET_USER_NOT_FOUND'
  | 'TARGET_PROFILE_BELONGS_TO_ANOTHER_TENANT'
  | 'TARGET_PROFILE_IS_OWNER'
  | 'TARGET_USER_CANNOT_BE_OWNER'
  | 'OWNER_BARBERSHOP_REQUIRED'
  | 'PROFILE_LINKING_REQUIRES_SUPABASE';

type RpcLinkedBarberProfileRow = {
  profile_id: string;
  display_name: string | null;
  role: string;
  active: boolean;
  barbershop_id: string | null;
  barber_id: string | null;
};

export type LinkBarberProfileByEmailInput = {
  targetEmail: string;
  targetBarberId: string;
  ownerBarbers: BarberOption[];
  ownerBarbershopId?: string | null;
};

type CodedError = Error & { code?: string };

const createBarberProfileLinkingError = (
  code: BarberProfileLinkingErrorCode,
  message: string = code
): CodedError => {
  const error = new Error(message) as CodedError;
  error.code = code;
  return error;
};

export const normalizeBarberProfileLinkingEmail = (value?: string): string => value?.trim().toLowerCase() || '';

export const getBarberProfileLinkingSuccessMessage = ({
  barberName,
  email
}: {
  barberName: string;
  email: string;
}): string => (
  `Conta vinculada ao profissional ${barberName}. E-mail usado: ${email}. Se a agenda ainda nao aparecer para o barbeiro, peca para ele sair e entrar novamente.`
);

export const isOwnerBarberEligibleForProfileLinking = (
  barber: BarberOption | undefined,
  ownerBarbershopId?: string | null
): barber is BarberOption => {
  if (!barber?.id?.trim()) return false;
  if (!ownerBarbershopId) return true;
  return barber.barbershopId === ownerBarbershopId;
};

export const getBarberProfileLinkingErrorCode = (error: unknown): string | null => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim()) {
      return code.trim();
    }
  }

  const message = error instanceof Error ? error.message : String(error || '');
  const knownCodes: BarberProfileLinkingErrorCode[] = [
    'TARGET_EMAIL_REQUIRED',
    'TARGET_BARBER_REQUIRED',
    'BARBER_NOT_IN_TENANT',
    'TARGET_USER_NOT_FOUND',
    'TARGET_PROFILE_BELONGS_TO_ANOTHER_TENANT',
    'TARGET_PROFILE_IS_OWNER',
    'TARGET_USER_CANNOT_BE_OWNER',
    'OWNER_BARBERSHOP_REQUIRED',
    'PROFILE_LINKING_REQUIRES_SUPABASE'
  ];

  return knownCodes.find((code) => message.includes(code)) || null;
};

export const getBarberProfileLinkingErrorMessage = (error: unknown): string => {
  switch (getBarberProfileLinkingErrorCode(error)) {
    case 'TARGET_USER_NOT_FOUND':
      return 'Nenhuma conta foi encontrada com este e-mail. Peca para o barbeiro criar a conta primeiro e tente novamente.';
    case 'BARBER_NOT_IN_TENANT':
      return 'O profissional selecionado nao pertence a esta barbearia.';
    case 'TARGET_PROFILE_BELONGS_TO_ANOTHER_TENANT':
      return 'Esta conta ja esta vinculada a outra barbearia.';
    case 'TARGET_PROFILE_IS_OWNER':
      return 'Esta conta e de owner e nao pode ser vinculada como barbeiro.';
    case 'TARGET_USER_CANNOT_BE_OWNER':
      return 'Use uma conta separada para o barbeiro. Uma conta de owner nao deve ser usada como perfil de atendimento.';
    default:
      return BARBER_PROFILE_LINKING_GENERIC_ERROR_MESSAGE;
  }
};

const mapLinkedBarberProfile = (row: RpcLinkedBarberProfileRow): LinkedBarberProfile => ({
  profileId: row.profile_id,
  displayName: row.display_name,
  role: row.role,
  active: row.active,
  barbershopId: row.barbershop_id,
  barberId: row.barber_id
});

export const linkBarberProfileByEmail = async ({
  targetEmail,
  targetBarberId,
  ownerBarbers,
  ownerBarbershopId
}: LinkBarberProfileByEmailInput): Promise<LinkedBarberProfile> => {
  const normalizedEmail = normalizeBarberProfileLinkingEmail(targetEmail);

  if (!normalizedEmail) {
    throw createBarberProfileLinkingError('TARGET_EMAIL_REQUIRED');
  }

  if (!targetBarberId.trim()) {
    throw createBarberProfileLinkingError('TARGET_BARBER_REQUIRED');
  }

  if (ownerBarbershopId && !isUuid(ownerBarbershopId)) {
    throw createBarberProfileLinkingError('OWNER_BARBERSHOP_REQUIRED');
  }

  const targetBarber = ownerBarbers.find((barber) => barber.id === targetBarberId);
  if (!isOwnerBarberEligibleForProfileLinking(targetBarber, ownerBarbershopId)) {
    throw createBarberProfileLinkingError('BARBER_NOT_IN_TENANT');
  }

  if (shouldUseLocalFallback || !supabase) {
    throw createBarberProfileLinkingError('PROFILE_LINKING_REQUIRES_SUPABASE');
  }

  assertOperationalSupabase();

  const { data, error } = await supabase.rpc('link_barber_profile_by_email', {
    p_target_email: normalizedEmail,
    p_target_barber_id: targetBarberId
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] as RpcLinkedBarberProfileRow | undefined : data as RpcLinkedBarberProfileRow | null;

  if (!row?.profile_id) {
    throw createBarberProfileLinkingError('PROFILE_LINKING_REQUIRES_SUPABASE', 'RPC returned no linked profile.');
  }

  return mapLinkedBarberProfile(row);
};
