import * as Sentry from '@sentry/react';
import type { ErrorEvent, EventHint } from '@sentry/react';

type MonitoringConfig = {
  dsn?: string;
  environment?: string;
  release?: string;
};

type ErrorLike = {
  code?: unknown;
  status?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

const PUBLIC_CODE_PATTERN = /(PUBLIC_APPOINTMENT_[A-Z_]+|FINANCIAL_COMPLETION_[A-Z_]+|APPOINTMENT_ACTIVE_SLOT_CONFLICT)/;
const SENSITIVE_TEXT_PATTERN = /(bearer\s+[a-z0-9._~+/=-]+|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b(?:\+?\d[\s().-]*){8,}\b|(?:access_token|refresh_token|authorization|apikey|client_name|client_phone|telefone|e-?mail|notes?)\s*[:=]\s*[^\s,;]+)/gi;
const FALLBACK_RELEASE = 'job-e-comissoes@unversioned';

let initialized = false;

const getMonitoringConfig = (): MonitoringConfig => ({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_APP_ENVIRONMENT || import.meta.env.VITE_VERCEL_ENV || import.meta.env.MODE,
  release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA
});

const sanitizeText = (value: string): string => value.replace(SENSITIVE_TEXT_PATTERN, '[redacted]');

const sanitizeRoute = (): string => {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
    .replace(/\/book\/[^/]+/i, '/book/:tenant');
};

export const sanitizeSentryEvent = (event: ErrorEvent, _hint?: EventHint): ErrorEvent => {
  const exception = event.exception?.values?.map((value) => ({
    ...value,
    value: 'Unexpected application error'
  }));
  const allowedTagNames = new Set(['operation', 'public_code', 'http_status', 'route']);
  const tags = Object.fromEntries(
    Object.entries(event.tags || {})
      .filter(([key]) => allowedTagNames.has(key))
      .map(([key, value]) => [key, sanitizeText(String(value))])
  );
  const correlationId = typeof event.extra?.correlation_id === 'string'
    ? event.extra.correlation_id
    : createCorrelationId();

  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: event.environment,
    release: event.release || FALLBACK_RELEASE,
    exception: exception ? { values: exception } : undefined,
    tags,
    extra: { correlation_id: correlationId }
  };
};

export const initializeObservability = (config: MonitoringConfig = getMonitoringConfig()): boolean => {
  if (initialized || !config.dsn?.trim()) return false;

  try {
    Sentry.init({
      dsn: config.dsn.trim(),
      environment: config.environment || 'unknown',
      release: config.release?.trim() || FALLBACK_RELEASE,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: sanitizeSentryEvent
    });
    initialized = true;
    return true;
  } catch {
    return false;
  }
};

const getPublicCode = (error: unknown): string | undefined => {
  const errorLike = error as ErrorLike;
  const searchable = [errorLike?.code, errorLike?.message, errorLike?.details, errorLike?.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  return searchable.match(PUBLIC_CODE_PATTERN)?.[1];
};

export const isExpectedOperationalError = (error: unknown): boolean => {
  const code = getPublicCode(error);
  if (code?.startsWith('PUBLIC_APPOINTMENT_') || code === 'APPOINTMENT_ACTIVE_SLOT_CONFLICT') return true;

  const message = String((error as ErrorLike)?.message || '').toLowerCase();
  return [
    'selecione um',
    'informe seu',
    'confira os dados obrigatorios',
    'indisponivel para agendamento',
    'horario invalido',
    'acabou de ser reservado',
    'aguarde um minuto antes de tentar agendar novamente',
    'agendamentos futuros ativos nesta barbearia',
    'barbearia nao encontrada ou indisponivel',
    'barbeiro invalido para esta barbearia',
    'servico invalido para esta barbearia',
    'whatsapp deve ter'
  ].some((expected) => message.includes(expected));
};

const createCorrelationId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `error-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

export const reportUnexpectedError = (operation: string, error: unknown): string | undefined => {
  if (!initialized || isExpectedOperationalError(error)) return undefined;

  const correlationId = createCorrelationId();
  const errorLike = error as ErrorLike;
  const publicCode = getPublicCode(error);
  const status = typeof errorLike?.status === 'number' ? String(errorLike.status) : undefined;

  try {
    Sentry.withScope((scope) => {
      scope.setTag('operation', operation);
      scope.setTag('route', sanitizeRoute());
      if (publicCode) scope.setTag('public_code', publicCode);
      if (status) scope.setTag('http_status', status);
      scope.setExtra('correlation_id', correlationId);
      Sentry.captureException(new Error('Unexpected operational error'));
    });
    return correlationId;
  } catch {
    return undefined;
  }
};

export const resetObservabilityForTests = (): void => {
  initialized = false;
};
