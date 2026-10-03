import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { build } from 'vite';

let bundle: string, browser: Browser, page: Page;
const row = { status: 'unassigned', planCode: null, trialStartedAt: null, trialEndsAt: null, currentPeriodStart: null, currentPeriodEnd: null };
const render = (props = { active: true, userId: 'owner', barbershopId: 'tenant' }) => page.evaluate(props => (window as any).renderCard(props), props);
const settle = (index: number, data: unknown = row, reject = false) => page.evaluate(({ index, data, reject }) => {
  (window as any).requests[index][reject ? 'reject' : 'resolve'](data);
}, { index, data, reject });
const has = (text: string) => page.getByText(text, { exact: false }).waitFor();

beforeAll(async () => {
  const output = await build({ configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': '"development"' },
    build: { write: false, minify: false, lib: { entry: '/commercial-harness.js', name: 'CommercialTest', formats: ['iife'] } },
    plugins: [{ name: 'commercial-test-entry', enforce: 'pre', resolveId(id) {
      if (id.endsWith('commercial-harness.js')) return '/commercial-harness.js';
      if (id.includes('tenantCommercialRepository')) return '\0commercial-mock';
    },
      load(id) { if (id === '\0commercial-mock') return 'export const getTenantCommercialState=()=>new Promise((resolve,reject)=>window.requests.push({resolve,reject}));';
        if (id === '/commercial-harness.js') return `
        import React from 'react'; import {createRoot} from 'react-dom/client';
        import {TenantCommercialStateCard} from '/components/TenantCommercialStateCard.tsx';
        window.requests=[]; const root=createRoot(document.getElementById('root'));
        window.renderCard=p=>root.render(React.createElement(React.StrictMode,null,React.createElement(TenantCommercialStateCard,p)));
        window.unmount=()=>root.unmount();
      `; } }] });
  bundle = (Array.isArray(output) ? output[0] : output as any).output[0].code;
  browser = await chromium.launch({ headless: true });
}, 30000);
afterAll(async () => { await browser?.close(); });
beforeEach(async () => {
  await page?.close(); page = await browser.newPage();
  await page.setContent('<div id="root"></div>');
  await page.evaluate(() => {
    for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, {
      get() { throw new Error('Commercial card must not access storage'); }
    });
  });
  await page.addScriptTag({ content: bundle });
  await page.waitForFunction(() => Boolean((window as any).renderCard));
});

async function start() {
  await render();
  await page.waitForFunction(() => (window as any).requests.length === 2);
  await has('Carregando estado comercial');
}

describe('commercial card with real React lifecycle', () => {
  it.each([{ active: false, userId: 'o', barbershopId: 't' }, { active: true, userId: '', barbershopId: 't' }, { active: true, userId: 'o', barbershopId: '' }])('does not query inactive/incomplete context %j', async props => {
    await render(props);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => (window as any).requests.length)).toBe(0);
  });
  it.each([
    ['unassigned','Não atribuído'], ['pending','Pendente'], ['trialing','Em período de teste'],
    ['active','Ativo'], ['paused','Pausado'], ['canceled','Cancelado']
  ])('renders literal %s', async (status, label) => {
    await start(); await settle(1, { ...row, status }); await has(label);
    expect(await page.locator('body').innerText()).not.toContain('Código do plano');
    expect(await page.locator('body').innerText()).not.toContain('Início do período');
    if (status === 'unassigned') await has('Nenhuma assinatura comercial atribuída.');
  });
  it('preserves plan, past trial status and UTC dates; invalid dates stay local', async () => {
    await start(); await settle(1, { ...row, status: 'trialing', planCode: 'literal_code',
      trialStartedAt: '2000-01-01T23:30:00-03:00', trialEndsAt: 'invalid',
      currentPeriodStart: '2000-02-01T00:00:00Z', currentPeriodEnd: '2000-03-01T00:00:00Z' });
    await has('Código do plano: literal_code'); await has('02/01/2000, 02:30 UTC');
    await has('Fim do período de teste: Data indisponível'); await has('Em período de teste');
  });
  it.each(['2030-02-30T10:00:00Z', '2030-10-01T10:00:00'])('does not invent a date for %s', async value => {
    await start(); await settle(1, { ...row, status: 'active', trialStartedAt: value });
    await has('Início do período de teste: Data indisponível'); await has('Ativo');
  });
  it('isolates error and retries; StrictMode stale rejection cannot overwrite success', async () => {
    await start(); expect(await page.getByRole('button').isDisabled()).toBe(true);
    await settle(1, 'private SQL', true); await has('Estado comercial indisponível');
    expect(await page.locator('body').innerText()).not.toMatch(/private SQL|Não atribuído/);
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await page.waitForFunction(() => (window as any).requests.length === 3);
    expect(await page.getByRole('button').isDisabled()).toBe(true);
    await settle(2, { ...row, status: 'active' }); await has('Ativo');
    await settle(0, 'late error', true); await has('Ativo');
    expect(await page.locator('body').innerText()).not.toContain('indisponível');
  });
  it('discards old tenant data and pending results on context change', async () => {
    await start(); await settle(1, { ...row, planCode: 'old plan', status: 'active' }); await has('old plan');
    await render({ active: true, userId: 'other', barbershopId: 'other' });
    await page.waitForFunction(() => (window as any).requests.length === 4);
    expect(await page.locator('body').innerText()).not.toContain('old plan');
    await settle(3, { ...row, planCode: 'new plan', status: 'paused' }); await has('new plan');
    await settle(0, { ...row, planCode: 'stale' });
    expect(await page.locator('body').innerText()).not.toContain('stale');
  });
  it('discards success after deactivation and rejection after unmount', async () => {
    await start(); await render({ active: false, userId: 'owner', barbershopId: 'tenant' });
    await page.getByRole('heading', { name: 'Estado comercial' }).waitFor({ state: 'detached' });
    await settle(1); expect(await page.locator('#root').innerText()).toBe('');
    await render(); await page.waitForFunction(() => (window as any).requests.length === 4);
    await page.evaluate(() => (window as any).unmount()); await settle(3, 'late', true);
    expect(await page.locator('#root').innerText()).toBe('');
  });
});
