import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SettingsWorkspace } from '../../components/SettingsWorkspace';

describe('owner settings workspace', () => {
  it('composes optional commercial content outside operational readiness', () => {
    const props = { publicPresence: 'Presence', readiness: 'Readiness', team: 'Team', catalog: 'Catalog',
      activeSection: '#management-team' as const, onNavigate: () => undefined };
    const without = renderToStaticMarkup(<SettingsWorkspace {...props} />);
    const withCard = renderToStaticMarkup(<SettingsWorkspace {...props} commercialStateContent={<section>Commercial</section>} />);
    expect(without).not.toContain('Commercial');
    expect(withCard).toContain('<section>Commercial</section>');
    expect(withCard).toContain('tabindex="-1">Readiness</div>');
    expect(withCard.replace('<div class="ui-settings-group"><section>Commercial</section></div>', '')).toBe(without);
  });
  it('groups existing administrative content under labelled navigation', () => {
    const html = renderToStaticMarkup(
      <SettingsWorkspace
        publicPresence={<section><h2>Configurações da barbearia</h2></section>}
        readiness={<section><h2>Prontidão operacional</h2></section>}
        team={<section><h2>Equipe</h2></section>}
        catalog={<section><h2>Catálogo operacional</h2></section>}
        activeSection="#management-team"
        onNavigate={() => undefined}
      />
    );

    expect(html).toContain('Gestão da barbearia');
    expect(html).toContain('aria-label="Grupos da gestão"');
    expect(html).toContain('href="#management-public-presence"');
    expect(html).toContain('href="#management-team"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Configurações da barbearia');
    expect(html).toContain('Catálogo operacional');
    expect(html).not.toMatch(/Gestao|Configuracoes|Prontidao|Catalogo/);
  });
});
