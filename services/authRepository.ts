
import { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type AppRole = 'owner' | 'barber';

export type AuthSession = {
  userId: string;
  email: string;
  role: AppRole;
  displayName: string;
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
  role: AppRole | string;
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
    )
  };
};

export const canAccessInternalPanel = (
  authSession: AuthSession | null,
  supabaseConfigured: boolean
): boolean => {
  if (!supabaseConfigured) return true;
  return authSession?.role === 'owner' || authSession?.role === 'barber';
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
      data: {
        display_name: displayName,
        role: 'barber'
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

  const profile = await upsertProfile(
    data.session.user.id,
    displayName,
    role
  );

  return mapAuthSession(data.session, profile);
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
    .select('id,display_name,role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return data as ProfileRow | null;
};

export const upsertProfile = async (
  userId: string,
  displayName: string,
  role: AppRole
): Promise<ProfileRow> => {
  if (!isSupabaseConfigured || !supabase) {
    return {
      id: userId,
      display_name: displayName,
      role
    };
  }

  const authenticatedUserId = await getAuthenticatedUserId();

  if (!authenticatedUserId) {
    throw new Error('Usuario nao autenticado para atualizar profile.');
  }

  if (authenticatedUserId !== userId) {
    throw new Error('Nao e permitido atualizar profile de outro usuario.');
  }

  const safeRole: AppRole = role === 'owner' ? 'barber' : role;

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      display_name: displayName,
      role: safeRole
    }, { onConflict: 'id' })
    .select('id,display_name,role')
    .single();

  if (error) throw error;

  return data as ProfileRow;
};

