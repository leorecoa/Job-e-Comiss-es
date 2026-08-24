import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getOperationalErrorMessage,
  logOperationalError,
  sanitizeOperationalError
} from '../../utils/errorHandling';
import { getPublicBookingSubmissionErrorMessage } from '../../components/PublicBookingPage';
import {
  PUBLIC_BOOKING_ACTIVE_LIMIT_MESSAGE,
  PUBLIC_BOOKING_RATE_LIMIT_MESSAGE
} from '../../scheduling';

describe('production error visibility', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs technical context without sensitive auth fields', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logOperationalError('owner:load-catalog', {
      message: 'permission denied for table services',
      code: '42501',
      authorization: 'Bearer secret-token',
      apikey: 'secret-key',
      refreshToken: 'secret-refresh',
      status: 403
    });

    expect(consoleError).toHaveBeenCalledWith('[owner:load-catalog]', {
      message: 'permission denied for table services',
      code: '42501',
      status: 403
    });
  });

  it('sanitizes non-error objects before logging', () => {
    expect(sanitizeOperationalError({
      message: 'network failure',
      headers: { authorization: 'Bearer secret-token' },
      token: 'secret-token',
      status: 500
    })).toEqual({
      message: 'network failure',
      status: 500
    });
  });

  it('maps expired session and network failures to operational messages', () => {
    expect(getOperationalErrorMessage(
      { message: 'JWT expired', status: 401 },
      'Fallback',
      { authExpiredMessage: 'Sua sessao pode ter expirado. Entre novamente.' }
    )).toBe('Sua sessao pode ter expirado. Entre novamente.');

    expect(getOperationalErrorMessage(
      new Error('Failed to fetch'),
      'Fallback',
      { networkMessage: 'Nao foi possivel conectar ao Supabase.' }
    )).toBe('Nao foi possivel conectar ao Supabase.');
  });

  it('keeps public booking technical failures friendly', () => {
    expect(getPublicBookingSubmissionErrorMessage({
      message: 'new row violates row-level security policy for table appointments',
      code: '42501'
    })).toBe('Nao foi possivel confirmar este horario. Tente novamente.');
  });

  it.each([PUBLIC_BOOKING_RATE_LIMIT_MESSAGE, PUBLIC_BOOKING_ACTIVE_LIMIT_MESSAGE])(
    'preserves controlled public abuse message %s',
    (message) => {
      expect(getPublicBookingSubmissionErrorMessage(new Error(message))).toBe(message);
    }
  );
});
