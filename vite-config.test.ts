import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigEnv, UserConfig } from 'vite';
import viteConfig from './vite.config';

describe('Vercel build metadata', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('injects VERCEL_GIT_COMMIT_SHA and VERCEL_ENV into client build metadata', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'vercel-preview-sha');
    vi.stubEnv('VERCEL_ENV', 'preview');
    const factory = viteConfig as (env: ConfigEnv) => UserConfig | Promise<UserConfig>;
    const config = await factory({
      command: 'build',
      mode: 'production',
      isSsrBuild: false,
      isPreview: false
    });

    expect(config.define).toMatchObject({
      'import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA': JSON.stringify('vercel-preview-sha'),
      'import.meta.env.VITE_VERCEL_ENV': JSON.stringify('preview')
    });
  });
});
