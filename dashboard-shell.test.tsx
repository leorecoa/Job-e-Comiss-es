import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Calendar, Users } from 'lucide-react';
import { DashboardShell } from './components/DashboardShell';

const items = [
  { id: 'appointments', label: 'Agenda', description: 'Operacao do dia', icon: <Calendar /> },
  { id: 'clients', label: 'Clientes', description: 'Historico', icon: <Users /> }
];

describe('owner dashboard shell', () => {
  it('exposes landmarks, tenant identity, active navigation and logout', () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        barbershopName="Barbearia com um nome operacional muito longo"
        userName="Owner"
        roleLabel="OWNER"
        activeItemId="appointments"
        items={items}
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      >
        <p>Conteudo preservado</p>
      </DashboardShell>
    );

    expect(html).toContain('<aside');
    expect(html).toContain('<nav');
    expect(html).toContain('<main');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Barbearia com um nome operacional muito longo');
    expect(html).toContain('Conteudo preservado');
    expect(html).toContain('Sair');
  });

  it('keeps the mobile navigation trigger labelled and collapsed initially', () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        barbershopName="Barbearia"
        userName="Owner"
        roleLabel="OWNER"
        activeItemId="clients"
        items={items}
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      >
        <p>Clientes</p>
      </DashboardShell>
    );

    expect(html).toContain('aria-label="Abrir navegacao"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Clientes');
  });
});
