import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OwnerCatalogManager } from '../../components/OwnerCatalogManager';
import { SettingsModal } from '../../components/SettingsModal';
import { DEFAULT_SETTINGS, type UserProfile } from '../../types';

const userProfile: UserProfile = {
  ownerName: 'Owner',
  shopName: 'Barbearia',
  email: 'owner@example.com',
  startDate: 0,
  isPro: true,
  planType: 'pro_monthly'
};

const renderSettings = (manageCatalogRemotely: boolean) => renderToStaticMarkup(
  <SettingsModal
    isOpen
    onClose={vi.fn()}
    settings={DEFAULT_SETTINGS}
    onSave={vi.fn()}
    userProfile={userProfile}
    clients={[]}
    vales={[]}
    appointments={[]}
    manageCatalogRemotely={manageCatalogRemotely}
  />
);

const legacyCatalogFields = [
  'priceCut',
  'priceBeard',
  'priceCombo',
  'priceProduct',
  'commissionRate'
];

describe('settings catalog source of truth', () => {
  it('hides legacy catalog fields when services are managed remotely', () => {
    const html = renderSettings(true);

    for (const field of legacyCatalogFields) {
      expect(html).not.toContain(`name="${field}"`);
    }
    expect(html).toContain('O catalogo operacional da sua barbearia agora e gerenciado direto no painel principal.');
  });

  it('keeps legacy catalog fields available in local fallback mode', () => {
    const html = renderSettings(false);

    for (const field of legacyCatalogFields) {
      expect(html).toContain(`name="${field}"`);
    }
  });

  it('keeps remote service price, duration and commission controls in OwnerCatalogManager', () => {
    const html = renderToStaticMarkup(
      <OwnerCatalogManager
        barbers={[]}
        services={[{
          id: 'service-1',
          name: 'Corte',
          price: 50,
          durationMinutes: 30,
          commissionRate: 40,
          active: true
        }]}
        onCreateBarber={vi.fn()}
        onUpdateBarber={vi.fn()}
        onRemoveBarber={vi.fn()}
        onCreateService={vi.fn()}
        onUpdateService={vi.fn()}
        onRemoveService={vi.fn()}
      />
    );

    expect(html).toMatch(
      /value="Corte"[\s\S]*value="50"[\s\S]*value="30"[\s\S]*value="40"/
    );
  });
});
