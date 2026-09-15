import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../api/public-booking/availability';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../../api/public-booking/_shared.js', async (original) => ({
  ...await original<typeof import('../../api/public-booking/_shared.js')>(), callBookingRpc: rpc
}));
const id = '11111111-1111-4111-8111-111111111111';
const params = { slug: 'shop-test', service_id: id, barber_id: id, local_date: '2030-01-07' };
const request = (changes = {}) => ({ method: 'GET', url: `/api/public-booking/availability?${new URLSearchParams({ ...params, ...changes })}` } as Request);
describe('public availability endpoint', () => {
  beforeEach(() => rpc.mockReset());
  it.each([{ slug: '' }, { service_id: 'bad' }, { barber_id: 'bad' }, { local_date: '2030-02-30' }, { local_date: '07/01/2030' }])('rejects invalid input %j', async (changes) => {
    expect((await GET(request(changes))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('preserves exact timestamps, projects only slots and disables cache', async () => {
    const slot = { start_at: '2030-01-07T09:00:00-03:00', end_at: '2030-01-07T09:45:00-03:00' };
    rpc.mockResolvedValue({ data: [{ ...slot, client_phone: 'not-public' }] });
    const response = await GET(request());
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ slots: [slot] });
    expect(rpc).toHaveBeenCalledWith('get_public_availability_by_slug', { p_slug: 'shop-test', p_service_id: id, p_barber_id: id, p_local_date: '2030-01-07' });
  });
  it('returns empty as success and malformed upstream data as error', async () => {
    rpc.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: null });
    expect(await (await GET(request())).json()).toEqual({ slots: [] });
    expect((await GET(request())).status).toBe(503);
  });
  it('returns only a known error code', async () => {
    rpc.mockResolvedValue({ errorCode: 'PUBLIC_AVAILABILITY_TIMEZONE_REQUIRED', data: null, details: 'SQL secret' });
    const response = await GET(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: 'PUBLIC_AVAILABILITY_TIMEZONE_REQUIRED' });
  });
});
