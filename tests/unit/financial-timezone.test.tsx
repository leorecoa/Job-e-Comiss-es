import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isValidFinancialTimezone, requireFinancialTimezone, suggestFinancialTimezone } from '../../utils/financialTimezone';
import { getOwnerBarbershopOnboardingPayload } from '../../components/OwnerBarbershopOnboarding';
import { FinancialTimezoneSettings } from '../../components/FinancialTimezoneSettings';
import { addCalendarDays, calendarDaySequence, financialDateKey, financialMonthKey, financialYear, financialPreset, formatFinancialTime, inFinancialRange, resolveFinancialTimezone } from '../../utils/financialTimezone';

describe('financial calendar', () => {
  it.each(['America/Recife', 'America/Sao_Paulo'])('classifies day/month/year in %s', zone => {
    const month = Date.parse('2026-10-01T02:30:00Z');
    expect(financialDateKey(month, zone)).toBe('2026-09-30');
    expect(financialMonthKey(month, zone)).toBe('2026-09');
    expect(financialYear(Date.parse('2027-01-01T02:30:00Z'), zone)).toBe('2026');
    expect(financialPreset('month', zone, month)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(financialPreset('yesterday', zone, month)).toEqual({ start: '2026-09-29', end: '2026-09-29' });
    expect(financialPreset('week', zone, month)).toEqual({ start: '2026-09-24', end: '2026-09-30' });
  });
  it('handles both DST transitions without losing repeated-hour records', () => {
    const zone = 'America/New_York';
    expect(formatFinancialTime(Date.parse('2026-03-08T06:30Z'), zone)).toBe('01:30');
    expect(formatFinancialTime(Date.parse('2026-03-08T07:30Z'), zone)).toBe('03:30');
    const repeated = ['2026-11-01T05:30Z', '2026-11-01T06:30Z'].map(Date.parse);
    expect(repeated.map(t => formatFinancialTime(t, zone))).toEqual(['01:30', '01:30']);
    expect(repeated.filter(t => inFinancialRange(t, '2026-11-01', '2026-11-01', zone))).toHaveLength(2);
    expect(calendarDaySequence('2026-03-07', '2026-03-09')).toEqual(['2026-03-07', '2026-03-08', '2026-03-09']);
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addCalendarDays('2024-02-28', 1)).toBe('2024-02-29');
  });
  it.each([null, undefined, 'Not/AZone'])('explicitly retains browser fallback for %s', zone => {
    const timestamp = Date.parse('2026-10-01T02:30:00Z');
    const date = new Date(timestamp);
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    expect(resolveFinancialTimezone(zone)).toBeUndefined();
    expect(financialDateKey(timestamp, zone)).toBe(expected);
  });
  it('rejects invalid calendar inputs and excludes invalid instants', () => {
    expect(() => addCalendarDays('2026-02-30', 1)).toThrow();
    expect(inFinancialRange(NaN, '2026-01-01', '2026-12-31', 'America/Recife')).toBe(false);
  });
});

describe('financial timezone confirmation', () => {
  it.each(['America/Recife', 'America/Sao_Paulo', 'America/New_York', 'UTC'])('accepts %s', value => {
    expect(isValidFinancialTimezone(value)).toBe(true);
  });
  it.each(['', 'Not/AZone', '+03:00', 'UTC-3', ' America/Recife', 'posix/America/Recife'])('rejects %s', value => {
    expect(() => requireFinancialTimezone(value)).toThrow('Informe uma timezone IANA válida.');
  });
  it('does not include the browser suggestion without explicit confirmation', () => {
    const form = { name: 'Shop', slug: 'shop', phone: '', address: '', whatsapp: '', description: '', financialTimezone: suggestFinancialTimezone() };
    expect(getOwnerBarbershopOnboardingPayload(form)).not.toHaveProperty('financialTimezone');
    expect(getOwnerBarbershopOnboardingPayload({ ...form, financialTimezone: 'America/New_York', confirmFinancialTimezone: true }))
      .toHaveProperty('financialTimezone', 'America/New_York');
    expect(() => getOwnerBarbershopOnboardingPayload({ ...form, financialTimezone: 'invalid', confirmFinancialTimezone: true })).toThrow();
  });
  it.each([null, 'America/New_York'])('renders configuration %s without writing or replacing it', financialTimezone => {
    const onSave = vi.fn();
    const html = renderToStaticMarkup(<FinancialTimezoneSettings
      barbershop={{ id: 'shop-1', name: 'Shop', slug: 'shop', active: true, financialTimezone }} onSave={onSave} />);
    expect(onSave).not.toHaveBeenCalled();
    expect(html).toContain(financialTimezone ? 'Timezone atual: America/New_York' : 'Timezone financeira não configurada');
    if (financialTimezone) expect(html).toContain('value="America/New_York"');
  });
});
