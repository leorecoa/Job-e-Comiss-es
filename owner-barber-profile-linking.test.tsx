import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  OwnerBarberProfileLinking,
  BARBER_SIGNUP_PATH,
  BARBER_SIGNUP_SHARE_TEXT,
  BARBER_SIGNUP_SHARE_TITLE,
  canManageOwnerBarberProfileLinking,
  getBarberSignupUrl,
  isOwnerBarberProfileLinkingSubmitDisabled,
  shareBarberSignup,
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

    expect(html).toContain('Vincular barbeiro a usuário');
    expect(html).toContain('Como funciona');
    expect(html).toContain('O barbeiro cria uma conta usando o e-mail dele.');
    expect(html).toContain('E-mail da conta do barbeiro');
    expect(html).toContain('Enviar link de cadastro');
    expect(html.indexOf('Enviar link de cadastro')).toBeLessThan(html.indexOf('Como funciona'));
    expect(html.indexOf('Enviar link de cadastro')).toBeLessThan(html.indexOf('Leo'));
    expect(html).not.toContain('barber-1');
  });

  it('renders the signup action without registered professionals', () => {
    const html = renderToStaticMarkup(
      <OwnerBarberProfileLinking role="owner" barbers={[]} onLinkProfile={vi.fn()} />
    );

    expect(html).toContain('Enviar link de cadastro');
    expect(html).toContain('O barbeiro precisa criar a conta antes do vínculo.');
  });

  it('shares only the dedicated public URL without tenant or personal data', async () => {
    const share = vi.fn().mockResolvedValue(undefined);

    await expect(shareBarberSignup({ share }, 'https://job-e-comiss-es.vercel.app')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({
      title: BARBER_SIGNUP_SHARE_TITLE,
      text: BARBER_SIGNUP_SHARE_TEXT,
      url: 'https://job-e-comiss-es.vercel.app/cadastro/barbeiro'
    });
    expect(share.mock.calls[0][0].url).not.toMatch(/[?#]|email|userId|barberId|barbershopId|token/i);
    expect(getBarberSignupUrl('https://job-e-comiss-es.vercel.app')).toBe(`https://job-e-comiss-es.vercel.app${BARBER_SIGNUP_PATH}`);
  });

  it('copies the public signup URL when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(shareBarberSignup({ clipboard: { writeText } }, 'https://app.example.test')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://app.example.test/cadastro/barbeiro');
  });

  it('reports an unavailable sharing mechanism as a controlled failure', async () => {
    await expect(shareBarberSignup({}, 'https://app.example.test')).rejects.toThrow('Share unavailable');
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
