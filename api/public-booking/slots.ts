import { callBookingRpc, jsonResponse } from './_shared.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLOT_CACHE_CONTROL = 'public, s-maxage=15, stale-while-revalidate=30';

type SlotRow = {
  barber_id: string | null;
  barber_name: string;
  start_at: string;
  end_at: string;
  status: string;
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405, 'no-store');
  }

  const slug = new URL(request.url, 'http://localhost').searchParams.get('slug')?.trim().toLowerCase() || '';
  if (slug.length < 3 || slug.length > 80 || !SLUG_PATTERN.test(slug)) {
    return jsonResponse({ code: 'PUBLIC_APPOINTMENT_INVALID_TENANT' }, 400, 'no-store');
  }

  const result = await callBookingRpc<SlotRow[]>('get_public_appointment_slots_by_slug', { p_slug: slug });
  if (result.errorCode) return jsonResponse({ code: result.errorCode }, 503, 'no-store');

  return jsonResponse({ slots: result.data || [] }, 200, SLOT_CACHE_CONTROL);
}
