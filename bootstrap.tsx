import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { TeamInvitationScreen } from './components/TeamInvitationScreen';
import { initializeObservability } from './utils/observability';
import type { InvitationMemory } from './utils/invitationBootstrap';
import type { AuthSession } from './services/authRepository';

function ApplicationEntry({ invitation }: { invitation: InvitationMemory | null }) {
  const [completed, setCompleted] = useState(false);
  const [session, setSession] = useState<AuthSession | undefined>();
  if (invitation && !completed) {
    return <TeamInvitationScreen invitation={invitation} onComplete={(canonical) => {
      invitation.token = null;
      window.history.replaceState(null, '', '/');
      setSession(canonical);
      setCompleted(true);
    }} />;
  }
  return <App initialAuthSession={session} />;
}

export function mountApplication(invitation: InvitationMemory | null) {
  initializeObservability();
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Could not find root element to mount to');
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode><AppErrorBoundary><ApplicationEntry invitation={invitation} /></AppErrorBoundary></React.StrictMode>
  );
}
