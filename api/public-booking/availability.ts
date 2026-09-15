import { callBookingRpc, jsonResponse, statusForPublicCode } from './_shared.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Slot = { start_at: string; end_at: string };
const isSlot = (value: unknown): value is Slot => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.start_at === 'string' && typeof row.end_at === 'string'
    && Number.isFinite(Date.parse(row.start_at)) && Date.parse(row.end_at) > Date.parse(row.start_at);
};

export async function GET(request: Request): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405, 'no-store');
  const params = new URL(request.url, 'http://localhost').searchParams;
  const slug = params.get('slug')?.trim().toLowerCase() || '';
  const service = params.get('service_id') || '';
  const barber = params.get('barber_id') || '';
  const date = params.get('local_date') || '';
  const invalid = !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 80
    ? 'INVALID_TENANT' : !UUID.test(service) ? 'INVALID_SERVICE' : !UUID.test(barber) ? 'INVALID_BARBER'
      : !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
        || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ? 'INVALID_DATE' : null;
  if (invalid) return jsonResponse({ code: `PUBLIC_AVAILABILITY_${invalid}` }, 400, 'no-store');
  const result = await callBookingRpc<unknown>('get_public_availability_by_slug', {
    p_slug: slug, p_service_id: service, p_barber_id: barber, p_local_date: date
  });
  if (result.errorCode) return jsonResponse({ code: result.errorCode }, statusForPublicCode(result.errorCode), 'no-store');
  if (!Array.isArray(result.data) || !result.data.every(isSlot)) {
    return jsonResponse({ code: 'PUBLIC_BOOKING_UNAVAILABLE' }, 503, 'no-store');
  }
  return jsonResponse({ slots: result.data.map(({ start_at, end_at }) => ({ start_at, end_at })) }, 200, 'no-store');
}
