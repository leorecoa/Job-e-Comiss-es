import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('owner workspace contrast regression', () => {
  it('keeps all administrative surfaces off legacy dark presentation classes', () => {
    const administrativeFiles = [
      '../../App.tsx',
      '../../components/AddClientModal.tsx',
      '../../components/AddValeModal.tsx',
      '../../components/AppointmentModal.tsx',
      '../../components/BarberDashboard.tsx',
      '../../components/DashboardCharts.tsx',
      '../../components/MonthlySummary.tsx',
      '../../components/OwnerBarberProfileLinking.tsx',
      '../../components/OwnerCatalogManager.tsx',
      '../../components/OwnerSetupChecklist.tsx',
      '../../components/ReportModal.tsx',
      '../../components/SettingsModal.tsx',
      '../../components/TourOverlay.tsx'
    ];
    const legacyPresentation = /glass-card|(?:bg|text|border)-(?:gray|slate)-(?:[0-9]{2,3})|bg-black\//;

    for (const path of administrativeFiles) {
      expect(readSource(path), path).not.toMatch(legacyPresentation);
    }
  });

  it('keeps owner branding fields and uploads off legacy dark utility classes', () => {
    const source = readSource('../../components/BarbershopBrandingSettings.tsx');

    expect(source).toContain('ui-branding-settings');
    expect(source).toContain('ui-branding-upload');
    expect(source).toContain('ui-branding-hours');
    expect(source).toContain('ui-branding-preview');
    expect(source).not.toContain('glass-card rounded-2xl p-5');
    expect(source).not.toContain('w-full bg-gray-900 border border-gray-700');
    expect(source).not.toContain('border border-gray-700 bg-gray-900/70');
  });

  it('uses semantic light controls for the owner agenda filters', () => {
    const source = readSource('../../App.tsx');

    expect(source).toContain('ui-owner-date-control');
    expect(source).toContain('ui-owner-date-input');
    expect(source).toContain('ui-owner-filter');
    expect(source).not.toContain('bg-transparent border-none text-white text-sm text-center');
    expect(source).not.toContain('bg-gray-900 border border-gray-700 text-white text-sm rounded-xl pl-9');
  });

  it('defines tokenized focus, autofill, placeholder and disabled states', () => {
    const css = readSource('../../styles.css');

    expect(css).toContain('.ui-input:-webkit-autofill');
    expect(css).toContain('-webkit-text-fill-color: var(--color-foreground)');
    expect(css).toContain('.ui-branding-file:disabled');
    expect(css).toContain('.ui-owner-filter:focus-visible');
    expect(css).toContain('.ui-input::placeholder');
    expect(css).toContain('.ui-button:disabled');
    expect(css).toContain('background: var(--color-disabled) !important');
  });

  it('limits intentional dark identity to named public preview surfaces', () => {
    const booking = readSource('../../components/PublicBookingPage.tsx');
    const branding = readSource('../../components/BarbershopBrandingSettings.tsx');

    expect(booking).toContain('ui-public-hero');
    expect(booking).not.toContain('glass-card');
    expect(branding).toContain('ui-branding-preview');
  });
});
