import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OwnerBarberProfileLinking } from '../../components/OwnerBarberProfileLinking';
import { isBasicEmailValid } from '../../utils/emailValidation';

describe('owner team management without manual linking', () => {
  it('keeps the professional roster and instructions without the manual form', () => {
    const html = renderToStaticMarkup(<OwnerBarberProfileLinking role="owner" barbers={[
      { id: 'b', name: 'Zeca', active: false }, { id: 'a', name: 'Ana', active: true }
    ]} />);
    expect(html).toContain('Acesso da equipe');
    expect(html).toContain('Como funciona');
    expect(html).toContain('aceita o convite');
    expect(html.indexOf('Ana')).toBeLessThan(html.indexOf('Zeca'));
    expect(html).toContain('Inativo');
    expect(html).toContain('Ativo');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('barber-link-');
    expect(html).not.toContain('Vincular usuário');
    expect(html).not.toContain('Vínculo pendente');
  });
  it('keeps empty roster guidance', () => {
    const html = renderToStaticMarkup(<OwnerBarberProfileLinking role="owner" barbers={[]} />);
    expect(html).toContain('Nenhum profissional ativo.');
    expect(html).toContain('#management-catalog');
  });
  it.each(['barber', null, undefined] as const)('hides team management for %s', (role) => {
    expect(renderToStaticMarkup(<OwnerBarberProfileLinking role={role} barbers={[]} />)).toBe('');
  });
  it('preserves invitation email validation without the legacy repository', () => {
    expect(isBasicEmailValid(' Barber@Example.com ')).toBe(true);
    for (const email of [undefined, '', '   ', 'invalid', 'a b@example.com', 'a@b']) {
      expect(isBasicEmailValid(email)).toBe(false);
    }
  });
});
