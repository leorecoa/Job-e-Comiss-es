import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isValidOperationalTimezone, requireOperationalTimezone, suggestOperationalTimezone } from '../../utils/operationalTimezone';
import { getOwnerBarbershopOnboardingPayload } from '../../components/OwnerBarbershopOnboarding';
import { OperationalTimezoneSettings } from '../../components/OperationalTimezoneSettings';

describe('operational timezone confirmation', () => {
  it.each(['America/Recife', 'America/Sao_Paulo', 'America/New_York', 'UTC'])('accepts %s', value => {
    expect(isValidOperationalTimezone(value)).toBe(true);
  });
  it.each(['', 'Not/AZone', '+03:00', 'UTC-3', ' America/Recife', 'posix/America/Recife'])('rejects %s', value => {
    expect(() => requireOperationalTimezone(value)).toThrow();
  });
  it('sends only explicitly confirmed operational timezone independently of financial timezone', () => {
    const form = { name: 'Shop', slug: 'shop', phone: '', address: '', whatsapp: '', description: '',
      operationalTimezone: suggestOperationalTimezone(), financialTimezone: 'America/Recife', confirmFinancialTimezone: true };
    expect(getOwnerBarbershopOnboardingPayload(form)).not.toHaveProperty('operationalTimezone');
    expect(getOwnerBarbershopOnboardingPayload({ ...form, operationalTimezone: 'America/New_York', confirmOperationalTimezone: true }))
      .toMatchObject({ operationalTimezone: 'America/New_York', financialTimezone: 'America/Recife' });
    expect(() => getOwnerBarbershopOnboardingPayload({ ...form, operationalTimezone: 'invalid', confirmOperationalTimezone: true })).toThrow();
  });
  it.each([null, 'America/New_York'])('renders saved state %s without writing or copying financial timezone', operationalTimezone => {
    const onSave = vi.fn();
    const html = renderToStaticMarkup(<OperationalTimezoneSettings
      barbershop={{ id: 'shop-1', name: 'Shop', slug: 'shop', active: true, operationalTimezone, financialTimezone: 'America/Recife' }} onSave={onSave} />);
    expect(onSave).not.toHaveBeenCalled();
    expect(html).toContain(operationalTimezone ? 'Timezone operacional atual: America/New_York' : 'Não configurado');
    if (operationalTimezone) expect(html).toContain('value="America/New_York"');
    expect(html).toContain('não altera booking, agenda ou períodos financeiros');
  });
});
