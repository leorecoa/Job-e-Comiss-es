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

export const mapAuthSession = (session: Session | null, profile?: ProfileRow | null): AuthSession | null => {
  const user = session?.user;
  if (!user?.email) return null;

  return {
    userId: user.id,
    email: user.email,
    role: normalizeRole(profile?.role ?? user.user_metadata?.role),
    displayName: String(profile?.display_name || user.user_metadata?.display_name || user.email.split('@')[0])
  };
};

export const canAccessInternalPanel = (
  authSession: AuthSession | null,
  supabaseConfigured: boolean
): boolean => {
  if (!supabaseConfigured) return true;
  return authSession?.role === 'owner' || authSession?.role === 'barber';
};

export const getCurrentAuthSession = async (): Promise<AuthSession | null> => {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const profile = data.session?.user ? await getProfile(data.session.user.id) : null;
  return mapAuthSession(data.session, profile);
};

export const signInWithPassword = async (email: string, password: string): Promise<AuthSession> => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase Auth nao esta configurado.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const profile = data.session?.user ? await getProfile(data.session.user.id) : null;
  const authSession = mapAuthSession(data.session, profile);
  if (!authSession) throw new Error('Sessao invalida.');
  return authSession;
};

export const signUpWithPassword = async (
  email: string,
  password: string,
  displayName: string,
  role: AppRole = 'owner'
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
        role
      }
    }
  });
  if (error) throw error;
  const profile = data.user
    ? await upsertProfile(data.user.id, displayName, role)
    : null;
  return mapAuthSession(data.session, profile);
};

export const signOut = async (): Promise<void> => {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getUserProfileName = (user: Pick<User, 'email' | 'user_metadata'>): string => {
  return String(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Usuario');
};

export const getProfile = async (userId: string): Promise<ProfileRow | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

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

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      display_name: displayName,
      role
    }, { onConflict: 'id' })
    .select('id,display_name,role')
    .single();

  if (error) throw error;
  return data as ProfileRow;
};
