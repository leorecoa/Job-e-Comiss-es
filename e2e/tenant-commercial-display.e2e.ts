import { expect, test } from 'playwright/test';
import { build } from 'vite';
import { readFileSync } from 'node:fs';

let bundle: string;
test.beforeAll(async () => {
  // Exercise the actual JSX composition from App, without its unrelated operational loaders.
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const slot = app.slice(app.indexOf('commercialStateContent={'), app.indexOf('publicPresence={', app.indexOf('commercialStateContent={')));
  const output = await build({ configFile: false, logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"' },
    build: { write: false, minify: false, lib: { entry: '/commercial-integration.tsx', name: 'CommercialIntegration', formats: ['iife'] } },
    plugins: [{ name: 'commercial-integration', enforce: 'pre', resolveId(id) {
      if (id.endsWith('commercial-integration.tsx')) return '/commercial-integration.tsx';
      if (id.includes('tenantCommercialRepository')) return '\0commercial-mock';
    },
      load(id) { if (id === '\0commercial-mock') return 'export const getTenantCommercialState=()=>new Promise((resolve,reject)=>window.requests.push({resolve,reject}));';
        if (id === '/commercial-integration.tsx') return `
        import React from 'react'; import {createRoot} from 'react-dom/client';
        import {SettingsWorkspace} from '/components/SettingsWorkspace.tsx';
        import {TenantCommercialStateCard} from '/components/TenantCommercialStateCard.tsx';
        window.requests=[]; const root=createRoot(document.getElementById('root'));
        window.renderWorkspace=({isSupabaseConfigured=true,shouldUseLocalFallback=false,isAuthLoading=false,
          authSession={role:'owner',userId:'owner',barbershopId:'tenant'},activeOwnerSection='management'}={})=>root.render(
          <SettingsWorkspace ${slot} publicPresence={<button onClick={()=>window.operationalClicks++}>Operational action</button>}
            readiness={<p>Readiness</p>} team={<p>Team</p>} catalog={<p>Catalog</p>}
            activeSection="#management-team" onNavigate={()=>{}} />);
        window.operationalClicks=0;
      `; } }] });
  bundle = (Array.isArray(output) ? output[0] : output as any).output[0].code;
});

test.describe('commercial App slot and workspace integration', () => {
  test('isolates commercial errors from operations and scopes requests to active remote owners', async ({ page }) => {
      await page.setContent('<div id="root"></div>');
      await page.addScriptTag({ content: bundle });
      await page.waitForFunction(() => Boolean((window as any).renderWorkspace));
      for (const props of [{ activeOwnerSection: 'schedule' }, { shouldUseLocalFallback: true },
        { isSupabaseConfigured: false }, { isAuthLoading: true },
        { authSession: { role: 'barber', userId: 'b', barbershopId: 't' } },
        { authSession: { role: 'owner', userId: 'o', barbershopId: '' } }]) {
        await page.evaluate(props => (window as any).renderWorkspace(props), props);
        await page.getByRole('button', { name: 'Operational action' }).waitFor();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        expect(await page.evaluate(() => (window as any).requests.length)).toBe(0);
      }
      await page.evaluate(() => (window as any).renderWorkspace());
      await page.waitForFunction(() => (window as any).requests.length === 1);
      await page.evaluate(() => (window as any).requests[0].reject(new Error('private SQL')));
      await page.getByText('Estado comercial indisponível', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Operational action' }).click();
      expect(await page.evaluate(() => (window as any).operationalClicks)).toBe(1);
      expect(await page.locator('body').innerText()).toContain('Catalog');
      expect(await page.locator('body').innerText()).not.toMatch(/private SQL|Não atribuído/);
      await page.getByRole('button', { name: 'Tentar novamente' }).click();
      await page.waitForFunction(() => (window as any).requests.length === 2);
      await page.evaluate(() => (window as any).renderWorkspace({ authSession: { role: 'owner', userId: 'new', barbershopId: 'new' } }));
      await page.waitForFunction(() => (window as any).requests.length === 3);
      await page.evaluate(() => (window as any).requests[1].resolve({ status: 'active', planCode: 'old', trialStartedAt: null, trialEndsAt: null, currentPeriodStart: null, currentPeriodEnd: null }));
      expect(await page.locator('body').innerText()).not.toContain('Código do plano: old');
  });
});
