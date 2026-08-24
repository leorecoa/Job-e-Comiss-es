import { describe, expect, it } from 'vitest';
import { getSupabaseRuntimeState } from '../../lib/supabase';

describe('supabase runtime state', () => {
  it('blocks local fallback in production when the Supabase URL is missing', () => {
    expect(getSupabaseRuntimeState({
      supabaseUrl: '',
      supabaseAnonKey: 'anon-key',
      isProduction: true
    })).toMatchObject({
      isSupabaseConfigured: false,
      isProductionWithoutSupabase: true,
      shouldUseLocalFallback: false
    });
  });

  it('blocks local fallback in production when the Supabase anon key is missing', () => {
    expect(getSupabaseRuntimeState({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: '   ',
      isProduction: true
    })).toMatchObject({
      isSupabaseConfigured: false,
      isProductionWithoutSupabase: true,
      shouldUseLocalFallback: false
    });
  });

  it('allows normal Supabase operation in production when both credentials are configured', () => {
    expect(getSupabaseRuntimeState({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      isProduction: true
    })).toMatchObject({
      isSupabaseConfigured: true,
      isProductionWithoutSupabase: false,
      shouldUseLocalFallback: false
    });
  });

  it('keeps the local fallback available in development when Supabase is not configured', () => {
    expect(getSupabaseRuntimeState({
      supabaseUrl: '',
      supabaseAnonKey: '',
      isProduction: false
    })).toMatchObject({
      isSupabaseConfigured: false,
      isProductionWithoutSupabase: false,
      shouldUseLocalFallback: true
    });
  });
});
