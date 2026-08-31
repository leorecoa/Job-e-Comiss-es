const SUPABASE_TIMEOUT_MS = 8_000;

type RpcResult<T> = {
  data: T | null;
  errorCode?: string;
};

const publicErrorCodes = [
  'PUBLIC_APPOINTMENT_INVALID_TENANT',
  'PUBLIC_APPOINTMENT_INVALID_BARBER',
  'PUBLIC_APPOINTMENT_INACTIVE_BARBER',
  'PUBLIC_APPOINTMENT_INVALID_SERVICE',
  'PUBLIC_APPOINTMENT_INACTIVE_SERVICE',
  'PUBLIC_APPOINTMENT_INVALID_TIME',
  'PUBLIC_APPOINTMENT_INVALID_INPUT',
  'PUBLIC_APPOINTMENT_RATE_LIMITED',
  'PUBLIC_APPOINTMENT_ACTIVE_LIMIT',
  'PUBLIC_APPOINTMENT_SLOT_CONFLICT'
] as const;

const getServerCredentials = (): { url: string; key: string } | null => {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
};

const findPublicErrorCode = (value: unknown): string | undefined => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return publicErrorCodes.find((code) => serialized.includes(code));
};

export const callBookingRpc = async <T>(name: string, payload: Record<string, unknown>): Promise<RpcResult<T>> => {
  const credentials = getServerCredentials();
  if (!credentials) return { data: null, errorCode: 'PUBLIC_BOOKING_UNAVAILABLE' };

  try {
    const response = await fetch(`${credentials.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: credentials.key,
        authorization: `Bearer ${credentials.key}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS)
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return { data: null, errorCode: findPublicErrorCode(body) || 'PUBLIC_BOOKING_UNAVAILABLE' };
    }

    return { data: body as T };
  } catch {
    return { data: null, errorCode: 'PUBLIC_BOOKING_UNAVAILABLE' };
  }
};

export const jsonResponse = (body: unknown, status: number, cacheControl: string): Response => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      'cache-control': cacheControl,
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff'
    }
  }
);

export const statusForPublicCode = (code: string): number => {
  if (code === 'PUBLIC_APPOINTMENT_RATE_LIMITED') return 429;
  if (code === 'PUBLIC_APPOINTMENT_SLOT_CONFLICT' || code === 'PUBLIC_APPOINTMENT_ACTIVE_LIMIT') return 409;
  if (code === 'PUBLIC_BOOKING_UNAVAILABLE') return 503;
  return 400;
};
