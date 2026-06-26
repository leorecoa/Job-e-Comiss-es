import { createClient } from '@supabase/supabase-js';

const viteEnv = (import.meta as unknown as {
  env?: {
    MODE?: string;
    PROD?: boolean;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
  };
}).env;

export const PRODUCTION_SUPABASE_UNAVAILABLE_MESSAGE = 'Configuracao do banco indisponivel. O sistema nao pode operar em producao sem Supabase configurado.';

const normalizeEnvValue = (value?: string): string => value?.trim() || '';

export const getSupabaseRuntimeState = ({
  supabaseUrl,
  supabaseAnonKey,
  isProduction
}: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  isProduction: boolean;
}) => {
  const normalizedUrl = normalizeEnvValue(supabaseUrl);
  const normalizedAnonKey = normalizeEnvValue(supabaseAnonKey);
  const isSupabaseConfigured = Boolean(normalizedUrl && normalizedAnonKey);
  const isProductionWithoutSupabase = isProduction && !isSupabaseConfigured;
  const shouldUseLocalFallback = !isProduction && !isSupabaseConfigured;

  return {
    supabaseUrl: normalizedUrl,
    supabaseAnonKey: normalizedAnonKey,
    isSupabaseConfigured,
    isProductionWithoutSupabase,
    shouldUseLocalFallback
  };
};

const runtimeState = getSupabaseRuntimeState({
  supabaseUrl: viteEnv?.VITE_SUPABASE_URL,
  supabaseAnonKey: viteEnv?.VITE_SUPABASE_ANON_KEY,
  isProduction: Boolean(viteEnv?.PROD || viteEnv?.MODE === 'production')
});

export const isSupabaseConfigured = runtimeState.isSupabaseConfigured;
export const isProductionWithoutSupabase = runtimeState.isProductionWithoutSupabase;
export const shouldUseLocalFallback = runtimeState.shouldUseLocalFallback;

export const assertOperationalSupabase = (): void => {
  if (isProductionWithoutSupabase) {
    throw new Error(PRODUCTION_SUPABASE_UNAVAILABLE_MESSAGE);
  }
};

export const supabase = isSupabaseConfigured
  ? createClient(runtimeState.supabaseUrl as string, runtimeState.supabaseAnonKey as string)
  : null;
