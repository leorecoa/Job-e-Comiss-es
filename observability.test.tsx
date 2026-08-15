import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((callback: (scope: { setTag: ReturnType<typeof vi.fn>; setExtra: ReturnType<typeof vi.fn> }) => void) => callback({
    setTag: vi.fn(),
    setExtra: vi.fn()
  }))
}));

vi.mock('@sentry/react', () => sentry);

import { AppErrorBoundary } from './components/AppErrorBoundary';
import {
  initializeObservability,
  isExpectedOperationalError,
  reportUnexpectedError,
  resetObservabilityForTests,
  sanitizeSentryEvent
} from './utils/observability';

describe('privacy-safe production observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetObservabilityForTests();
  });

  it('does not initialize without a DSN', () => {
    expect(initializeObservability({ dsn: '' })).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('initializes once with privacy-safe options', () => {
    expect(initializeObservability({ dsn: 'https://public@example.invalid/1', environment: 'preview', release: 'commit-sha' })).toBe(true);
    expect(initializeObservability({ dsn: 'https://public@example.invalid/1' })).toBe(false);
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({
      sendDefaultPii: false,
      tracesSampleRate: 0,
      environment: 'preview',
      release: 'commit-sha',
      beforeSend: sanitizeSentryEvent
    }));
  });

  it('removes request data, headers, tokens, PII, user, breadcrumbs and storage-like context', () => {
    const event = sanitizeSentryEvent({
      type: undefined,
      environment: 'preview',
      release: 'preview-commit-sha',
      message: 'Maria maria@example.com 81999999999 notes=segredo',
      request: {
        url: 'https://example.test/book/shop?access_token=secret',
        headers: { Authorization: 'Bearer token', apikey: 'secret' },
        data: { client_name: 'Maria', client_phone: '81999999999' },
        cookies: { session: 'secret' }
      },
      user: { email: 'maria@example.com', id: 'auth-uuid' },
      breadcrumbs: [{ message: 'Telefone 81999999999' }],
      contexts: { localStorage: { token: 'secret' }, sessionStorage: { refresh_token: 'secret' } },
      tags: {
        operation: 'appointment-repository:create',
        route: '/book/:tenant',
        ignored: 'client_name=Maria'
      },
      extra: {
        correlation_id: 'random-correlation',
        payload: { client_name: 'Maria' },
        notes: 'segredo'
      },
      exception: {
        values: [{ type: 'Error', value: 'Maria maria@example.com', stacktrace: { frames: [] } }]
      }
    });

    const serialized = JSON.stringify(event);
    expect(event.request).toBeUndefined();
    expect(event.user).toBeUndefined();
    expect(event.breadcrumbs).toBeUndefined();
    expect(event.contexts).toBeUndefined();
    expect(event.message).toBeUndefined();
    expect(event.tags).toEqual({ operation: 'appointment-repository:create', route: '/book/:tenant' });
    expect(event.extra).toEqual({ correlation_id: 'random-correlation' });
    expect(event.environment).toBe('preview');
    expect(event.release).toBe('preview-commit-sha');
    expect(serialized).not.toMatch(/Maria|maria@example|81999999999|Bearer|apikey|access_token|refresh_token|segredo|payload/);
  });

  it('adds safe metadata to automatic global errors', () => {
    const event = sanitizeSentryEvent({
      type: undefined,
      environment: 'preview',
      release: 'vercel-build-sha',
      exception: {
        values: [{ type: 'Error', value: 'global timer failure', stacktrace: { frames: [] } }]
      }
    });

    expect(event.environment).toBe('preview');
    expect(event.release).toBe('vercel-build-sha');
    expect(event.release).not.toBeNull();
    expect(event.extra?.correlation_id).toMatch(/^[0-9a-f-]{36}$|^error-/);
    expect(event.exception?.values?.[0]?.value).toBe('Unexpected application error');
    expect(event.request).toBeUndefined();
    expect(event.user).toBeUndefined();
  });

  it('uses a safe release fallback only when build SHA is unavailable', () => {
    initializeObservability({ dsn: 'https://public@example.invalid/1', environment: 'preview' });

    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({
      release: 'job-e-comissoes@unversioned'
    }));
  });

  it('does not report expected public booking outcomes', () => {
    initializeObservability({ dsn: 'https://public@example.invalid/1' });

    for (const code of [
      'PUBLIC_APPOINTMENT_SLOT_CONFLICT',
      'PUBLIC_APPOINTMENT_RATE_LIMITED',
      'PUBLIC_APPOINTMENT_ACTIVE_LIMIT',
      'PUBLIC_APPOINTMENT_INVALID_INPUT',
      'PUBLIC_APPOINTMENT_INACTIVE_SERVICE'
    ]) {
      expect(isExpectedOperationalError({ message: code })).toBe(true);
      expect(reportUnexpectedError('public-booking:submit', { message: code })).toBeUndefined();
    }

    for (const message of [
      'Aguarde um minuto antes de tentar agendar novamente com este WhatsApp.',
      'Este WhatsApp já possui três agendamentos futuros ativos nesta barbearia.',
      'Barbeiro indisponivel para agendamento.'
    ]) {
      expect(reportUnexpectedError('public-booking:submit', new Error(message))).toBeUndefined();
    }

    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('does not report controlled owner onboarding outcomes', () => {
    initializeObservability({ dsn: 'https://public@example.invalid/1' });

    for (const code of [
      'OWNER_ONBOARDING_AUTH_REQUIRED',
      'OWNER_ONBOARDING_PROFILE_NOT_FOUND',
      'OWNER_ONBOARDING_NOT_AUTHORIZED',
      'OWNER_ONBOARDING_ALREADY_CONFIGURED',
      'OWNER_ONBOARDING_SLUG_TAKEN',
      'OWNER_ONBOARDING_INVALID_INPUT'
    ]) {
      expect(isExpectedOperationalError({ message: code })).toBe(true);
      expect(reportUnexpectedError('owner:onboarding', { message: code })).toBeUndefined();
    }

    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('reports unexpected errors with a non-persistent correlation id', () => {
    initializeObservability({ dsn: 'https://public@example.invalid/1' });
    const correlationId = reportUnexpectedError('owner:load-catalog', { message: 'database unavailable', status: 503 });

    expect(correlationId).toMatch(/^[0-9a-f-]{36}$|^error-/);
    expect(sentry.withScope).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unexpected operational error' }));
  });

  it('does not break the application when the reporter fails', () => {
    initializeObservability({ dsn: 'https://public@example.invalid/1' });
    sentry.withScope.mockImplementationOnce(() => {
      throw new Error('reporter unavailable');
    });

    expect(() => reportUnexpectedError('dashboard:load', new Error('unexpected'))).not.toThrow();
  });

  it('keeps a friendly Error Boundary without exposing a stack', () => {
    const boundary = new AppErrorBoundary({ children: React.createElement('div', null, 'App') });
    boundary.state = { hasError: true };
    const html = renderToStaticMarkup(boundary.render());

    expect(html).toContain('Nao foi possivel carregar esta tela.');
    expect(html).not.toContain('Error:');
  });
});
