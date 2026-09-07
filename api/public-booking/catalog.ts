import { callBookingRpc, jsonResponse, statusForPublicCode } from './_shared.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CATALOG_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=120';

type PublicServiceRow = {
  id: string;
  name: string;
  price: number | string;
  duration_minutes: number;
};

const isPublicServiceRow = (value: unknown): value is PublicServiceRow => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string'
    && typeof row.name === 'string'
    && (typeof row.price === 'number' || typeof row.price === 'string')
    && typeof row.duration_minutes === 'number';
};

export async function GET(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405, 'no-store');
  }

  const slug = new URL(request.url, 'http://localhost').searchParams.get('slug')?.trim().toLowerCase() || '';
  if (slug.length < 3 || slug.length > 80 || !SLUG_PATTERN.test(slug)) {
    return jsonResponse({ code: 'PUBLIC_APPOINTMENT_INVALID_TENANT' }, 400, 'no-store');
  }

  const result = await callBookingRpc<unknown[]>('get_public_services_by_slug', { p_slug: slug });
  if (result.errorCode) return jsonResponse({ code: result.errorCode }, statusForPublicCode(result.errorCode), 'no-store');

  const services = Array.isArray(result.data)
    ? result.data.filter(isPublicServiceRow).map((service) => ({
        id: service.id,
        name: service.name,
        price: Number(service.price),
        duration_minutes: service.duration_minutes
      }))
    : [];

  return jsonResponse({ services }, 200, CATALOG_CACHE_CONTROL);
}
