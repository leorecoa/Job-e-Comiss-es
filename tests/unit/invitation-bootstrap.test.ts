import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureInvitation } from '../../utils/invitationBootstrap';

const token = 'a'.repeat(64);
const browser = (hash: string, pathname = '/convite') => ({
  location: { pathname, hash }, history: { replaceState: vi.fn() }
}) as unknown as Pick<Window, 'location' | 'history'>;

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.doUnmock('../../bootstrap'); });
describe('invitation bootstrap', () => {
  it('captures the exact fragment and cleans URL before returning', () => {
    const window = browser(`#token=${token}`);
    expect(captureInvitation(window)).toEqual({ token });
    expect(window.history.replaceState).toHaveBeenCalledExactlyOnceWith(null, '', '/convite');
  });
  it.each(['', '#token=bad', `#token=${token.toUpperCase()}`, `#token=${token}&role=owner`, `#token=${token}%20`, `#token=${token}\n`])('cleans invalid fragment %s', (hash) => {
    const window = browser(hash);
    expect(captureInvitation(window)).toEqual({ token: null });
    expect(window.history.replaceState).toHaveBeenCalled();
  });
  it.each(['/auth/callback', '/convite/', '/', '/book/example'])('never consumes another route %s', (path) => {
    const window = browser(`#token=${token}`, path);
    expect(captureInvitation(window)).toBeNull();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });
  it('cleans before the application module and its initializers evaluate', async () => {
    const window = browser(`#token=${token}`);
    vi.mocked(window.history.replaceState).mockImplementation(() => { window.location.hash = ''; });
    vi.stubGlobal('window', window);
    const mount = vi.fn();
    vi.doMock('../../bootstrap', () => {
      expect(window.location.hash).toBe('');
      return { mountApplication: mount };
    });
    await import('../../index');
    await vi.waitFor(() => expect(mount).toHaveBeenCalledExactlyOnceWith({ token }));
  });
  it('discards token and exposes a safe message when application mounting fails', async () => {
    const window = browser(`#token=${token}`);
    const root = { textContent: '' };
    const splash = { remove: vi.fn() };
    let captured: { token: string | null } | undefined;
    vi.stubGlobal('window', window);
    vi.stubGlobal('document', { getElementById: (id: string) => id === 'root' ? root : splash });
    vi.doMock('../../bootstrap', () => ({ mountApplication: (memory: { token: string | null }) => {
      captured = memory;
      throw new Error(token);
    } }));
    await import('../../index');
    await vi.waitFor(() => expect(root.textContent).toContain('Não foi possível carregar'));
    expect(captured?.token).toBeNull();
    expect(root.textContent).not.toContain(token);
    expect(splash.remove).toHaveBeenCalledOnce();
  });
});
