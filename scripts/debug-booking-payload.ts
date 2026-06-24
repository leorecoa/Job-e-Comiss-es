/*
  Debug helper for the public booking flow.

  Suggested usage without changing package.json once Playwright is installed in the environment:

    tsx scripts/debug-booking-payload.ts

  Optional env vars:

    BOOKING_URL=https://job-e-comiss-es.vercel.app/book/leo-do-leo
    BOOKING_NAME=Pedro Debug
    BOOKING_PHONE=81987324097
    BOOKING_NOTES=Teste de payload
    HEADED=1
*/

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

type RequestCapture = {
  url: string;
  method: string;
  postData: string | null;
  headers: Record<string, string>;
};

type ResponseCapture = {
  url: string;
  status: number;
  statusText: string;
  body: string | null;
};

type DebugResult = {
  bookingUrl: string;
  requests: RequestCapture[];
  responses: ResponseCapture[];
  consoleErrors: string[];
  pageErrors: string[];
  flowError: string | null;
};

type BrowserPage = {
  addInitScript: (script: () => void) => Promise<void>;
  close?: () => Promise<void>;
  goto: (url: string, options: { waitUntil: 'domcontentloaded'; timeout: number }) => Promise<void>;
  getByRole: (role: string, options: { name: RegExp }) => { click: () => Promise<void> };
  getByText: (text: RegExp) => { first: () => { isVisible: () => Promise<boolean> } };
  isClosed: () => boolean;
  locator: (selector: string) => {
    click: () => Promise<void>;
    count: () => Promise<number>;
    fill: (value: string) => Promise<void>;
    filter: (options: { has?: unknown; hasText?: RegExp | string }) => ReturnType<BrowserPage['locator']>;
    first: () => ReturnType<BrowserPage['locator']>;
    locator: (selector: string) => ReturnType<BrowserPage['locator']>;
    nth: (index: number) => ReturnType<BrowserPage['locator']>;
  };
  on: (event: string, listener: (...args: unknown[]) => void | Promise<void>) => void;
  screenshot: (options: { path: string; fullPage: boolean }) => Promise<void>;
  waitForTimeout: (timeout: number) => Promise<void>;
};

type BrowserInstance = {
  close: () => Promise<void>;
  newPage: (options: { viewport: { width: number; height: number } }) => Promise<BrowserPage>;
};

type PlaywrightModule = {
  chromium: {
    launch: (options: { headless: boolean }) => Promise<BrowserInstance>;
  };
};

const BOOKING_URL = process.env.BOOKING_URL || 'https://job-e-comiss-es.vercel.app/book/leo-do-leo';
const BOOKING_NAME = process.env.BOOKING_NAME || 'Pedro Debug';
const BOOKING_PHONE = process.env.BOOKING_PHONE || '81987324097';
const BOOKING_NOTES = process.env.BOOKING_NOTES || 'Teste de payload';
const HEADED = process.env.HEADED === '1';
const APPOINTMENTS_ENDPOINT = '/rest/v1/appointments';
const FAILURE_SCREENSHOT_PATH = 'test-results/debug-booking-payload.png';

const logSection = (title: string, value: unknown) => {
  console.log(`\n=== ${title} ===`);
  if (typeof value === 'string') {
    console.log(value);
    return;
  }

  console.dir(value, { depth: null, colors: true });
};

const sanitizeHeaderValue = (name: string, value: string): string => {
  const lowerName = name.toLowerCase();

  if (lowerName === 'apikey') {
    return value ? `${value.slice(0, 6)}...redacted` : 'redacted';
  }

  if (lowerName === 'authorization') {
    const [scheme = 'Bearer'] = value.split(/\s+/, 1);
    return `${scheme} ...redacted`;
  }

  return value;
};

const sanitizeHeaders = (headers: Record<string, string>): Record<string, string> => (
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name, sanitizeHeaderValue(name, value)])
  )
);

