import React, { useEffect } from 'react';
import { AuthSession } from '../services/authRepository';
import { AuthLayout, Button, EmptyState, LoadingState, Surface } from './ui';

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
      <AuthLayout>
        <Surface><LoadingState title="Confirmando seu email" description="Aguarde enquanto validamos seu acesso." /></Surface>
      </AuthLayout>
    );
  }

  if (!session || callbackHasError) {
    return (
      <AuthLayout>
        <Surface>
          <EmptyState
            title="Nao foi possivel confirmar seu email"
            description="O link pode ter expirado ou ja ter sido utilizado. Tente entrar ou solicite um novo email de confirmacao."
            action={<Button className="mt-5" type="button" onClick={() => window.location.assign('/')}>Voltar ao login</Button>}
          />
        </Surface>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Surface><LoadingState title="Confirmacao concluida" description="Redirecionando para seu espaco de trabalho." /></Surface>
    </AuthLayout>
  );
};
