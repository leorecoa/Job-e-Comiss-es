import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OwnerSetupChecklist, getOwnerSetupChecklistState } from './components/OwnerSetupChecklist';
import { DEFAULT_BARBERSHOP_BUSINESS_HOURS, DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES } from './scheduling';
import { AuthSession } from './services/authRepository';
import { BarberOption, Barbershop, Service } from './types';

const makeAuthSession = (overrides: Partial<AuthSession> = {}): AuthSession => ({
  userId: 'owner-1',
  email: 'owner@example.com',
  role: 'owner',
  displayName: 'Leo',
  barbershopId: 'shop-1',
  ...overrides
});

const makeBarbershop = (overrides: Partial<Barbershop> = {}): Barbershop => ({
  id: 'shop-1',
  name: 'Leo do Leo',
  slug: 'leo-do-leo',
  active: true,
  businessHours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
  hasConfiguredBusinessHours: true,
  slotStepMinutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES,
  hasConfiguredSlotStepMinutes: true,
  ...overrides
});

const makeBarber = (overrides: Partial<BarberOption> = {}): BarberOption => ({
  id: 'barber-1',
  name: 'Leo',
  active: true,
  barbershopId: 'shop-1',
  ...overrides
});

const makeService = (overrides: Partial<Service> = {}): Service => ({
  id: 'service-1',
  name: 'Corte',
  price: 60,
  durationMinutes: 30,
  active: true,
  barbershopId: 'shop-1',
  ...overrides
});

describe('Owner setup checklist', () => {
  it('shows booking ready when the authenticated tenant is fully configured', () => {
    const state = getOwnerSetupChecklistState({
      authSession: makeAuthSession(),
      barbershop: makeBarbershop(),
      barbers: [makeBarber()],
      services: [makeService()]
    });

    expect(state.ready).toBe(true);
    expect(state.issues).toEqual([]);
    expect(state.publicBookingPath).toBe('/book/leo-do-leo');
    expect(state.items.every((item) => item.complete)).toBe(true);

    const html = renderToStaticMarkup(
      <OwnerSetupChecklist
        role="owner"
        authSession={makeAuthSession()}
        barbershop={makeBarbershop()}
        barbers={[makeBarber()]}
        services={[makeService()]}
      />
    );

    expect(html).toContain('Booking pronto para receber agendamentos.');
    expect(html).toContain('/book/leo-do-leo');
    expect(html).not.toContain('Proximo passo');
  });

  it('shows a pending state when there is no active barber for the current tenant', () => {
    const state = getOwnerSetupChecklistState({
      authSession: makeAuthSession(),
      barbershop: makeBarbershop(),
      barbers: [
        makeBarber({ id: 'barber-inactive', active: false }),
        makeBarber({ id: 'barber-other-tenant', active: true, barbershopId: 'shop-2' })
      ],
      services: [makeService()]
    });

    expect(state.ready).toBe(false);
    expect(state.issues).toContain('Nenhum barbeiro ativo.');
    expect(state.items.find((item) => item.key === 'active-barbers')?.complete).toBe(false);
    expect(state.items.find((item) => item.key === 'active-barbers')?.actionHref).toBe('#owner-catalog-manager');

    const html = renderToStaticMarkup(
      <OwnerSetupChecklist
        role="owner"
        authSession={makeAuthSession()}
        barbershop={makeBarbershop()}
        barbers={[makeBarber({ active: false })]}
        services={[makeService()]}
      />
    );

    expect(html).toContain('Proximo passo');
    expect(html).toContain('Cadastre ou ative pelo menos um barbeiro da sua barbearia.');
    expect(html).toContain('#owner-catalog-manager');
  });

  it('shows a pending state when there is no active service for the current tenant', () => {
    const state = getOwnerSetupChecklistState({
      authSession: makeAuthSession(),
      barbershop: makeBarbershop(),
      barbers: [makeBarber()],
      services: [
        makeService({ id: 'service-inactive', active: false }),
        makeService({ id: 'service-other-tenant', active: true, barbershopId: 'shop-2' })
      ]
    });

    expect(state.ready).toBe(false);
    expect(state.issues).toContain('Nenhum servico ativo.');
    expect(state.items.find((item) => item.key === 'active-services')?.complete).toBe(false);
    expect(state.items.find((item) => item.key === 'active-services')?.actionLabel).toBe('Configurar servicos');
  });

  it('shows a pending state when business hours are not configured', () => {
    const state = getOwnerSetupChecklistState({
      authSession: makeAuthSession(),
      barbershop: makeBarbershop({
        businessHours: null,
        hasConfiguredBusinessHours: false
      }),
      barbers: [makeBarber()],
      services: [makeService()]
    });

    expect(state.ready).toBe(false);
    expect(state.issues).toContain('Horarios de funcionamento nao configurados.');
    expect(state.items.find((item) => item.key === 'business-hours')?.actionHref).toBe('#owner-barbershop-settings');
  });

  it('shows a pending state when slot step minutes are invalid', () => {
    const state = getOwnerSetupChecklistState({
      authSession: makeAuthSession(),
      barbershop: makeBarbershop({
        slotStepMinutes: 0,
        hasConfiguredSlotStepMinutes: true
      }),
      barbers: [makeBarber()],
      services: [makeService()]
    });

    expect(state.ready).toBe(false);
    expect(state.issues).toContain('Intervalo de agenda invalido.');
    expect(state.items.find((item) => item.key === 'slot-step')?.nextStep).toBe('Escolha um intervalo valido de agenda.');
  });

  it('shows a pending state when the public slug is missing', () => {
    const state = getOwnerSetupChecklistState({
      authSession: makeAuthSession(),
      barbershop: makeBarbershop({ slug: '' }),
      barbers: [makeBarber()],
      services: [makeService()]
    });

    expect(state.ready).toBe(false);
    expect(state.publicBookingPath).toBeNull();
    expect(state.issues).toContain('Slug publico indisponivel.');
    expect(state.issues).toContain('Link publico de agendamento indisponivel.');
  });

  it('shows that an existing public link should not be promoted before setup is complete', () => {
    const html = renderToStaticMarkup(
      <OwnerSetupChecklist
        role="owner"
        authSession={makeAuthSession()}
        barbershop={makeBarbershop()}
        barbers={[]}
        services={[makeService()]}
      />
    );

    expect(html).toContain('/book/leo-do-leo');
    expect(html).toContain('O link ja existe, mas o booking ainda nao deve ser divulgado como operacional ate concluir as pendencias.');
  });

  it('does not render the checklist for barbers', () => {
    const html = renderToStaticMarkup(
      <OwnerSetupChecklist
        role="barber"
        authSession={makeAuthSession({ role: 'barber', barberId: 'barber-1' })}
        barbershop={makeBarbershop()}
        barbers={[makeBarber()]}
        services={[makeService()]}
      />
    );

    expect(html).toBe('');
  });

  it('uses the authenticated tenant instead of a global fallback', () => {
    const state = getOwnerSetupChecklistState({
      authSession: makeAuthSession({ barbershopId: 'shop-2' }),
      barbershop: makeBarbershop({ id: 'shop-1', slug: 'gestao-maxima' }),
      barbers: [makeBarber({ barbershopId: 'shop-1' })],
      services: [makeService({ barbershopId: 'shop-1' })]
    });

    expect(state.ready).toBe(false);
    expect(state.issues).toContain('Barbearia do tenant autenticado nao foi carregada.');
    expect(state.items.find((item) => item.key === 'barbershop-loaded')?.complete).toBe(false);
  });
});