const loadPlaywright = async (): Promise<PlaywrightModule> => {
  try {
    return await Function('return import("playwright")')() as Promise<PlaywrightModule>;
  } catch (error) {
    throw new Error(
      `Playwright is not available in the current Node environment. Install it first or run this script where the package is available. Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const saveFailureScreenshot = async (page: BrowserPage | null) => {
  if (!page || page.isClosed()) return;

  mkdirSync(dirname(FAILURE_SCREENSHOT_PATH), { recursive: true });
  await page.screenshot({
    path: FAILURE_SCREENSHOT_PATH,
    fullPage: true
  });
};

const main = async () => {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: !HEADED });
  let page: BrowserPage | null = null;

  const requests: RequestCapture[] = [];
  const responses: ResponseCapture[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let flowError: string | null = null;

  try {
    page = await browser.newPage({
      viewport: { width: 1440, height: 1600 }
    });

    page.on('request', (requestLike) => {
      const request = requestLike as {
        headers: () => Record<string, string>;
        method: () => string;
        postData: () => string | null;
        url: () => string;
      };

      if (request.method() !== 'POST') return;
      if (!request.url().includes(APPOINTMENTS_ENDPOINT)) return;

      requests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
        headers: sanitizeHeaders(request.headers())
      });
    });

    page.on('response', async (responseLike) => {
      const response = responseLike as {
        status: () => number;
        statusText: () => string;
        text: () => Promise<string>;
        url: () => string;
      };

      if (!response.url().includes(APPOINTMENTS_ENDPOINT)) return;

      let body: string | null = null;

      try {
        body = await response.text();
      } catch (error) {
        body = `Failed to read response body: ${error instanceof Error ? error.message : String(error)}`;
      }

      responses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        body
      });
    });

    page.on('console', async (messageLike) => {
      const message = messageLike as {
        text: () => string;
        type: () => string;
      };

      if (message.type() !== 'error') return;
      consoleErrors.push(message.text());
    });

    page.on('pageerror', (errorLike) => {
      const error = errorLike as Error;
      pageErrors.push(error.message);
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    await page.goto(BOOKING_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(1800);

    const bookingUnavailable = page.getByText(/Selecione uma barbearia para agendar|Barbearia nao encontrada|Barbearia não encontrada/i);
    if (await bookingUnavailable.first().isVisible().catch(() => false)) {
      throw new Error(`Booking page did not resolve a tenant for ${BOOKING_URL}.`);
    }

    const barberSection = page.locator('form .space-y-3').filter({
      has: page.getByText(/Profissional/i)
    }).first();
    const barberButtons = barberSection.locator('button[type="button"]');

    if (await barberButtons.count() < 1) {
      throw new Error('No selectable barber button was found.');
    }

    await barberButtons.nth(0).click();

    const serviceSection = page.locator('form .space-y-3').filter({
      has: page.getByText(/Servico/i)
    }).first();
    const serviceButtons = serviceSection.locator('button[type="button"]');

    if (await serviceButtons.count() < 1) {
      throw new Error('No selectable service button was found.');
    }

    await serviceButtons.nth(0).click();

    const slotButtons = page.locator('form button[type="button"]').filter({
      hasText: /^\d{2}:\d{2}$/
    });

    if (await slotButtons.count() < 1) {
      throw new Error('No available booking slot was found.');
    }

    await slotButtons.nth(0).click();

    await page.locator('label').filter({ hasText: 'Seu nome' }).locator('xpath=..').locator('input').fill(BOOKING_NAME);
    await page.locator('label').filter({ hasText: 'WhatsApp' }).locator('xpath=..').locator('input').fill(BOOKING_PHONE);
    await page.locator('label').filter({ hasText: 'Observacoes' }).locator('xpath=..').locator('textarea').fill(BOOKING_NOTES);

    await page.getByRole('button', { name: /Reservar horario/i }).click();
    await page.waitForTimeout(15000);
  } catch (error) {
    flowError = error instanceof Error ? error.stack || error.message : String(error);
    await saveFailureScreenshot(page);
  }

  const result: DebugResult = {
    bookingUrl: BOOKING_URL,
    requests,
    responses,
    consoleErrors,
    pageErrors,
    flowError
  };

  logSection('BOOKING URL', result.bookingUrl);
  logSection('REQUESTS CAPTURED', result.requests);
  logSection('RESPONSES CAPTURED', result.responses);

  if (result.requests.length === 0) {
    logSection('POST CAPTURE STATUS', 'POST /appointments não capturado');
  }

  logSection('CONSOLE ERRORS', result.consoleErrors);
  logSection('PAGE ERRORS', result.pageErrors);

  if (result.flowError) {
    logSection('FLOW ERROR', result.flowError);
    logSection('FAILURE SCREENSHOT', FAILURE_SCREENSHOT_PATH);
  }

  await browser.close();
};

main().catch((error) => {
  console.error('\n=== DEBUG SCRIPT FAILED ===');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
