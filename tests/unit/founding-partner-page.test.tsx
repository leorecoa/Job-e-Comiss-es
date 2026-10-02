import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FoundingPartnerPage } from '../../components/FoundingPartnerPage';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.doUnmock('../../commercialBootstrap'); vi.doUnmock('../../bootstrap'); });

describe('founding partner public page', () => {
  it('renders the institutional journey without a tenant, session or fake commercial destination', () => {
    const html = renderToStaticMarkup(<FoundingPartnerPage />);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain('Menos confusão na agenda.');
    expect(html).toContain('Parceiro Fundador');
    for (const id of ['produto', 'como-funciona', 'parceria', 'contato']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('href="#como-funciona"');
    expect(html).toContain('Quero conhecer');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('Canal comercial em preparação.');
    const contacts = [...html.matchAll(/<a[^>]+href="(https:[^"]+)"[^>]*>/g)];
    expect(contacts).toHaveLength(2);
    for (const [link, href] of contacts) {
      const url = new URL(href);
      expect(url.origin + url.pathname).toBe('https://wa.me/5581989064910');
      expect(url.searchParams.get('text')).toBe('Olá! Vi a apresentação do Job & Comissões e quero conhecer a proposta de Parceiro Fundador.');
      expect(link).toContain('target="_blank"');
      expect(link).toContain('rel="noopener noreferrer"');
    }
    expect(html).toContain('Composição ilustrativa do produto.');
    expect(html).not.toMatch(/href="(?:\/login|\/onboarding|\/book)|localStorage|Criar conta|Começar grátis/);
  });

  it.each(['/convite-parceiro', '/convite-parceiro/'])('selects only the commercial bootstrap at %s without operational initialization', async pathname => {
    vi.resetModules();
    const mount = vi.fn();
    const operationalImport = vi.fn(() => { throw new Error('Operational bootstrap must not load'); });
    vi.stubGlobal('window', { location: { pathname } });
    vi.doMock('../../commercialBootstrap', () => ({ mountCommercialPage: mount }));
    vi.doMock('../../bootstrap', operationalImport);
    await import('../../index');
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce());
    expect(operationalImport).not.toHaveBeenCalled();
  });
});
