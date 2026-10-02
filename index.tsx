import { captureInvitation } from './utils/invitationBootstrap';

if (window.location.pathname.replace(/\/$/, '') === '/convite-parceiro') {
  void import('./commercialBootstrap').then(({ mountCommercialPage }) => mountCommercialPage()).catch(() => {
    document.getElementById('splash-screen')?.remove();
    const root = document.getElementById('root');
    if (root) root.textContent = 'Não foi possível carregar a apresentação. Recarregue a página.';
  });
} else {
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
}
