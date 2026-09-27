import React, { useEffect, useRef, useState } from 'react';
import { AuthLayout, Button, InlineNotice, Surface } from './ui';
import { getCurrentAuthSession, signInWithPassword, signOut, signUpWithPassword, type AuthSession } from '../services/authRepository';
import { acceptTeamInvitation, getTeamInvitationErrorMessage, INVITATIONS_ONLINE_ONLY } from '../services/teamInvitationRepository';
import { isSupabaseConfigured, shouldUseLocalFallback, supabase } from '../lib/supabase';
import { captureInvitation, type InvitationMemory } from '../utils/invitationBootstrap';

const AuthScreen = React.lazy(() => import('./AuthScreen').then((module) => ({ default: module.AuthScreen })));

export function TeamInvitationScreen({ invitation, onComplete }: {
  invitation: InvitationMemory;
  onComplete: (session: AuthSession) => void;
}) {
  const online = isSupabaseConfigured && !shouldUseLocalFallback;
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(online);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidated, setInvalidated] = useState(false);
  const epoch = useRef(0);
  const locked = useRef(false);
  const identity = useRef<string | null>(null);

  useEffect(() => {
    const generation = ++epoch.current;
    document.getElementById('splash-screen')?.remove();
    if (!online) invitation.token = null;
    const abandon = () => {
      ++epoch.current;
      invitation.token = null;
      setInvalidated(true);
    };
    const loadSession = (request: number) => {
      if (!online) return;
      void getCurrentAuthSession().then((current) => {
        if (epoch.current !== request) return;
        identity.current = current?.userId ?? null;
        setSession(current);
      }).catch(() => {
        if (epoch.current === request) setError('Não foi possível validar sua sessão. Entre novamente.');
      }).finally(() => {
        if (epoch.current === request) setLoading(false);
      });
    };
    const navigate = (event: Event) => {
      // A fragment navigation may emit popstate then hashchange. Ignore the latter
      // when replaceState already consumed that URL (or another navigation won).
      if (event instanceof HashChangeEvent && event.newURL !== window.location.href) return;
      const next = captureInvitation(window);
      abandon();
      if (next?.token) {
        invitation.token = next.token;
        identity.current = null;
        locked.current = false;
        setSession(null);
        setBusy(false);
        setError(null);
        setAccepted(false);
        setPendingConfirmation(false);
        setInvalidated(false);
        setLoading(online);
        loadSession(epoch.current);
      }
    };
    window.addEventListener('popstate', navigate);
    window.addEventListener('hashchange', navigate);
    window.addEventListener('pagehide', abandon);
    const subscription = online ? supabase!.auth.onAuthStateChange((_event, next) => {
      if (identity.current && next?.user.id !== identity.current) abandon();
    }).data.subscription : null;
    loadSession(generation);
    return () => {
      const disposed = ++epoch.current;
      subscription?.unsubscribe();
      window.removeEventListener('popstate', navigate);
      window.removeEventListener('hashchange', navigate);
      window.removeEventListener('pagehide', abandon);
      // StrictMode immediately reconnects this effect; real unmount discards the secret.
      queueMicrotask(() => { if (epoch.current === disposed) invitation.token = null; });
    };
  }, [invitation, online]);

  const run = async (action: (generation: number) => Promise<void>) => {
    if (locked.current || invalidated) return;
    locked.current = true;
    const generation = epoch.current;
    setBusy(true);
    setError(null);
    try { await action(generation); }
    catch {
      if (epoch.current === generation) setError('Não foi possível concluir esta ação. Tente novamente.');
    } finally {
      if (epoch.current === generation) { locked.current = false; setBusy(false); }
    }
  };

  const authenticate = (email: string, password: string, name?: string) => run(async (generation) => {
    try {
      const current = name === undefined
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password, name, 'barber');
      if (epoch.current !== generation) return;
      identity.current = current?.userId ?? null;
      setSession(current);
      if (!current) {
        invitation.token = null;
        setPendingConfirmation(true);
      }
    } catch {
      if (epoch.current === generation) setError('Não foi possível autenticar. Confira seus dados e a confirmação do e-mail.');
    }
  });

  const refresh = async (generation: number, userId: string) => {
    try {
      const current = await getCurrentAuthSession();
      if (epoch.current !== generation) return;
      if (!current || current.userId !== userId || current.role !== 'barber' || !current.barbershopId || !current.barberId) throw new Error();
      onComplete(current);
    } catch {
      if (epoch.current === generation) setError('Vínculo concluído, mas não foi possível atualizar o acesso. Tente atualizar o acesso novamente.');
    }
  };

  const accept = () => run(async (generation) => {
    if (!invitation.token || session?.role !== 'barber' || accepted) return;
    try {
      await acceptTeamInvitation(invitation.token);
    } catch (failure) {
      if (epoch.current === generation) setError(getTeamInvitationErrorMessage(failure));
      return;
    }
    if (epoch.current !== generation) return;
    invitation.token = null;
    setAccepted(true);
    await refresh(generation, session.userId);
  });

  const switchAccount = () => run(async (generation) => {
    const previous = identity.current;
    identity.current = null; // Explicit account switching keeps this invitation in memory.
    try {
      await signOut();
      if (epoch.current === generation) setSession(null);
    } catch {
      if (epoch.current === generation) {
        identity.current = previous;
        setError('Não foi possível sair. Tente novamente.');
      }
    }
  });

  const missing = !invitation.token && !accepted && !pendingConfirmation;
  return <AuthLayout>
    <Surface className="space-y-4">
      <h1 className="font-display text-2xl">Convite para a equipe</h1>
      {!online ? <InlineNotice>{INVITATIONS_ONLINE_ONLY}</InlineNotice>
        : invalidated ? <InlineNotice>Este fluxo foi encerrado. Reabra o link original do convite.</InlineNotice>
        : pendingConfirmation ? <InlineNotice>Cadastro criado. Confirme seu e-mail e depois reabra o link original do convite para continuar.</InlineNotice>
        : missing ? <InlineNotice>Link ausente ou inválido. Reabra o convite original recebido.</InlineNotice>
        : loading ? <p role="status">Validando sessão...</p>
        : accepted ? <>
          <InlineNotice tone="success">Vínculo concluído.</InlineNotice>
          <Button loading={busy} onClick={() => void run((generation) => refresh(generation, session!.userId))}>Atualizar acesso</Button>
        </> : session ? <>
          <p>{session.role === 'owner' ? 'Esta conta é de owner. Entre com uma conta de barbeiro para continuar.' : 'Use a conta destinatária do convite. O vínculo será verificado ao aceitar.'}</p>
          {session.role === 'barber' && <Button loading={busy} onClick={() => void accept()}>Aceitar convite</Button>}
          <Button variant="secondary" disabled={busy} onClick={() => void switchAccount()}>Sair e trocar de conta</Button>
        </> : <p>Entre ou crie uma conta de barbeiro para continuar. O convite será verificado somente no aceite.</p>}
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <Button variant="ghost" onClick={() => {
        ++epoch.current;
        invitation.token = null;
        window.location.assign('/');
      }}>Sair do convite</Button>
    </Surface>
    {online && !loading && !session && !missing && !invalidated && !pendingConfirmation && <React.Suspense fallback={<p role="status">Carregando acesso...</p>}><AuthScreen embedded signupRole="barber" loading={busy}
      onSignIn={(email, password) => authenticate(email, password)}
      onSignUp={(email, password, name) => authenticate(email, password, name)} /></React.Suspense>}
  </AuthLayout>;
}
