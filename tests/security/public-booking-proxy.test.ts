import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import createHandler from '../../api/public-booking/create';
import slotsHandler from '../../api/public-booking/slots';

const validPayload = {
  barbershopId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  barberId: '11111111-1111-4111-8111-111111111111',
  serviceId: '33333333-3333-4333-8333-333333333333',
  clientName: 'Cliente Teste',
  clientPhone: '85999990000',
  startAt: '2026-09-10T12:00:00.000Z',
  endAt: '2026-09-10T12:30:00.000Z',
  notes: null
};

describe('public booking Vercel proxy', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('creation accepts only POST and is never cacheable', async () => {
    const response = await createHandler(new Request('https://example.test/api/public-booking/create'));
    expect(response.status).toBe(405);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('slots accepts only GET', async () => {
    const response = await slotsHandler(new Request('https://example.test/api/public-booking/slots', { method: 'POST' }));
    expect(response.status).toBe(405);
  });

  it('rejects invalid content type, JSON, fields and oversized payloads', async () => {
    expect((await createHandler(new Request('https://example.test/api/public-booking/create', { method: 'POST', body: '{}' }))).status).toBe(415);
    expect((await createHandler(new Request('https://example.test/api/public-booking/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }))).status).toBe(400);
    expect((await createHandler(new Request('https://example.test/api/public-booking/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...validPayload, token: 'forbidden' }) }))).status).toBe(400);
    expect((await createHandler(new Request('https://example.test/api/public-booking/create', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '9000' }, body: '{}' }))).status).toBe(413);
  });

  it('calls only the controlled creation RPC and returns a sanitized id', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify('appointment-id'), { status: 200 }));
    const response = await createHandler(new Request('https://example.test/api/public-booking/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload)
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'appointment-id' });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('https://project.supabase.co/rest/v1/rpc/create_public_appointment');
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('fails closed without credentials and sanitizes unexpected failures', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const missing = await createHandler(new Request('https://example.test/api/public-booking/create', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validPayload)
    }));
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({ code: 'PUBLIC_BOOKING_UNAVAILABLE' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves public conflict and rate-limit codes without leaking upstream details', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'PUBLIC_APPOINTMENT_SLOT_CONFLICT', details: 'private sql' }), { status: 400 }));
    const conflict = await createHandler(new Request('https://example.test/api/public-booking/create', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validPayload)
    }));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ code: 'PUBLIC_APPOINTMENT_SLOT_CONFLICT' });

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'PUBLIC_APPOINTMENT_RATE_LIMITED' }), { status: 400 }));
    const limited = await createHandler(new Request('https://example.test/api/public-booking/create', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validPayload)
    }));
    expect(limited.status).toBe(429);
  });

  it('resolves slots by slug and returns the minimal cacheable projection', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{
      barber_id: validPayload.barberId,
      barber_name: 'Barbeiro',
      start_at: validPayload.startAt,
      end_at: validPayload.endAt,
      status: 'scheduled'
    }]), { status: 200 }));
    const response = await slotsHandler({
      method: 'GET',
      url: '/api/public-booking/slots?slug=barbearia-alpha'
    } as Request);
    const body = await response.json() as { slots: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=15, stale-while-revalidate=30');
    expect(body.slots[0]).not.toHaveProperty('barbershop_id');
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('https://project.supabase.co/rest/v1/rpc/get_public_appointment_slots_by_slug');
  });

  it('does not cache invalid slug or upstream errors', async () => {
    const invalid = await slotsHandler(new Request('https://example.test/api/public-booking/slots?slug=../tenant'));
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get('cache-control')).toBe('no-store');

    vi.mocked(fetch).mockRejectedValue(new Error('upstream with private details'));
    const failed = await slotsHandler(new Request('https://example.test/api/public-booking/slots?slug=barbearia-alpha'));
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ code: 'PUBLIC_BOOKING_UNAVAILABLE' });
  });
});
