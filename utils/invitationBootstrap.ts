export type InvitationMemory = { token: string | null };

// This module must not import Auth, monitoring or application modules.
export const captureInvitation = (browser: Pick<Window, 'location' | 'history'>): InvitationMemory | null => {
  if (browser.location.pathname !== '/convite') return null;
  const match = browser.location.hash.length === 71 ? /^#token=([0-9a-f]{64})$/.exec(browser.location.hash) : null;
  browser.history.replaceState(null, '', '/convite');
  return { token: match?.[1] ?? null };
};
