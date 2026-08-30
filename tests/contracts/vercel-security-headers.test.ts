import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type VercelHeader = { key: string; value: string };
type VercelConfig = {
  rewrites?: Array<{ source: string; destination: string }>;
  headers?: Array<{ source: string; headers: VercelHeader[] }>;
};

const configText = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');
const config = JSON.parse(configText) as VercelConfig;
const allRoutes = config.headers?.find((entry) => entry.source === '/(.*)');
const headers = new Map((allRoutes?.headers || []).map(({ key, value }) => [key.toLowerCase(), value]));

const parseCsp = (value: string): Map<string, string[]> => {
  const directives = new Map<string, string[]>();

  for (const segment of value.split(';').map((part) => part.trim()).filter(Boolean)) {
    const [name, ...sources] = segment.split(/\s+/);
    if (!name || directives.has(name)) throw new Error(`Invalid or duplicate CSP directive: ${name}`);
    directives.set(name, sources);
  }

  return directives;
};

describe('Vercel defensive security headers', () => {
  it('keeps valid JSON and the existing SPA rewrite', () => {
    expect(() => JSON.parse(configText)).not.toThrow();
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
  });

  it('applies the required defensive headers to every route', () => {
    expect(allRoutes).toBeDefined();
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.has('cross-origin-opener-policy')).toBe(false);
    expect(headers.get('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
    );
  });

  it('defines CSP only in report-only mode with unique, well-formed directives', () => {
    expect(headers.has('content-security-policy')).toBe(false);
    const rawCsp = headers.get('content-security-policy-report-only');
    expect(rawCsp).toBeDefined();
    expect(rawCsp).not.toMatch(/[\r\n]/);

    const csp = parseCsp(rawCsp!);
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('form-action')).toEqual(["'self'"]);
    expect(csp.get('script-src')).toEqual(["'self'"]);
    expect(csp.get('worker-src')).toEqual(["'self'"]);
    expect(csp.get('manifest-src')).toEqual(["'self'"]);
    expect([...csp.values()].flat()).not.toContain("'unsafe-eval'");
    expect([...csp.values()].flat()).not.toContain('*');
  });

  it('limits external origins to the directives required by runtime behavior', () => {
    const csp = parseCsp(headers.get('content-security-policy-report-only')!);
    const directivesFor = (needle: string) => [...csp.entries()]
      .filter(([, sources]) => sources.some((source) => source.includes(needle)))
      .map(([directive]) => directive);

    expect(directivesFor('supabase.co')).toEqual(['connect-src']);
    expect(directivesFor('sentry.io')).toEqual(['connect-src']);
    expect(csp.get('connect-src')).toEqual(expect.arrayContaining([
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://*.ingest.sentry.io',
      'https://*.ingest.us.sentry.io'
    ]));
    expect(csp.get('style-src')).toEqual([
      "'self'",
      "'unsafe-inline'",
      'https://fonts.googleapis.com'
    ]);
    expect(csp.get('font-src')).toEqual(["'self'", 'https://fonts.gstatic.com']);
    expect(csp.get('img-src')).toEqual(["'self'", 'https:']);
  });

  it('contains no embedded credentials or administrative secrets', () => {
    expect(configText).not.toMatch(/service_role|authorization|apikey|access_token|refresh_token/i);
    expect(configText).not.toMatch(/https:\/\/[^\s;"']+:[^\s;"']+@/);
  });
});
