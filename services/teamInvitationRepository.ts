import { isSupabaseConfigured, shouldUseLocalFallback, supabase } from '../lib/supabase';
import { isUuid } from '../utils';
import { OperationalError } from '../utils/operationalError';

export type TeamInvitation = { invitationId: string; token: string; expiresAt: string };
export const INVITATIONS_ONLINE_ONLY = 'Convites disponíveis apenas no ambiente online.';
const GENERIC_ERROR = 'Não foi possível concluir esta ação com o convite.';
const messages = {
  AUTH_REQUIRED: 'Entre novamente para continuar.',
  TEAM_INVITATION_FORBIDDEN: 'Você não pode gerenciar convites nesta sessão.',
  TEAM_INVITATION_INPUT_INVALID: 'Confira o profissional e o e-mail informado.',
  TEAM_INVITATION_UNAVAILABLE: GENERIC_ERROR
} as const;

const safeError = (error: unknown): OperationalError => {
  const message = (error as { message?: unknown } | null)?.message;
  const code = typeof message === 'string' && Object.hasOwn(messages, message)
    ? message as keyof typeof messages : undefined;
  return new OperationalError(code ? messages[code] : GENERIC_ERROR, { publicCode: code });
};

export const getTeamInvitationErrorMessage = (error: unknown): string => {
  if (error instanceof OperationalError) {
    if (error.publicCode === 'TEAM_INVITATION_ONLINE_REQUIRED') return INVITATIONS_ONLINE_ONLY;
    if (error.publicCode && Object.hasOwn(messages, error.publicCode)) {
      return messages[error.publicCode as keyof typeof messages];
    }
  }
  return GENERIC_ERROR;
};

const client = () => {
  if (!isSupabaseConfigured || shouldUseLocalFallback || !supabase) {
    throw new OperationalError(INVITATIONS_ONLINE_ONLY, { publicCode: 'TEAM_INVITATION_ONLINE_REQUIRED' });
  }
  return supabase;
};

const validExpiry = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value))
  && new Date(value.slice(0, 10)).toISOString().slice(0, 10) === value.slice(0, 10);

export const issueTeamInvitation = async (barberId: string, recipientEmail: string): Promise<TeamInvitation> => {
  const remote = client();
  const email = recipientEmail.trim().toLowerCase();
  if (!isUuid(barberId) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw safeError({ message: 'TEAM_INVITATION_INPUT_INVALID' });
  }
  try {
    const { data, error } = await remote.rpc('issue_team_invitation', {
      p_barber_id: barberId, p_recipient_email: email
    });
    if (error) throw error;
    const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (!row || typeof row.invitation_id !== 'string' || !isUuid(row.invitation_id)
      || typeof row.token !== 'string' || !/^[0-9a-f]{64}$/.test(row.token) || !validExpiry(row.expires_at)) {
      throw new Error();
    }
    return { invitationId: row.invitation_id, token: row.token, expiresAt: row.expires_at };
  } catch (error) {
    // Never propagate raw Supabase messages, payloads, details or hints to callers.
    throw safeError(error);
  }
};

export const revokeTeamInvitation = async (invitationId: string): Promise<void> => {
  const remote = client();
  if (!isUuid(invitationId)) throw safeError({ message: 'TEAM_INVITATION_INPUT_INVALID' });
  try {
    const { error } = await remote.rpc('revoke_team_invitation', { p_invitation_id: invitationId });
    if (error) throw error;
  } catch (error) {
    throw safeError(error);
  }
};
