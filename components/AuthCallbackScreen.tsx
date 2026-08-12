import React, { useEffect } from 'react';
import { AuthSession } from '../services/authRepository';

export const AUTH_CALLBACK_PATH = '/auth/callback';

export const getAuthCallbackDestination = (session: AuthSession): '/onboarding' | '/' => (
  session.role === 'owner' && !session.barbershopId ? '/onboarding' : '/'
);

export const hasAuthCallbackError = (search: string, hash: string): boolean => {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  return query.has('error') || query.has('error_code') || fragment.has('error') || fragment.has('error_code');
};

interface AuthCallbackScreenProps {
  loading: boolean;
  session: AuthSession | null;
}

export const AuthCallbackScreen: React.FC<AuthCallbackScreenProps> = ({ loading, session }) => {
  const callbackHasError = typeof window === 'undefined'
    ? false
    : hasAuthCallbackError(window.location.search, window.location.hash);

  useEffect(() => {
    if (loading) return;

    window.history.replaceState(null, '', AUTH_CALLBACK_PATH);
    if (session && !callbackHasError) {
      window.location.replace(getAuthCallbackDestination(session));
    }
  }, [callbackHasError, loading, session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 text-gray-200">
        <div className="rounded-2xl border border-gray-700 bg-gray-800 p-8 text-center">
          <h1 className="text-xl font-bold text-white">Confirmando seu email</h1>
          <p className="mt-2 text-sm text-gray-400">Aguarde enquanto validamos seu acesso.</p>
        </div>
      </div>
    );
  }

  if (!session || callbackHasError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 text-gray-200">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-gray-800 p-8 text-center">
          <h1 className="text-xl font-bold text-white">Nao foi possivel confirmar seu email</h1>
          <p className="mt-2 text-sm text-gray-400">O link pode ter expirado ou ja ter sido utilizado. Tente entrar ou solicite um novo email de confirmacao.</p>
          <a className="mt-5 inline-flex rounded-xl bg-gold-500 px-5 py-3 font-bold text-black" href="/">Voltar ao login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 text-gray-200">
      <p>Confirmacao concluida. Redirecionando...</p>
    </div>
  );
};
