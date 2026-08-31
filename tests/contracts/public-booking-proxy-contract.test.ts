import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('public booking proxy contract', () => {
  const repository = read('services/appointmentRepository.ts');
  const createEndpoint = read('api/public-booking/create.ts');
  const slotsEndpoint = read('api/public-booking/slots.ts');
  const shared = read('api/public-booking/_shared.ts');
  const rollout = read('docs/public-booking-vercel-proxy.md');

  it('uses distinct same-origin endpoints without direct browser RPC fallback', () => {
    expect(repository).toContain("'/api/public-booking/create'");
    expect(repository).toContain('`/api/public-booking/slots?slug=');
    expect(repository).not.toMatch(/supabase\.rpc\(['"](?:create_public_appointment|get_public_appointment_slots)/);
  });

  it('does not interpret client IP headers or implement an in-memory counter', () => {
    const serverSource = `${createEndpoint}\n${slotsEndpoint}\n${shared}`;
    expect(serverSource).not.toMatch(/x-forwarded-for|cf-connecting-ip|x-real-ip/i);
    expect(serverSource).not.toMatch(/rateLimitMap|new Map|clientIp/i);
  });

  it('keeps secrets server-only and out of the Vite-prefixed environment', () => {
    expect(shared).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(shared).toContain('SUPABASE_URL');
    expect(shared).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY');
  });

  it('documents exactly one Hobby WAF rule for the creation path', () => {
    expect(rollout).toContain('public-booking-create-rate-limit');
    expect(rollout).toContain('`/api/public-booking/create`');
    expect(rollout).toContain('5 requisicoes por 10 minutos');
    expect(rollout).toContain('uma unica regra');
    expect(rollout).not.toMatch(/regra WAF[^\n]*slots/i);
  });

  it('keeps the API paths distinct and explicit', () => {
    const vercelConfig = JSON.parse(read('vercel.json')) as { rewrites?: Array<{ source: string; destination: string }> };
    expect(existsSync(resolve(process.cwd(), 'api/public-booking/create.ts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'api/public-booking/slots.ts'))).toBe(true);
    expect(vercelConfig.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
    expect(createEndpoint).toContain("request.method !== 'POST'");
    expect(slotsEndpoint).toContain("request.method !== 'GET'");
  });
});
