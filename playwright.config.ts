import { defineConfig } from 'playwright/test';

const PORT = 4173;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: `npm run dev -- --host ${HOST} --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      VITE_SUPABASE_URL: 'https://e2e.supabase.test',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key'
    }
  }
});
