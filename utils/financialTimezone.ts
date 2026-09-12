export const FINANCIAL_TIMEZONE_ERROR = 'Informe uma timezone IANA válida.';

export const isValidFinancialTimezone = (value: string): boolean => {
  if (!value || value !== value.trim() || /^(posix|right)\//.test(value) || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
};

export const suggestFinancialTimezone = (): string => {
  try {
    const suggestion = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidFinancialTimezone(suggestion) ? suggestion : '';
  } catch {
    return '';
  }
};

export const requireFinancialTimezone = (value: string): string => {
  if (!isValidFinancialTimezone(value)) throw new Error(FINANCIAL_TIMEZONE_ERROR);
  return value;
};
