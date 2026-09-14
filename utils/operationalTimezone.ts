export const OPERATIONAL_TIMEZONE_ERROR = 'Informe uma timezone operacional IANA válida.';

export const isValidOperationalTimezone = (value: string): boolean => {
  if (!value || value !== value.trim() || /^(posix|right)\//.test(value) || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
};

export const suggestOperationalTimezone = (): string => {
  try {
    const value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidOperationalTimezone(value) ? value : '';
  } catch {
    return '';
  }
};

export const requireOperationalTimezone = (value: string): string => {
  if (!isValidOperationalTimezone(value)) throw new Error(OPERATIONAL_TIMEZONE_ERROR);
  return value;
};
