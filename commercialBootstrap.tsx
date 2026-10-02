import React from 'react';
import { createRoot } from 'react-dom/client';
import { FoundingPartnerPage } from './components/FoundingPartnerPage';
import './styles.css';
import './components/FoundingPartnerPage.css';

export function mountCommercialPage() {
  document.title = 'Job & Comissões | Parceiro Fundador';
  const description = 'Gestão de agenda, equipe, serviços e comissões para barbearias.';
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1.0');
  const root = document.getElementById('root');
  if (!root) throw new Error('Application root unavailable');
  createRoot(root).render(<React.StrictMode><FoundingPartnerPage /></React.StrictMode>);
  document.getElementById('splash-screen')?.remove();
}
