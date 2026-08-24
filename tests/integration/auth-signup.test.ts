import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn()
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  isProductionWithoutSupabase: false,
  shouldUseLocalFallback: false,
  assertOperationalSupabase: vi.fn(),
  supabase: {
    auth: { signUp: mocks.signUp },
    from: mocks.from
  }
}));

import { signUpWithPassword } from '../../services/authRepository';

const makeSession = (role: 'owner' | 'barber') => ({
  user: {
    id: `${role}-1`,
    email: `${role}@example.com`,
    user_metadata: { display_name: `Leo ${role}`, role }
  }
});

const makeProfile = (role: 'owner' | 'barber') => ({
  id: `${role}-1`,
  display_name: `Leo ${role}`,
  role,
  active: true,
  barbershop_id: null,
  barber_id: null
});

describe('signup profile provisioning contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', { location: { origin: 'https://app.example.test' }, setTimeout });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  });

  it.each(['owner', 'barber'] as const)('reads the %s profile provisioned by the Auth trigger', async (role) => {
    mocks.signUp.mockResolvedValue({ data: { session: makeSession(role) }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: makeProfile(role), error: null });

    const session = await signUpWithPassword(`${role}@example.com`, '123456', `Leo ${role}`, role);

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: `${role}@example.com`,
      password: '123456',
      options: {
        emailRedirectTo: 'https://app.example.test/auth/callback',
        data: { display_name: `Leo ${role}`, role }
      }
    });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith('profiles');
    expect(mocks.select).toHaveBeenCalledWith('id,display_name,role,active,barbershop_id,barber_id');
    expect(mocks.eq).toHaveBeenCalledWith('id', `${role}-1`);
    expect(session).toMatchObject({ userId: `${role}-1`, role, displayName: `Leo ${role}` });
  });

  it('does not read or write profiles when email confirmation returns no session', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null, user: { id: 'pending-user' } }, error: null });

    await expect(signUpWithPassword('barber@example.com', '123456', 'Leo', 'barber')).resolves.toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('retries only reads and fails with a sanitized provisioning error', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: makeSession('barber') }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(signUpWithPassword('barber@example.com', '123456', 'Leo', 'barber')).rejects.toMatchObject({
      code: 'PROFILE_PROVISIONING_UNAVAILABLE',
      message: 'Não foi possível concluir o cadastro. Tente entrar novamente.'
    });
    expect(mocks.from).toHaveBeenCalledTimes(3);
    expect(mocks.from.mock.calls.every(([table]) => table === 'profiles')).toBe(true);
  });

  it('contains no frontend profile mutation method in signup queries', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: makeSession('barber') }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: makeProfile('barber'), error: null });

    await signUpWithPassword('barber@example.com', '123456', 'Leo barber', 'barber');

    expect(mocks.from).toHaveBeenCalledWith('profiles');
    expect(mocks.from.mock.results[0].value).not.toHaveProperty('insert');
    expect(mocks.from.mock.results[0].value).not.toHaveProperty('update');
    expect(mocks.from.mock.results[0].value).not.toHaveProperty('upsert');
    expect(mocks.from.mock.results[0].value).not.toHaveProperty('delete');
  });
});
