
import { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type AppRole = 'owner' | 'barber';

export type AuthSession = {
  userId: string;
  email: string;
  role: AppRole;
  displayName: string;
  barbershopId?: string;
  barberId?: string;
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
  role: AppRole | string;
  active?: boolean | null;
  barbershop_id: string | null;
  barber_id: string | null;
};

export const normalizeRole = (role: unknown): AppRole => {
  return role === 'barber' ? 'barber' : 'owner';
};

export const mapAuthSession = (
  session: Session | null,
  profile?: ProfileRow | null
): AuthSession | null => {
  const user = session?.user;
  if (!user?.email) return null;

  return {
    userId: user.id,
    email: user.email,
    role: normalizeRole(profile?.role ?? user.user_metadata?.role),
    displayName: String(
      profile?.display_name ||
      user.user_metadata?.display_name ||
      user.email.split('@')[0]
    ),
    barbershopId: profile?.barbershop_id || undefined,
    barberId: profile?.barber_id || undefined,
  };
};

export const canAccessInternalPanel = (
  authSession: AuthSession | null,
  supabaseConfigured: boolean
): boolean => {
  if (!supabaseConfigured) return true;
  if (!authSession) return false;

  const hasBarbershopId = Boolean(authSession.barbershopId?.trim());

  if (authSession.role === 'owner') {
    return hasBarbershopId;
  }

  if (authSession.role === 'barber') {
    return hasBarbershopId && Boolean(authSession.barberId?.trim());
  }

  return false;
};

const getAuthenticatedUserId = async (): Promise<string | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  return data.user.id;
};

export const getCurrentAuthSession = async (): Promise<AuthSession | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const profile = data.session?.user
    ? await getProfile(data.session.user.id)
    : null;

  return mapAuthSession(data.session, profile);
};

export const signInWithPassword = async (
  email: string,
  password: string
): Promise<AuthSession> => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase Auth nao esta configurado.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  const profile = data.session?.user
    ? await getProfile(data.session.user.id)
    : null;

  const authSession = mapAuthSession(data.session, profile);

  if (!authSession) {
    throw new Error('Sessao invalida.');
  }

  return authSession;
};

export const signUpWithPassword = async (
  email: string,
  password: string,
  displayName: string,
  role: AppRole = 'barber'
): Promise<AuthSession | null> => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase Auth nao esta configurado.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: {
        display_name: displayName,
        role
      }
    }
  });

  if (error) throw error;

  /*
   * Supabase pode retornar user sem session quando confirmação por e-mail está ativa.
   * Sem sessão autenticada, não tente inserir em profiles porque o RLS vai bloquear.
   */
  if (!data.session?.user) {
    return null;
  }

  const profile = await getProvisionedProfile(data.session.user.id);

  return mapAuthSession(data.session, profile);
};
const getProvisionedProfile = async (userId: string): Promise<ProfileRow> => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data, error } = await supabase!
      .from('profiles')
      .select('id,display_name,role,active,barbershop_id,barber_id')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as ProfileRow;

    if (attempt < maxAttempts) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 25));
    }
  }

  const error = new Error('Não foi possível concluir o cadastro. Tente entrar novamente.') as Error & { code?: string };
  error.code = 'PROFILE_PROVISIONING_UNAVAILABLE';
  throw error;
};

export const signOut = async (): Promise<void> => {
  if (!isSupabaseConfigured || !supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getUserProfileName = (
  user: Pick<User, 'email' | 'user_metadata'>
): string => {
  return String(
    user.user_metadata?.display_name ||
    user.email?.split('@')[0] ||
    'Usuario'
  );
};

export const getProfile = async (userId: string): Promise<ProfileRow | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  const authenticatedUserId = await getAuthenticatedUserId();

  if (!authenticatedUserId) return null;
  if (authenticatedUserId !== userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id,display_name,role,active,barbershop_id,barber_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return data as ProfileRow | null;
};
