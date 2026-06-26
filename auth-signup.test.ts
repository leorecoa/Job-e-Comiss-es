import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn()
  }
}));

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: true,
  isProductionWithoutSupabase: false,
  shouldUseLocalFallback: false,
  assertOperationalSupabase: vi.fn(),
  supabase: supabaseMock
}));

import { signUpWithPassword } from './services/authRepository';

describe('owner signup onboarding contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps owner role in auth metadata so onboarding can start', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'owner-1',
            email: 'owner@example.com',
            user_metadata: {
              display_name: 'Leo Owner',
              role: 'owner'
            }
          }
        }
      },
      error: null
    });

    const session = await signUpWithPassword(
      'owner@example.com',
      '123456',
      'Leo Owner',
      'owner'
    );

    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: '123456',
      options: {
        data: {
          display_name: 'Leo Owner',
          role: 'owner'
        }
      }
    });
    expect(session).toMatchObject({
      email: 'owner@example.com',
      displayName: 'Leo Owner',
      role: 'owner'
    });
  });
});
