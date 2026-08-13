import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SettingsWorkspace } from './components/SettingsWorkspace';

describe('owner settings workspace', () => {
  it('groups existing administrative content under labelled navigation', () => {
    const html = renderToStaticMarkup(
      <SettingsWorkspace
        publicPresence={<section><h2>Configuracoes da barbearia</h2></section>}
        readiness={<section><h2>Prontidao operacional</h2></section>}
        team={<section><h2>Equipe</h2></section>}
        catalog={<section><h2>Catalogo operacional</h2></section>}
      />
    );

    expect(html).toContain('Gestao da barbearia');
    expect(html).toContain('aria-label="Grupos da gestao"');
    expect(html).toContain('href="#management-public-presence"');
    expect(html).toContain('href="#management-team"');
    expect(html).toContain('Configuracoes da barbearia');
    expect(html).toContain('Catalogo operacional');
  });
});
