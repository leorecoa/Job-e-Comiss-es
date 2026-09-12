import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isValidFinancialTimezone, requireFinancialTimezone, suggestFinancialTimezone } from '../../utils/financialTimezone';
import { getOwnerBarbershopOnboardingPayload } from '../../components/OwnerBarbershopOnboarding';
import { FinancialTimezoneSettings } from '../../components/FinancialTimezoneSettings';

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
