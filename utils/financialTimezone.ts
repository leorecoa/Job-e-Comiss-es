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

// Legacy/null (and unsupported values) explicitly retain the browser calendar.
// This resolution never persists a suggestion or substitutes an arbitrary zone.
export const resolveFinancialTimezone = (value?: string | null): string | undefined =>
  value && isValidFinancialTimezone(value) ? value : undefined;

const financialFormatters = new Map<string, Intl.DateTimeFormat>();
const financialFormatter = (timezone: string | null | undefined, options: Intl.DateTimeFormatOptions) => {
  const key = JSON.stringify([timezone, options]);
  if (timezone && financialFormatters.has(key)) return financialFormatters.get(key)!;
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    calendar: 'gregory', numberingSystem: 'latn',
    timeZone: resolveFinancialTimezone(timezone), ...options
  });
  // Reuse configured-zone formatters in chart loops; keep browser fallback dynamic.
  if (timezone && isValidFinancialTimezone(timezone)) {
    if (financialFormatters.size >= 32) financialFormatters.clear();
    financialFormatters.set(key, formatter);
  }
  return formatter;
};

export const financialDateKey = (timestamp: number, timezone?: string | null): string => {
  if (!Number.isFinite(new Date(timestamp).getTime())) return '';
  const parts = financialFormatter(timezone, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(timestamp);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
export const financialMonthKey = (timestamp: number, timezone?: string | null): string => financialDateKey(timestamp, timezone).slice(0, 7);
export const financialYear = (timestamp: number, timezone?: string | null): string => financialDateKey(timestamp, timezone).slice(0, 4);
export const financialToday = (timezone?: string | null, now = Date.now()): string => financialDateKey(now, timezone);
export const formatFinancialDate = (timestamp: number, timezone?: string | null): string =>
  financialFormatter(timezone, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp);
export const formatFinancialTime = (timestamp: number, timezone?: string | null): string =>
  financialFormatter(timezone, { hour: '2-digit', minute: '2-digit' }).format(timestamp);

const calendarDate = (key: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Data financeira inválida.');
  const date = new Date(`${key}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) throw new Error('Data financeira inválida.');
  return date;
};
// UTC is only a carrier for date-only calendar arithmetic, not the tenant zone.
export const addCalendarDays = (key: string, days: number): string => {
  const date = calendarDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export const calendarDaySequence = (start: string, end: string): string[] => {
  calendarDate(start); calendarDate(end);
  const keys: string[] = [];
  for (let key = start; key <= end; key = addCalendarDays(key, 1)) keys.push(key);
  return keys;
};
export const inFinancialRange = (timestamp: number, start: string, end: string, timezone?: string | null): boolean => {
  calendarDate(start); calendarDate(end);
  const key = financialDateKey(timestamp, timezone);
  return key !== '' && key >= start && key <= end;
};
export const formatCalendarDate = (key: string, options?: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat('pt-BR', { calendar: 'gregory', numberingSystem: 'latn', ...options, timeZone: 'UTC' }).format(calendarDate(key));

export const financialPreset = (preset: 'today' | 'yesterday' | 'week' | 'month', timezone?: string | null, now = Date.now()) => {
  const today = financialToday(timezone, now);
  const end = preset === 'yesterday' ? addCalendarDays(today, -1) : today;
  const start = preset === 'week' ? addCalendarDays(today, -6) : preset === 'month' ? `${today.slice(0, 7)}-01` : end;
  return { start, end };
};
