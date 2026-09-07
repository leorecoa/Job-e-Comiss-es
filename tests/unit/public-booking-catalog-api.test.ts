import { beforeEach, describe, expect, it, vi } from 'vitest';

const callBookingRpc = vi.hoisted(() => vi.fn());

vi.mock('../../api/public-booking/_shared.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../api/public-booking/_shared.js')>(),
  callBookingRpc
}));

import { GET } from '../../api/public-booking/catalog';

const request = (url: string): Request => ({ method: 'GET', url } as Request);

describe('public booking catalog endpoint', () => {
  beforeEach(() => callBookingRpc.mockReset());

  it('rejects missing and invalid slugs before calling Supabase', async () => {
    for (const url of ['/api/public-booking/catalog', '/api/public-booking/catalog?slug=INVALID!']) {
      const response = await GET(request(url));
      expect(response.status).toBe(400);
    }
    expect(callBookingRpc).not.toHaveBeenCalled();
  });

  it('returns an allowlisted tenant catalog without internal fields', async () => {
    callBookingRpc.mockResolvedValue({
      data: [{
        id: 'service-1',
        name: 'Corte',
        price: '50.00',
        duration_minutes: 30,
        commission_rate: 40,
        barbershop_id: 'tenant-1',
        active: true,
        created_at: '2026-01-01T00:00:00Z'
      }]
    });

    const response = await GET(request('/api/public-booking/catalog?slug=leo-do-leo'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(callBookingRpc).toHaveBeenCalledWith('get_public_services_by_slug', { p_slug: 'leo-do-leo' });
    expect(body).toEqual({ services: [{ id: 'service-1', name: 'Corte', price: 50, duration_minutes: 30 }] });
    expect(JSON.stringify(body)).not.toMatch(/commission_rate|barbershop_id|active|created_at|updated_at/);
  });

  it('does not expose provider payloads when the RPC fails', async () => {
    callBookingRpc.mockResolvedValue({ data: null, errorCode: 'PUBLIC_APPOINTMENT_INVALID_TENANT' });

    const response = await GET(request('/api/public-booking/catalog?slug=inexistente'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: 'PUBLIC_APPOINTMENT_INVALID_TENANT' });
  });
});
