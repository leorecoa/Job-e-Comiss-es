import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  OwnerBarberProfileLinking,
  canManageOwnerBarberProfileLinking,
  isOwnerBarberProfileLinkingSubmitDisabled,
  submitOwnerBarberProfileLinking
} from './components/OwnerBarberProfileLinking';
import { BarberOption } from './types';

const makeBarber = (overrides: Partial<BarberOption> = {}): BarberOption => ({
  id: 'barber-1',
  name: 'Leo',
  barbershopId: 'shop-1',
  active: true,
  ...overrides
});

describe('owner barber profile linking', () => {
  it('owner sees the linking UI', () => {
    const html = renderToStaticMarkup(
      <OwnerBarberProfileLinking
        role="owner"
        barbers={[makeBarber()]}
        onLinkProfile={vi.fn()}
      />
    );

    expect(html).toContain('Vincular barbeiro a usuario');
    expect(html).toContain('usuario@exemplo.com');
  });

  it('barber does not see the linking UI', () => {
    const html = renderToStaticMarkup(
      <OwnerBarberProfileLinking
        role="barber"
        barbers={[makeBarber()]}
        onLinkProfile={vi.fn()}
      />
    );

    expect(canManageOwnerBarberProfileLinking('barber')).toBe(false);
    expect(html).toBe('');
  });

  it('blocks submit with an empty email', async () => {
    expect(isOwnerBarberProfileLinkingSubmitDisabled({
      barber: makeBarber(),
      email: '   '
    })).toBe(true);

    const onLinkProfile = vi.fn();
    const result = await submitOwnerBarberProfileLinking({
      barber: makeBarber(),
      email: '   ',
      onLinkProfile
    });

    expect(result).toBeNull();
    expect(onLinkProfile).not.toHaveBeenCalled();
  });

  it('returns success when the barber is linked', async () => {
    const onLinkProfile = vi.fn().mockResolvedValue(undefined);

    const result = await submitOwnerBarberProfileLinking({
      barber: makeBarber(),
      email: ' Barber@Example.com ',
      onLinkProfile
    });

    expect(onLinkProfile).toHaveBeenCalledWith({
      targetEmail: 'barber@example.com',
      targetBarberId: 'barber-1'
    });
    expect(result).toEqual({
      type: 'success',
      message: 'Barbeiro vinculado com sucesso.'
    });
  });

  it('maps TARGET_USER_NOT_FOUND to a friendly message', async () => {
    const result = await submitOwnerBarberProfileLinking({
      barber: makeBarber(),
      email: 'barber@example.com',
      onLinkProfile: vi.fn().mockRejectedValue({ code: 'TARGET_USER_NOT_FOUND' })
    });

    expect(result).toEqual({
      type: 'error',
      message: 'Usuario nao encontrado. Peca para o barbeiro criar uma conta primeiro.'
    });
  });

  it('maps BARBER_NOT_IN_TENANT to a friendly message', async () => {
    const result = await submitOwnerBarberProfileLinking({
      barber: makeBarber(),
      email: 'barber@example.com',
      onLinkProfile: vi.fn().mockRejectedValue({ code: 'BARBER_NOT_IN_TENANT' })
    });

    expect(result).toEqual({
      type: 'error',
      message: 'Este barbeiro nao pertence a sua barbearia.'
    });
  });

  it('maps TARGET_PROFILE_BELONGS_TO_ANOTHER_TENANT to a friendly message', async () => {
    const result = await submitOwnerBarberProfileLinking({
      barber: makeBarber(),
      email: 'barber@example.com',
      onLinkProfile: vi.fn().mockRejectedValue({ code: 'TARGET_PROFILE_BELONGS_TO_ANOTHER_TENANT' })
    });

    expect(result).toEqual({
      type: 'error',
      message: 'Este usuario ja esta vinculado a outra barbearia.'
    });
  });

  it('maps TARGET_PROFILE_IS_OWNER to a friendly message', async () => {
    const result = await submitOwnerBarberProfileLinking({
      barber: makeBarber(),
      email: 'barber@example.com',
      onLinkProfile: vi.fn().mockRejectedValue({ code: 'TARGET_PROFILE_IS_OWNER' })
    });

    expect(result).toEqual({
      type: 'error',
      message: 'Este usuario ja e owner e nao pode ser vinculado como barbeiro.'
    });
  });

  it('maps TARGET_USER_CANNOT_BE_OWNER to a friendly message', async () => {
    const result = await submitOwnerBarberProfileLinking({
      barber: makeBarber(),
      email: 'barber@example.com',
      onLinkProfile: vi.fn().mockRejectedValue({ code: 'TARGET_USER_CANNOT_BE_OWNER' })
    });

    expect(result).toEqual({
      type: 'error',
      message: 'Use uma conta separada para o barbeiro.'
    });
  });

  it('shows the generic error for unexpected failures', async () => {
    const result = await submitOwnerBarberProfileLinking({
      barber: makeBarber(),
      email: 'barber@example.com',
      onLinkProfile: vi.fn().mockRejectedValue(new Error('boom'))
    });

    expect(result).toEqual({
      type: 'error',
      message: 'Nao foi possivel vincular este usuario.'
    });
  });

  it('treats an invalid barber as disabled', () => {
    expect(isOwnerBarberProfileLinkingSubmitDisabled({
      barber: makeBarber({ id: '' }),
      email: 'barber@example.com'
    })).toBe(true);
  });
});
