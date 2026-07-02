type ErrorLike = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  status?: unknown;
  details?: unknown;
  hint?: unknown;
};

const SENSITIVE_KEY_PATTERN = /(token|password|authorization|apikey|api_key|refresh|session|secret|cookie|headers)/i;

export const sanitizeOperationalError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    const errorWithFields = error as ErrorLike;

    return {
      name: error.name,
      message: error.message,
      code: errorWithFields.code,
      status: errorWithFields.status,
      details: errorWithFields.details,
      hint: errorWithFields.hint
    };
  }

  if (typeof error === 'object' && error !== null) {
    return Object.fromEntries(
      Object.entries(error as Record<string, unknown>)
        .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
        .map(([key, value]) => [
          key,
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? value
            : '[redacted]'
        ])
    );
  }

  return {
    message: String(error || 'Unknown error')
  };
};

export const logOperationalError = (context: string, error: unknown): void => {
  console.error(`[${context}]`, sanitizeOperationalError(error));
};

export const getOperationalErrorMessage = (
  error: unknown,
  fallbackMessage: string,
  options: {
    authExpiredMessage?: string;
    networkMessage?: string;
  } = {}
): string => {
  const errorLike = error as ErrorLike;
  const message = error instanceof Error
    ? error.message
    : typeof errorLike?.message === 'string'
      ? errorLike.message
      : '';
  const status = typeof errorLike?.status === 'number' ? errorLike.status : undefined;
  const code = typeof errorLike?.code === 'string' ? errorLike.code : '';
  const normalized = `${message} ${code}`.toLowerCase();

  if (
    options.authExpiredMessage
    && (
      status === 401
      || normalized.includes('jwt')
      || normalized.includes('session')
      || normalized.includes('refresh token')
      || normalized.includes('auth session')
    )
  ) {
    return options.authExpiredMessage;
  }

  if (
    options.networkMessage
    && (
      normalized.includes('failed to fetch')
      || normalized.includes('network')
      || normalized.includes('fetch')
      || normalized.includes('timeout')
    )
  ) {
    return options.networkMessage;
  }

  return fallbackMessage;
};
