import { getServerCredentials, jsonResponse } from './_shared.js';

const PUBLIC_FIELDS = [
  'id', 'name', 'slug', 'phone', 'address', 'logo_url', 'cover_image_url',
  'description', 'instagram_url', 'whatsapp', 'primary_color', 'secondary_color',
  'business_hours', 'slot_step_minutes', 'active', 'operational_timezone'
] as const;

export async function GET(request: Request): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405, 'no-store');
  const slug = new URL(request.url, 'http://localhost').searchParams.get('slug')?.trim().toLowerCase() || '';
  if (slug.length < 3 || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return jsonResponse({ code: 'PUBLIC_APPOINTMENT_INVALID_TENANT' }, 400, 'no-store');
  }

  const unavailable = () => jsonResponse({ code: 'PUBLIC_BOOKING_UNAVAILABLE' }, 503, 'no-store');
  const credentials = getServerCredentials();
  if (!credentials) return unavailable();

  try {
    // Fixed projection and tenant filter: callers cannot choose columns or filters.
    const query = new URLSearchParams({ select: PUBLIC_FIELDS.join(','), slug: `eq.${slug}`, active: 'eq.true', limit: '1' });
    const response = await fetch(`${credentials.url}/rest/v1/barbershops?${query}`, {
      headers: { apikey: credentials.key, authorization: `Bearer ${credentials.key}` },
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) return unavailable();
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length > 1) return unavailable();
    if (!rows.length) return jsonResponse({ barbershop: null }, 200, 'no-store');
    const row = rows[0];
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || typeof row.name !== 'string'
      || row.slug !== slug || row.active !== true
      || !(row.operational_timezone === null || typeof row.operational_timezone === 'string')) return unavailable();
    return jsonResponse({ barbershop: Object.fromEntries(PUBLIC_FIELDS.map((field) => [field, row[field]])) }, 200, 'no-store');
  } catch {
    return unavailable();
  }
}
