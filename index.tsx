import { captureInvitation } from './utils/invitationBootstrap';

let invitation = captureInvitation(window);
// Dynamic import ensures Auth/Sentry cannot initialize before URL cleanup.
void import('./bootstrap').then(({ mountApplication }) => {
  mountApplication(invitation);
  invitation = null;
}).catch(() => {
  if (invitation) invitation.token = null;
  invitation = null;
  document.getElementById('splash-screen')?.remove();
  const root = document.getElementById('root');
  if (root) root.textContent = 'Não foi possível carregar a aplicação. Recarregue a página.';
});
