import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  OwnerBarberProfileLinking,
  canManageOwnerBarberProfileLinking,
  getAvailableBarbersForProfileLinking,
  isBasicEmailValid,
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
  it('renders one global linking form before the professional list', () => {
    const html = renderToStaticMarkup(
      <OwnerBarberProfileLinking
        role="owner"
        barbers={[makeBarber()]}
        onLinkProfile={vi.fn()}
      />
    );

    expect(html).toContain('Vincular barbeiro à equipe');
    expect(html).toContain('E-mail usado no login');
    expect(html).toContain('Profissional correspondente');
    expect(html).toContain('Vincular usuário');
    expect(html).toContain('Como funciona');
    expect(html.match(/type="email"/g)).toHaveLength(1);
    expect(html.match(/<select/g)).toHaveLength(1);
    expect(html.indexOf('<form')).toBeLessThan(html.indexOf('Profissionais da equipe'));
    expect(html).not.toContain('Enviar link de cadastro');
  });

  it('renders guidance when no professional is available', () => {
    const html = renderToStaticMarkup(
      <OwnerBarberProfileLinking role="owner" barbers={[]} onLinkProfile={vi.fn()} />
    );

    expect(html).toContain('Nenhum profissional ativo aguardando vínculo.');
    expect(html).toContain('Cadastre ou ative um profissional no');
    expect(html).toContain('#management-catalog');
  });

  it('offers only active professionals not linked in this session', () => {
    const available = getAvailableBarbersForProfileLinking([
      makeBarber(),
      makeBarber({ id: 'barber-2', name: 'Inativo', active: false }),
      makeBarber({ id: 'barber-3', name: 'Ana' })
    ], new Set(['barber-3']));

    expect(available.map(({ id, name }) => ({ id, name }))).toEqual([{ id: 'barber-1', name: 'Leo' }]);
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

  it('blocks an invalid email and a missing professional', async () => {
    expect(isBasicEmailValid('invalid')).toBe(false);
    expect(isOwnerBarberProfileLinkingSubmitDisabled({ barber: makeBarber(), email: 'invalid' })).toBe(true);
    expect(isOwnerBarberProfileLinkingSubmitDisabled({ email: 'barber@example.com' })).toBe(true);
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
      message: 'Conta vinculada ao profissional Leo. E-mail usado: barber@example.com. Se a agenda ainda nao aparecer para o barbeiro, peca para ele sair e entrar novamente.'
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
      message: 'Nenhuma conta foi encontrada com este e-mail. Peca para o barbeiro criar a conta primeiro e tente novamente.'
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
      message: 'O profissional selecionado nao pertence a esta barbearia.'
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
      message: 'Esta conta ja esta vinculada a outra barbearia.'
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
      message: 'Esta conta e de owner e nao pode ser vinculada como barbeiro.'
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
      message: 'Use uma conta separada para o barbeiro. Uma conta de owner nao deve ser usada como perfil de atendimento.'
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
