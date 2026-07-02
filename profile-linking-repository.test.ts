import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BarberOption } from './types';

const { rpcMock, assertOperationalSupabaseMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  assertOperationalSupabaseMock: vi.fn()
}));

vi.mock('./lib/supabase', () => ({
  shouldUseLocalFallback: false,
  assertOperationalSupabase: assertOperationalSupabaseMock,
  supabase: {
    rpc: rpcMock
  }
}));

import {
  getBarberProfileLinkingErrorMessage,
  linkBarberProfileByEmail
} from './services/profileLinkingRepository';

const ownerBarbers: BarberOption[] = [
  { id: 'barber-1', name: 'Leo', barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce', active: true }
];

describe('profile linking repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the RPC with the normalized email and barber id', async () => {
    rpcMock.mockResolvedValue({
      data: [{
        profile_id: 'profile-1',
        display_name: 'Leo Barber',
        role: 'barber',
        active: true,
        barbershop_id: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce',
        barber_id: 'barber-1'
      }],
      error: null
    });

    const result = await linkBarberProfileByEmail({
      targetEmail: '  BARBER@Example.com ',
      targetBarberId: 'barber-1',
      ownerBarbers,
      ownerBarbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce'
    });

    expect(rpcMock).toHaveBeenCalledWith('link_barber_profile_by_email', {
      p_target_email: 'barber@example.com',
      p_target_barber_id: 'barber-1'
    });
    expect(result).toEqual({
      profileId: 'profile-1',
      displayName: 'Leo Barber',
      role: 'barber',
      active: true,
      barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce',
      barberId: 'barber-1'
    });
  });

  it('does not allow linking a barber outside the owner catalog tenant', async () => {
    await expect(linkBarberProfileByEmail({
      targetEmail: 'barber@example.com',
      targetBarberId: 'barber-outro-tenant',
      ownerBarbers,
      ownerBarbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce'
    })).rejects.toMatchObject({
      code: 'BARBER_NOT_IN_TENANT'
    });

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects linking when the owner barbershop id is not a valid UUID', async () => {
    await expect(linkBarberProfileByEmail({
      targetEmail: 'barber@example.com',
      targetBarberId: 'barber-1',
      ownerBarbers,
      ownerBarbershopId: '57hs3s9tt'
    })).rejects.toMatchObject({
      code: 'OWNER_BARBERSHOP_REQUIRED'
    });

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects linking when the target barber id is missing', async () => {
    await expect(linkBarberProfileByEmail({
      targetEmail: 'barber@example.com',
      targetBarberId: '   ',
      ownerBarbers,
      ownerBarbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce'
    })).rejects.toMatchObject({
      code: 'TARGET_BARBER_REQUIRED'
    });

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('maps RPC and guard errors to friendly messages', () => {
    expect(getBarberProfileLinkingErrorMessage({ code: 'TARGET_USER_NOT_FOUND' })).toBe(
      'Nenhuma conta foi encontrada com este e-mail. Peca para o barbeiro criar a conta primeiro e tente novamente.'
    );
    expect(getBarberProfileLinkingErrorMessage({ code: 'BARBER_NOT_IN_TENANT' })).toBe(
      'O profissional selecionado nao pertence a esta barbearia.'
    );
    expect(getBarberProfileLinkingErrorMessage({ code: 'TARGET_PROFILE_BELONGS_TO_ANOTHER_TENANT' })).toBe(
      'Esta conta ja esta vinculada a outra barbearia.'
    );
    expect(getBarberProfileLinkingErrorMessage({ code: 'TARGET_PROFILE_IS_OWNER' })).toBe(
      'Esta conta e de owner e nao pode ser vinculada como barbeiro.'
    );
    expect(getBarberProfileLinkingErrorMessage({ code: 'TARGET_USER_CANNOT_BE_OWNER' })).toBe(
      'Use uma conta separada para o barbeiro. Uma conta de owner nao deve ser usada como perfil de atendimento.'
    );
    expect(getBarberProfileLinkingErrorMessage(new Error('unexpected'))).toBe(
      'Nao foi possivel vincular este usuario.'
    );
  });
});
