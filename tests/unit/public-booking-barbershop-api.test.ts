import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../api/public-booking/barbershop';

const request = (slug = 'shop-test') => ({ method: 'GET', url: `/api/public-booking/barbershop?slug=${encodeURIComponent(slug)}` } as Request);
const shop = {
  id: 'tenant-a', name: 'Shop', slug: 'shop-test', active: true,
  operational_timezone: 'America/Recife', financial_timezone: 'private', created_at: 'private'
};
const fetchMock = vi.fn();

describe('controlled public barbershop projection', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-server-only');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('uses a fixed active tenant query, exposes operational timezone, never financial settings or credentials', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([shop])));
    const response = await GET({ ...request(), url: `${request().url}&select=*&active=false&barbershop_id=foreign` } as Request);
    const [url, options] = fetchMock.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(new URL(url).pathname).toBe('/rest/v1/barbershops');
    expect(Object.fromEntries(params)).toEqual({
      select: 'id,name,slug,phone,address,logo_url,cover_image_url,description,instagram_url,whatsapp,primary_color,secondary_color,business_hours,slot_step_minutes,active,operational_timezone',
      slug: 'eq.shop-test', active: 'eq.true', limit: '1'
    });
    expect(options.headers.authorization).toBe('Bearer test-server-only');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ barbershop: {
      id: shop.id, name: shop.name, slug: shop.slug, active: true, operational_timezone: 'America/Recife'
    } });
  });

  it.each(['', 'x', 'shop,or(active.eq.false)', 'shop/other', 'a'.repeat(81)])('rejects invalid slug %s before access', async slug => {
    expect((await GET(request(slug))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects non-GET and missing credentials without access', async () => {
    expect((await GET({ ...request(), method: 'POST' } as Request)).status).toBe(405);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect((await GET(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('returns missing/inactive tenant as null and preserves unconfigured timezone', async () => {
    fetchMock.mockResolvedValueOnce(new Response('[]'))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...shop, operational_timezone: null }])));
    expect(await (await GET(request())).json()).toEqual({ barbershop: null });
    expect((await (await GET(request())).json()).barbershop.operational_timezone).toBeNull();
  });
  it.each([null, {}, [shop, shop], [{ ...shop, slug: 'foreign' }], [{ ...shop, active: false }], [{ ...shop, operational_timezone: undefined }]])('fails closed on malformed or unscoped result %j', async data => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(data)));
    expect((await GET(request())).status).toBe(503);
  });
  it('sanitizes HTTP, invalid JSON, network and timeout failures', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: '42501', message: 'private SQL', details: 'private' }), { status: 403 }))
      .mockResolvedValueOnce(new Response('not-json'))
      .mockRejectedValueOnce(new Error('private network detail'))
      .mockRejectedValueOnce(new DOMException('private timeout', 'TimeoutError'));
    for (let i = 0; i < 4; i++) {
      const response = await GET(request());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ code: 'PUBLIC_BOOKING_UNAVAILABLE' });
    }
  });
});
