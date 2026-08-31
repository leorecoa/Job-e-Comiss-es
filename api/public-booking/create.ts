import { callBookingRpc, jsonResponse, statusForPublicCode } from './_shared';

const MAX_BODY_BYTES = 8_192;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = new Set([
  'barbershopId', 'barberId', 'serviceId', 'clientName', 'clientPhone', 'startAt', 'endAt', 'notes'
]);

type CreatePayload = {
  barbershopId: string;
  barberId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  startAt: string;
  endAt: string;
  notes?: string | null;
};

const isValidPayload = (value: unknown): value is CreatePayload => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (Object.keys(payload).some((key) => !ALLOWED_KEYS.has(key))) return false;

  return ['barbershopId', 'barberId', 'serviceId'].every((key) => (
    typeof payload[key] === 'string' && UUID_PATTERN.test(payload[key] as string)
  ))
    && typeof payload.clientName === 'string' && payload.clientName.trim().length >= 2 && payload.clientName.length <= 120
    && typeof payload.clientPhone === 'string' && payload.clientPhone.length <= 30
    && typeof payload.startAt === 'string' && !Number.isNaN(Date.parse(payload.startAt))
    && typeof payload.endAt === 'string' && !Number.isNaN(Date.parse(payload.endAt))
    && (payload.notes === undefined || payload.notes === null || (typeof payload.notes === 'string' && payload.notes.length <= 500));
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405, 'no-store');
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ code: 'INVALID_CONTENT_TYPE' }, 415, 'no-store');
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return jsonResponse({ code: 'INVALID_PAYLOAD' }, 413, 'no-store');

  const rawBody = await request.text().catch(() => '');
  if (!rawBody || new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ code: 'INVALID_PAYLOAD' }, 400, 'no-store');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ code: 'INVALID_JSON' }, 400, 'no-store');
  }
  if (!isValidPayload(payload)) return jsonResponse({ code: 'PUBLIC_APPOINTMENT_INVALID_INPUT' }, 400, 'no-store');

  const result = await callBookingRpc<string>('create_public_appointment', {
    p_barbershop_id: payload.barbershopId,
    p_barber_id: payload.barberId,
    p_service_id: payload.serviceId,
    p_client_name: payload.clientName.trim(),
    p_client_phone: payload.clientPhone,
    p_start_at: payload.startAt,
    p_end_at: payload.endAt,
    p_notes: payload.notes?.trim() || null
  });

  if (result.errorCode) {
    return jsonResponse({ code: result.errorCode }, statusForPublicCode(result.errorCode), 'no-store');
  }
  return jsonResponse({ id: result.data }, 201, 'no-store');
}
