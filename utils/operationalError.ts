export type OperationalErrorMetadata = {
  publicCode?: string;
  providerCode?: string;
  httpStatus?: number;
};

export class OperationalError extends Error {
  readonly publicCode?: string;
  readonly providerCode?: string;
  readonly httpStatus?: number;

  constructor(message: string, metadata: OperationalErrorMetadata = {}) {
    super(message);
    this.name = 'OperationalError';
    this.publicCode = metadata.publicCode;
    this.providerCode = sanitizeTechnicalCode(metadata.providerCode);
    this.httpStatus = Number.isInteger(metadata.httpStatus) && metadata.httpStatus! >= 100 && metadata.httpStatus! <= 599
      ? metadata.httpStatus
      : undefined;
  }
}

export const sanitizeTechnicalCode = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return /^[A-Z0-9_.-]{1,64}$/i.test(normalized) ? normalized : undefined;
};
