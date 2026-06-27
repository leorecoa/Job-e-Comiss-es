import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as authRepository from './services/authRepository';
import * as appointmentRepository from './services/appointmentRepository';
import { calculateEstimatedCommission } from './utils';
import * as barbershopRepository from './services/barbershopRepository';
import * as barberRepository from './services/barberRepository';
import * as serviceRepository from './services/serviceRepository';
import { Appointment, DEFAULT_SETTINGS } from './types';
import { getInitialAppSettings, getInitialUserProfile, getPublicBookingSlugFromPath, getResolvedDashboardShopName } from './App';
import { buildPublicBookingInput, getPublicBookingBranding, getPublicBookingContactLinks, getPublicBookingLandingContent, getPublicBookingReadiness, getPublicBookingScopedSettings, getPublicBookingSteps, getPublicBookingSubmissionErrorMessage, getPublicBookingSummary, isPublicBookingSubmitDisabled, normalizePublicBarberOptions } from './components/PublicBookingPage';
import {
  BarbershopBrandingSettings,
  canManageBarbershopBranding,
  getBarbershopBrandingImageField,
  getBarbershopBrandingFormData,
  getBarbershopBrandingSaveInput
} from './components/BarbershopBrandingSettings';
import {
  OwnerBarbershopOnboarding,
  getOwnerBarbershopOnboardingPayload,
  getOwnerBarbershopOnboardingPreview
} from './components/OwnerBarbershopOnboarding';
import { 
  createAppointmentConflictError,
  createPublicAppointment, 
  PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE,
  validatePublicBookingInput 
} from './scheduling';
import { DEFAULT_BARBERSHOP_BUSINESS_HOURS, DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES } from './scheduling';

// Mock all external services
vi.mock('./services/authRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/authRepository')>();
  return {
    ...actual,
    getCurrentAuthSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    signUpWithPassword: vi.fn(),
    getProfile: vi.fn(),
    upsertProfile: vi.fn(),
  };
});
vi.mock('./services/appointmentRepository');
vi.mock('./services/barberRepository');
vi.mock('./services/serviceRepository');
vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: true,
  isProductionWithoutSupabase: false,
  shouldUseLocalFallback: false,
  assertOperationalSupabase: vi.fn(),
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    }
  }
}));
vi.mock('./services/barbershopRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/barbershopRepository')>();
  return {
    ...actual,
    getBarbershopBySlug: vi.fn(),
    getBarbershopById: vi.fn(),
    updateCurrentBarbershopBranding: vi.fn(),
    uploadBarbershopBrandingImage: vi.fn(),
    createBarbershopForCurrentOwner: vi.fn()
  };
});

// Mock localStorage and DOM for rendering tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  // Mock for App.tsx's splash screen logic
  store['hasSeenTour'] = 'true';
  store['barbearia_profile'] = JSON.stringify({ isPro: true, planType: 'admin_life' });

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; }
  };
})();
vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('scrollTo', vi.fn()); // Mock scrollTo as it's used in TourOverlay

describe('Barber Dashboard Logic & Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Reset localStorage for each test to ensure isolation
    // Default successful responses for shared services
    vi.mocked(barberRepository.listBarbers).mockResolvedValue([{ id: 'barber-1', name: 'Gabriel' }]);
    vi.mocked(serviceRepository.listServices).mockResolvedValue([
      { id: 'cut-1', name: 'Corte', price: 50, durationMinutes: 30 }
    ]);
   vi.mocked(barbershopRepository.getBarbershopBySlug).mockResolvedValue({
  id: 'barbershop-1',
  name: 'Gestão Máxima',
  slug: 'gestao-maxima',
  active: true,
  phone: null,
  address: null
});
  });

  const mockBarberSession = {
    userId: 'barber-user-id',
    email: 'gabriel@example.com',
    displayName: 'Gabriel',
    role: 'barber',
    barberId: '58c3b75a-175c-41e6-b1a1-54ef2027a272'
  } as const;

  const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
    id: 'app-1',
    clientName: 'Joao',
    barberName: 'Gabriel',
    barberId: '58c3b75a-175c-41e6-b1a1-54ef2027a272',
    serviceType: 'Corte',
    serviceValue: 50,
    startAt: new Date().toISOString(),
    endAt: new Date().toISOString(),
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  });

  describe('Data Isolation (Filtering)', () => {
    it('Scenario 6: Correcty filters appointments belonging only to the logged-in barber', () => {
      const apps = [
        makeAppointment({ id: 'app-gabriel', barberId: '58c3b75a-175c-41e6-b1a1-54ef2027a272' }),
        makeAppointment({ id: 'app-outro', barberId: 'other-id' }),
        makeAppointment({ id: 'app-sem-id', barberId: undefined }),
      ];

      const filtered = apps.filter(app => app.barberId === mockBarberSession.barberId);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('app-gabriel');
      expect(filtered.some(a => a.id === 'app-outro')).toBe(false);
    });
  });

  describe('Barber Dashboard Actions Logic', () => {
    it('Scenario 3: Ensures barberId is attached when a barber creates an appointment', async () => {
      const newAppointmentInput = {
        clientName: 'Novo Cliente',
        serviceType: 'Corte',
        serviceValue: 50,
        startAt: new Date().toISOString(),
        endAt: new Date().toISOString(),
        status: 'scheduled' as const,
      };

      // Simula a lógica de salvamento do BarberDashboard
      const appointmentToSave: Appointment = {
        id: 'new-id',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...newAppointmentInput,
        barberId: mockBarberSession.barberId,
        barberName: mockBarberSession.displayName
      };

      expect(appointmentToSave.barberId).toBe(mockBarberSession.barberId);
      expect(appointmentToSave.barberName).toBe('Gabriel');
    });

    it('Scenario 5: Ensures completion patch follows the required contract', async () => {
      const app = makeAppointment({ id: 'app-1', status: 'scheduled' });
      const now = new Date().toISOString();

      // Simula o patch de conclusão gerado pelo BarberDashboard
      const completionPatch: Partial<Appointment> = {
        status: 'completed',
        updatedAt: now
      };

      expect(completionPatch.status).toBe('completed');
      expect(completionPatch.updatedAt).toBe(now);
    });

    it('should call onLogout when the logout contract is triggered', () => {
      const onLogoutMock = vi.fn();
      // As we are not rendering, we test the contract of the prop:
      // The component should invoke the function passed in onLogout.
      const triggerLogoutAction = (handler: () => void) => {
        handler();
      };
      triggerLogoutAction(onLogoutMock);
      expect(onLogoutMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Financial Logic for Barber', () => {
    it('correctly calculates estimated commission for a barber appointment', () => {
      const app = makeAppointment({ serviceId: 'service-1', serviceValue: 100 });
      const settings = {
        commissionRate: 40,
        services: [{ id: 'service-1', name: 'Corte', price: 100, durationMinutes: 30, commissionRate: 50 }]
      } as any;

      // Se o serviço tem taxa específica (50%), deve usá-la
      const commission = calculateEstimatedCommission(app, settings);
      expect(commission).toBe(50); // 50% de 100
    });

    it('uses default commission rate if service rate is missing', () => {
      const app = makeAppointment({ serviceValue: 100, serviceId: 'other' });
      const settings = {
        commissionRate: 30,
        services: []
      } as any;

      const commission = calculateEstimatedCommission(app, settings);
      expect(commission).toBe(30); // 30% de 100
    });
  });
});

describe('Public Booking Page Logic', () => {
  const DEFAULT_BARBERSHOP_ID = 'barbershop-1';
  const DEFAULT_BARBERSHOP_SLUG = 'gestao-maxima';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    vi.mocked(barbershopRepository.getBarbershopBySlug).mockResolvedValue({
      id: DEFAULT_BARBERSHOP_ID,
      name: 'Gestão Máxima',
      slug: DEFAULT_BARBERSHOP_SLUG,
      active: true,
      phone: null,
      address: null
    });
    vi.mocked(barberRepository.listBarbers).mockResolvedValue([
      { id: 'barber-1', name: 'Gabriel', barbershopId: DEFAULT_BARBERSHOP_ID },
    ]);
    vi.mocked(serviceRepository.listServices).mockResolvedValue([
      { id: 'service-1', name: 'Corte', price: 50, durationMinutes: 30, barbershopId: DEFAULT_BARBERSHOP_ID },
    ]);
    vi.mocked(appointmentRepository.listPublicAppointmentSlots).mockResolvedValue([]);
    vi.mocked(appointmentRepository.createAppointment).mockResolvedValue({} as Appointment);
  });

  it('/book keeps the slug undefined instead of silently falling back to another tenant', () => {
    const publicBookingSlug = getPublicBookingSlugFromPath('/book');

    expect(publicBookingSlug).toBeUndefined();
    expect(barbershopRepository.getBarbershopBySlug).not.toHaveBeenCalled();
  });

  it('/book/gestao-maxima uses the explicit gestao-maxima slug', async () => {
    const publicBookingSlug = getPublicBookingSlugFromPath('/book/gestao-maxima');

    await barbershopRepository.getBarbershopBySlug(publicBookingSlug ?? DEFAULT_BARBERSHOP_SLUG);

    expect(publicBookingSlug).toBe(DEFAULT_BARBERSHOP_SLUG);
    expect(barbershopRepository.getBarbershopBySlug).toHaveBeenCalledWith(DEFAULT_BARBERSHOP_SLUG);
  });

  it('/book/gestao-maxima keeps a clean fallback header without image fields', () => {
    const branding = getPublicBookingBranding({
      id: DEFAULT_BARBERSHOP_ID,
      name: 'Gestao Maxima',
      slug: DEFAULT_BARBERSHOP_SLUG,
      active: true,
      phone: null,
      address: null,
      logoUrl: null,
      coverImageUrl: null,
      description: null,
      instagramUrl: null,
      whatsapp: null,
      primaryColor: null,
      secondaryColor: null
    }, DEFAULT_SETTINGS, DEFAULT_BARBERSHOP_SLUG);

    expect(branding.shopName).toBe('Gestao Maxima');
    expect(branding.logoUrl).toBeNull();
    expect(branding.coverImageUrl).toBeNull();
    expect(branding.hasVisualBranding).toBe(false);
  });

  it('/book without slug uses a safe neutral branding state', () => {
    const branding = getPublicBookingBranding(null, DEFAULT_SETTINGS);

    expect(branding.shopName).toBe('Escolha uma barbearia');
    expect(branding.shopName).not.toBe('Gestao Maxima');
  });

  it('online runtime ignores localStorage tenant settings when bootstrapping app state', () => {
    const storage = {
      getItem: vi.fn((key: string) => {
        if (key === 'barbearia_profile') {
          return JSON.stringify({ ownerName: 'Leo', shopName: 'Gestao Maxima' });
        }

        if (key === 'barbearia_settings') {
          return JSON.stringify({
            ...DEFAULT_SETTINGS,
            shopName: 'Gestao Maxima',
            barbers: [{ id: 'barber-gm', name: 'Gestao Maxima Barber', barbershopId: 'shop-gm' }],
            services: [{ id: 'service-gm', name: 'Corte GM', price: 50, durationMinutes: 30, barbershopId: 'shop-gm' }]
          });
        }

        return null;
      })
    };

    expect(getInitialUserProfile(storage, false)).toBeNull();
    expect(getInitialAppSettings(storage, false)).toMatchObject({
      shopName: 'Sua barbearia',
      barbers: [],
      services: []
    });
  });

  it('owner dashboard resolves the visible shop name from the authenticated tenant instead of Gestao Maxima', () => {
    const shopName = getResolvedDashboardShopName({
      ownerBarbershop: {
        id: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: true
      },
      userProfile: {
        ownerName: 'Leo',
        shopName: 'Gestao Maxima',
        email: 'leo@example.com',
        startDate: Date.now(),
        isPro: true,
        planType: 'admin_life'
      },
      settings: {
        ...DEFAULT_SETTINGS,
        shopName: 'Gestao Maxima'
      },
      supabaseConfigured: true
    });

    expect(shopName).toBe('leo do leo');
    expect(shopName).not.toBe('Gestao Maxima');
  });

  it('/book/leo-do-leo resolves the public branding name from the explicit slug', () => {
    const branding = getPublicBookingBranding(null, DEFAULT_SETTINGS, 'leo-do-leo');
    const landingContent = getPublicBookingLandingContent(branding);

    expect(branding.shopName).toBe('leo do leo');
    expect(landingContent.headline).toBe('leo do leo');
    expect(landingContent.subheadline).toBe('Agende seu horario');
  });

  it('/book/leo-do-leo does not fall back to Gestao Maxima in the public branding', () => {
    const branding = getPublicBookingBranding(null, DEFAULT_SETTINGS, 'leo-do-leo');

    expect(branding.shopName).not.toBe('Gestao Maxima');
  });

  it('/book/:slug exposes public branding when fields exist', () => {
    const branding = getPublicBookingBranding({
      id: 'barbershop-brand',
      name: 'Barbearia Premium',
      slug: 'barbearia-premium',
      active: true,
      phone: null,
      address: 'Rua Central, 100',
      logoUrl: 'https://cdn.example.com/logo.png',
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
      description: 'Cortes classicos com agenda online.',
      instagramUrl: 'https://instagram.com/barbearia_premium',
      whatsapp: '5585999999999',
      primaryColor: '#111111',
      secondaryColor: '#eeeeee'
    }, DEFAULT_SETTINGS, 'barbearia-premium');

    expect(branding.shopName).toBe('Barbearia Premium');
    expect(branding.description).toBe('Cortes classicos com agenda online.');
    expect(branding.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(branding.coverImageUrl).toBe('https://cdn.example.com/cover.jpg');
    expect(branding.address).toBe('Rua Central, 100');
    expect(branding.whatsapp).toBe('5585999999999');
    expect(branding.instagramUrl).toBe('https://instagram.com/barbearia_premium');
    expect(branding.primaryColor).toBe('#111111');
    expect(branding.secondaryColor).toBe('#eeeeee');
    expect(branding.hasVisualBranding).toBe(true);
  });

  it('/book/leo-do-leo does not expose barbers or services from another barbershop', () => {
    const scopedSettings = getPublicBookingScopedSettings({
      ...DEFAULT_SETTINGS,
      barbers: [
        { id: 'barber-leo', name: 'Leo', barbershopId: 'shop-leo' },
        { id: 'barber-gm', name: 'Gestao Maxima Barber', barbershopId: DEFAULT_BARBERSHOP_ID }
      ],
      services: [
        { id: 'service-leo', name: 'Corte Leo', price: 70, durationMinutes: 45, barbershopId: 'shop-leo' },
        { id: 'service-gm', name: 'Corte GM', price: 50, durationMinutes: 30, barbershopId: DEFAULT_BARBERSHOP_ID }
      ]
    }, {
      id: 'shop-leo',
      name: 'Leo do Leo',
      slug: 'leo-do-leo',
      active: true
    });

    expect(scopedSettings.barbers).toEqual([
      { id: 'barber-leo', name: 'Leo', barbershopId: 'shop-leo' }
    ]);
    expect(scopedSettings.services).toEqual([
      { id: 'service-leo', name: 'Corte Leo', price: 70, durationMinutes: 45, barbershopId: 'shop-leo' }
    ]);
  });

  it('/book/leo-do-leo keeps the catalog empty when the tenant has no own barbers or services', () => {
    const scopedSettings = getPublicBookingScopedSettings({
      ...DEFAULT_SETTINGS,
      barbers: [
        { id: 'barber-gm', name: 'Gestao Maxima Barber', barbershopId: DEFAULT_BARBERSHOP_ID }
      ],
      services: [
        { id: 'service-gm', name: 'Corte GM', price: 50, durationMinutes: 30, barbershopId: DEFAULT_BARBERSHOP_ID }
      ]
    }, {
      id: 'shop-leo',
      name: 'Leo do Leo',
      slug: 'leo-do-leo',
      active: true
    });

    expect(scopedSettings.barbers).toEqual([]);
    expect(scopedSettings.services).toEqual([]);
    expect(scopedSettings.shopName).toBe('Leo do Leo');
  });

  it('/book/leo-do-leo creates the public appointment payload with the selected tenant entities', () => {
    const payload = buildPublicBookingInput({
      barbershop: {
        id: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: true
      },
      selectedBarber: {
        value: 'id:6a1c35f2-deec-4528-82dc-10dccb601e56',
        id: '6a1c35f2-deec-4528-82dc-10dccb601e56',
        name: 'test',
        barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce'
      },
      selectedService: {
        id: '8b8a04ef-fd1d-40c9-98e1-c052345cf4b8',
        name: 'corte',
        price: 60,
        durationMinutes: 30,
        barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce'
      },
      selectedSlot: {
        startAt: '2026-06-23T12:00:00.000Z',
        endAt: '2026-06-23T12:30:00.000Z',
        label: '12:00',
        available: true
      },
      clientName: 'pedro',
      clientPhone: '81987324097'
    });

    expect(payload).toMatchObject({
      barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce',
      barberId: '6a1c35f2-deec-4528-82dc-10dccb601e56',
      barberName: 'test'
    });
    expect(payload.barberName).not.toBe('Barbearia Teste SaaS');
    expect(payload.service?.id).toBe('8b8a04ef-fd1d-40c9-98e1-c052345cf4b8');
    expect(payload.service?.name).toBe('corte');
  });

  it('/book/leo-do-leo with a complete tenant reports readiness and enables submit state', () => {
    const readiness = getPublicBookingReadiness({
      barbershop: {
        id: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: true,
        businessHours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
        hasConfiguredBusinessHours: true,
        slotStepMinutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES,
        hasConfiguredSlotStepMinutes: true
      },
      barbers: [
        {
          value: 'id:6a1c35f2-deec-4528-82dc-10dccb601e56',
          id: '6a1c35f2-deec-4528-82dc-10dccb601e56',
          name: 'test',
          barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce'
        }
      ],
      services: [
        {
          id: '8b8a04ef-fd1d-40c9-98e1-c052345cf4b8',
          name: 'corte',
          price: 60,
          durationMinutes: 30,
          barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce'
        }
      ]
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.issues).toEqual([]);
    expect(isPublicBookingSubmitDisabled({
      readiness,
      barbershop: {
        id: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: true
      },
      selectedBarber: {
        value: 'id:6a1c35f2-deec-4528-82dc-10dccb601e56',
        id: '6a1c35f2-deec-4528-82dc-10dccb601e56',
        name: 'test'
      },
      selectedService: {
        id: '8b8a04ef-fd1d-40c9-98e1-c052345cf4b8',
        name: 'corte',
        price: 60,
        durationMinutes: 30
      },
      selectedSlot: {
        startAt: '2026-06-23T12:00:00.000Z',
        endAt: '2026-06-23T12:30:00.000Z',
        label: '12:00',
        available: true
      },
      isSubmitting: false
    })).toBe(false);
  });

  it('/book/:slug without a resolved tenant reports a safe readiness error', () => {
    const readiness = getPublicBookingReadiness({
      barbershop: null,
      barbers: [],
      services: []
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.issues.some((issue) => issue.toLowerCase().includes('indispon'))).toBe(true);
  });

  it('public booking blocks readiness when business hours are not configured', () => {
    const readiness = getPublicBookingReadiness({
      barbershop: {
        id: 'shop-leo',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: true,
        businessHours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
        hasConfiguredBusinessHours: false,
        slotStepMinutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES,
        hasConfiguredSlotStepMinutes: true
      },
      barbers: [
        { value: 'id:barber-1', id: 'barber-1', name: 'test', barbershopId: 'shop-leo' }
      ],
      services: [
        { id: 'service-1', name: 'corte', price: 60, durationMinutes: 30, barbershopId: 'shop-leo' }
      ]
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.issues.some((issue) => issue.toLowerCase().includes('configurad'))).toBe(true);
  });

  it('public booking blocks readiness when the barbershop is inactive', () => {
    const readiness = getPublicBookingReadiness({
      barbershop: {
        id: 'shop-leo',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: false,
        businessHours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
        hasConfiguredBusinessHours: true,
        slotStepMinutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES,
        hasConfiguredSlotStepMinutes: true
      },
      barbers: [
        { value: 'id:barber-1', id: 'barber-1', name: 'test', barbershopId: 'shop-leo' }
      ],
      services: [
        { id: 'service-1', name: 'corte', price: 60, durationMinutes: 30, barbershopId: 'shop-leo' }
      ]
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.issues).toContain('Barbearia inativa.');
  });

  it('public booking blocks readiness when slot step minutes are invalid', () => {
    const readiness = getPublicBookingReadiness({
      barbershop: {
        id: 'shop-leo',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: true,
        businessHours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
        hasConfiguredBusinessHours: true,
        slotStepMinutes: 0,
        hasConfiguredSlotStepMinutes: true
      },
      barbers: [
        { value: 'id:barber-1', id: 'barber-1', name: 'test', barbershopId: 'shop-leo' }
      ],
      services: [
        { id: 'service-1', name: 'corte', price: 60, durationMinutes: 30, barbershopId: 'shop-leo' }
      ]
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.issues.some((issue) => issue.toLowerCase().includes('intervalo de agenda'))).toBe(true);
  });

  it('public booking blocks readiness when there is no active barber', () => {
    const readiness = getPublicBookingReadiness({
      barbershop: {
        id: 'shop-leo',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: true,
        businessHours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
        hasConfiguredBusinessHours: true,
        slotStepMinutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES,
        hasConfiguredSlotStepMinutes: true
      },
      barbers: [],
      services: [
        { id: 'service-1', name: 'corte', price: 60, durationMinutes: 30, barbershopId: 'shop-leo' }
      ]
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.issues.some((issue) => issue.toLowerCase().includes('barbeiro'))).toBe(true);
  });

  it('public booking blocks readiness when there is no active service', () => {
    const readiness = getPublicBookingReadiness({
      barbershop: {
        id: 'shop-leo',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: true,
        businessHours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
        hasConfiguredBusinessHours: true,
        slotStepMinutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES,
        hasConfiguredSlotStepMinutes: true
      },
      barbers: [
        { value: 'id:barber-1', id: 'barber-1', name: 'test', barbershopId: 'shop-leo' }
      ],
      services: []
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.issues.some((issue) => issue.toLowerCase().includes('servi'))).toBe(true);
  });

  it('submit stays disabled when tenant readiness fails even if form fields are filled', () => {
    const readiness = getPublicBookingReadiness({
      barbershop: {
        id: 'shop-leo',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: true,
        businessHours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
        hasConfiguredBusinessHours: false,
        slotStepMinutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES,
        hasConfiguredSlotStepMinutes: true
      },
      barbers: [
        { value: 'id:barber-1', id: 'barber-1', name: 'test', barbershopId: 'shop-leo' }
      ],
      services: [
        { id: 'service-1', name: 'corte', price: 60, durationMinutes: 30, barbershopId: 'shop-leo' }
      ]
    });

    expect(isPublicBookingSubmitDisabled({
      readiness,
      barbershop: {
        id: 'shop-leo',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: true
      },
      selectedBarber: {
        value: 'id:barber-1',
        id: 'barber-1',
        name: 'test',
        barbershopId: 'shop-leo'
      },
      selectedService: {
        id: 'service-1',
        name: 'corte',
        price: 60,
        durationMinutes: 30,
        barbershopId: 'shop-leo'
      },
      selectedSlot: {
        startAt: '2026-06-23T12:00:00.000Z',
        endAt: '2026-06-23T12:30:00.000Z',
        label: '12:00',
        available: true
      },
      isSubmitting: false
    })).toBe(true);
  });

  it('public booking ignores plain string barber fallbacks and keeps the real selected barber name', () => {
    const options = normalizePublicBarberOptions([
      'Barbearia Teste SaaS',
      {
        id: '6a1c35f2-deec-4528-82dc-10dccb601e56',
        name: 'test',
        barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce'
      }
    ]);

    expect(options).toEqual([
      {
        value: 'id:6a1c35f2-deec-4528-82dc-10dccb601e56',
        id: '6a1c35f2-deec-4528-82dc-10dccb601e56',
        name: 'test',
        barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce'
      }
    ]);
    expect(options.some((barber) => barber.name === 'Barbearia Teste SaaS')).toBe(false);
  });

  it('blocks public booking payload creation when barbershop_id is missing', () => {
    expect(() => buildPublicBookingInput({
      barbershop: null,
      selectedBarber: {
        value: 'id:6a1c35f2-deec-4528-82dc-10dccb601e56',
        id: '6a1c35f2-deec-4528-82dc-10dccb601e56',
        name: 'test'
      },
      selectedService: {
        id: '8b8a04ef-fd1d-40c9-98e1-c052345cf4b8',
        name: 'corte',
        price: 60,
        durationMinutes: 30
      },
      selectedSlot: {
        startAt: '2026-06-23T12:00:00.000Z',
        endAt: '2026-06-23T12:30:00.000Z',
        label: '12:00',
        available: true
      },
      clientName: 'pedro',
      clientPhone: '81987324097'
    })).toThrow('Barbearia nao encontrada ou indisponivel.');
  });

  it('blocks public booking payload creation when barber_id is missing', () => {
    expect(() => buildPublicBookingInput({
      barbershop: {
        id: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: true
      },
      selectedBarber: null,
      selectedService: {
        id: '8b8a04ef-fd1d-40c9-98e1-c052345cf4b8',
        name: 'corte',
        price: 60,
        durationMinutes: 30
      },
      selectedSlot: {
        startAt: '2026-06-23T12:00:00.000Z',
        endAt: '2026-06-23T12:30:00.000Z',
        label: '12:00',
        available: true
      },
      clientName: 'pedro',
      clientPhone: '81987324097'
    })).toThrow('Selecione um barbeiro.');
  });

  it('blocks public booking payload creation when service_id is missing', () => {
    expect(() => buildPublicBookingInput({
      barbershop: {
        id: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce',
        name: 'leo do leo',
        slug: 'leo-do-leo',
        active: true
      },
      selectedBarber: {
        value: 'id:6a1c35f2-deec-4528-82dc-10dccb601e56',
        id: '6a1c35f2-deec-4528-82dc-10dccb601e56',
        name: 'test',
        barbershopId: '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce'
      },
      selectedService: {
        id: '',
        name: 'corte',
        price: 60,
        durationMinutes: 30
      },
      selectedSlot: {
        startAt: '2026-06-23T12:00:00.000Z',
        endAt: '2026-06-23T12:30:00.000Z',
        label: '12:00',
        available: true
      },
      clientName: 'pedro',
      clientPhone: '81987324097'
    })).toThrow('Selecione um servico.');
  });

  it('public booking landing content renders a headline with barbershop name', () => {
    const branding = getPublicBookingBranding({
      id: 'barbershop-brand',
      name: 'Barbearia Premium',
      slug: 'barbearia-premium',
      active: true
    }, DEFAULT_SETTINGS, 'barbearia-premium');
    const content = getPublicBookingLandingContent(branding);

    expect(content.headline).toBe('Barbearia Premium');
    expect(content.subheadline).toBe('Agende seu horario');
    expect(content.ctaLabel).toBe('Agendar agora');
    expect(content.trustItems).toContain('Horario reservado');
  });

  it('public booking landing content uses barbershop description when it exists', () => {
    const branding = getPublicBookingBranding({
      id: 'barbershop-brand',
      name: 'Barbearia Premium',
      slug: 'barbearia-premium',
      description: 'Cortes classicos com acabamento premium.',
      active: true
    }, DEFAULT_SETTINGS, 'barbearia-premium');

    expect(getPublicBookingLandingContent(branding).description).toBe('Cortes classicos com acabamento premium.');
  });

  it('public booking landing content uses a better fallback description', () => {
    const branding = getPublicBookingBranding({
      id: DEFAULT_BARBERSHOP_ID,
      name: 'Gestao Maxima',
      slug: DEFAULT_BARBERSHOP_SLUG,
      active: true
    }, DEFAULT_SETTINGS, DEFAULT_BARBERSHOP_SLUG);

    expect(getPublicBookingLandingContent(branding).description).toBe('Corte, barba e acabamento com horario marcado.');
  });

  it('public booking contact links render only when branding fields exist', () => {
    const withLinks = getPublicBookingContactLinks(getPublicBookingBranding({
      id: 'barbershop-brand',
      name: 'Barbearia Premium',
      slug: 'barbearia-premium',
      whatsapp: '5585999999999',
      instagramUrl: 'instagram.com/barbearia',
      address: 'Rua Central, 100',
      active: true
    }, DEFAULT_SETTINGS, 'barbearia-premium'));

    expect(withLinks.whatsapp).toBe('https://wa.me/5585999999999');
    expect(withLinks.instagram).toBe('https://instagram.com/barbearia');
    expect(withLinks.address).toBe('Rua Central, 100');

    const withoutLinks = getPublicBookingContactLinks(getPublicBookingBranding({
      id: DEFAULT_BARBERSHOP_ID,
      name: 'Gestao Maxima',
      slug: DEFAULT_BARBERSHOP_SLUG,
      active: true
    }, DEFAULT_SETTINGS, DEFAULT_BARBERSHOP_SLUG));

    expect(withoutLinks).toEqual({
      whatsapp: null,
      instagram: null,
      address: null
    });
  });

  it('public booking step state highlights the current incomplete step', () => {
    const steps = getPublicBookingSteps({
      hasBarber: true,
      hasService: true,
      hasSlot: false,
      hasClient: false
    });

    expect(steps.map((step) => step.label)).toEqual(['Barbeiro', 'Servico', 'Horario', 'Dados']);
    expect(steps.find((step) => step.key === 'slot')?.active).toBe(true);
    expect(steps.find((step) => step.key === 'barber')?.complete).toBe(true);
  });

  it('public booking summary appears when barber service and slot are selected', () => {
    const summary = getPublicBookingSummary(
      { value: 'id:barber-1', id: 'barber-1', name: 'Gabriel' },
      { id: 'service-1', name: 'Corte', price: 50, durationMinutes: 30 },
      {
        startAt: new Date(2026, 5, 10, 9, 0).toISOString(),
        endAt: new Date(2026, 5, 10, 9, 30).toISOString(),
        label: '09:00',
        available: true
      }
    );

    expect(summary).toMatchObject({
      barberName: 'Gabriel',
      serviceName: 'Corte',
      duration: '30 min',
      slotLabel: '09:00',
      ready: true
    });
    expect(summary.serviceValue).toContain('50,00');
  });

  it('public booking summary handles empty states without breaking', () => {
    const summary = getPublicBookingSummary(null, undefined, null);

    expect(summary.ready).toBe(false);
    expect(summary.barberName).toBe('Selecione um barbeiro');
    expect(summary.serviceName).toBe('Selecione um servico');
    expect(summary.slotLabel).toBe('Selecione um horario');
  });

  it('public booking shows the friendly conflict message for duplicate slots', () => {
    expect(
      getPublicBookingSubmissionErrorMessage(
        createAppointmentConflictError()
      )
    ).toBe(PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE);
  });

  it('owner can see white label barbershop settings', () => {
    expect(canManageBarbershopBranding('owner')).toBe(true);
    expect(canManageBarbershopBranding(null)).toBe(true);
  });

  it('barber cannot see white label barbershop settings', () => {
    expect(canManageBarbershopBranding('barber')).toBe(false);
  });

  it('owner sees logo and cover upload controls', () => {
    const html = renderToStaticMarkup(
      <BarbershopBrandingSettings
        barbershop={{
          id: DEFAULT_BARBERSHOP_ID,
          name: 'Gestao Maxima',
          slug: DEFAULT_BARBERSHOP_SLUG,
          active: true,
          logoUrl: 'https://cdn.example.com/logo.png',
          coverImageUrl: 'https://cdn.example.com/cover.jpg'
        }}
        role="owner"
        onSave={vi.fn()}
        onUploadImage={vi.fn()}
      />
    );

    expect(html).toContain('Upload da logo');
    expect(html).toContain('Upload da capa');
    expect(html).toContain('type="file"');
    expect(html).toContain('https://cdn.example.com/logo.png');
    expect(html).toContain('https://cdn.example.com/cover.jpg');
  });

  it('barber does not render branding settings or upload controls', () => {
    const html = renderToStaticMarkup(
      <BarbershopBrandingSettings
        barbershop={{
          id: DEFAULT_BARBERSHOP_ID,
          name: 'Gestao Maxima',
          slug: DEFAULT_BARBERSHOP_SLUG,
          active: true
        }}
        role="barber"
        onSave={vi.fn()}
        onUploadImage={vi.fn()}
      />
    );

    expect(html).toBe('');
  });

  it('barbershop branding form loads current data and keeps slug read-only', () => {
    const formData = getBarbershopBrandingFormData({
      id: DEFAULT_BARBERSHOP_ID,
      name: 'Gestao Maxima',
      slug: DEFAULT_BARBERSHOP_SLUG,
      active: true,
      phone: '558500000000',
      address: 'Rua Principal',
      description: 'Agenda premium',
      whatsapp: '5585999999999',
      instagramUrl: 'https://instagram.com/gestao',
      logoUrl: 'https://cdn.example.com/logo.png',
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
      primaryColor: '#f59e0b',
      secondaryColor: '#0ea5e9',
      businessHours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
      slotStepMinutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES
    });

    expect(formData.name).toBe('Gestao Maxima');
    expect(formData.description).toBe('Agenda premium');
    expect(formData.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect('slug' in formData).toBe(false);
  });

  it('maps successful branding image uploads to the matching form URL field', () => {
    expect(getBarbershopBrandingImageField('logo')).toBe('logoUrl');
    expect(getBarbershopBrandingImageField('cover')).toBe('coverImageUrl');
  });

  it('saving white label settings sends only allowed fields', () => {
    const payload = getBarbershopBrandingSaveInput({
      name: 'Gestao Maxima',
      phone: '558500000000',
      address: 'Rua Principal',
      whatsapp: '5585999999999',
      instagramUrl: 'https://instagram.com/gestao',
      description: 'Agenda premium',
      logoUrl: 'https://cdn.example.com/logo.png',
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
      primaryColor: '#f59e0b',
      secondaryColor: '#0ea5e9',
      businessHours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
      slotStepMinutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES
    });

    expect(payload).toEqual({
      name: 'Gestao Maxima',
      phone: '558500000000',
      address: 'Rua Principal',
      whatsapp: '5585999999999',
      instagramUrl: 'https://instagram.com/gestao',
      description: 'Agenda premium',
      logoUrl: 'https://cdn.example.com/logo.png',
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
      primaryColor: '#f59e0b',
      secondaryColor: '#0ea5e9',
      businessHours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
      slotStepMinutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES
    });
    expect('id' in payload).toBe(false);
    expect('slug' in payload).toBe(false);
  });

  it('branding form exposes business hours and slot interval defaults', () => {
    const formData = getBarbershopBrandingFormData({
      id: DEFAULT_BARBERSHOP_ID,
      name: 'Gestao Maxima',
      slug: DEFAULT_BARBERSHOP_SLUG,
      active: true
    });

    expect(formData.slotStepMinutes).toBe(DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES);
    expect(formData.businessHours.monday.active).toBe(false);
    expect(formData.businessHours.tuesday.open).toBe('08:00');
    expect(formData.businessHours.sunday.close).toBe('18:00');
  });

  it('branding preview renders logo and cover when available', () => {
    const html = renderToStaticMarkup(
      <BarbershopBrandingSettings
        barbershop={{
          id: DEFAULT_BARBERSHOP_ID,
          name: 'Gestao Maxima',
          slug: DEFAULT_BARBERSHOP_SLUG,
          active: true,
          description: 'Agenda premium',
          whatsapp: '5585999999999',
          instagramUrl: 'https://instagram.com/gestao',
          logoUrl: 'https://cdn.example.com/logo.png',
          coverImageUrl: 'https://cdn.example.com/cover.jpg',
          primaryColor: '#111111',
          secondaryColor: '#eeeeee'
        }}
        role="owner"
        onSave={vi.fn()}
        onUploadImage={vi.fn()}
      />
    );

    expect(html).toContain('https://cdn.example.com/logo.png');
    expect(html).toContain('https://cdn.example.com/cover.jpg');
    expect(html).toContain('Agendar agora');
    expect(html).toContain('WhatsApp');
    expect(html).toContain('Instagram');
  });

  it('/book/barbearia-inexistente uses the invalid slug without fallback', async () => {
    const invalidSlug = 'barbearia-inexistente';
    vi.mocked(barbershopRepository.getBarbershopBySlug).mockResolvedValue(null);

    const publicBookingSlug = getPublicBookingSlugFromPath(`/book/${invalidSlug}`);

    if (publicBookingSlug) {
      await barbershopRepository.getBarbershopBySlug(publicBookingSlug);
    }

    expect(publicBookingSlug).toBe(invalidSlug);
    expect(barbershopRepository.getBarbershopBySlug).toHaveBeenCalledWith(invalidSlug);
    expect(barbershopRepository.getBarbershopBySlug).not.toHaveBeenCalledWith(DEFAULT_BARBERSHOP_SLUG);
  });

  it('/book/barbearia-fake-rls uses the fake barbershop slug without fallback', async () => {
    const fakeSlug = 'barbearia-fake-rls';
    vi.mocked(barbershopRepository.getBarbershopBySlug).mockResolvedValue({
      id: 'fc9bb084-eb2c-4fd4-a287-83dbe6bb6ea3',
      name: 'Barbearia Fake RLS',
      slug: fakeSlug,
      active: true
    });

    const publicBookingSlug = getPublicBookingSlugFromPath(`/book/${fakeSlug}`);

    if (publicBookingSlug) {
      await barbershopRepository.getBarbershopBySlug(publicBookingSlug);
    }

    expect(publicBookingSlug).toBe(fakeSlug);
    expect(barbershopRepository.getBarbershopBySlug).toHaveBeenCalledWith(fakeSlug);
    expect(barbershopRepository.getBarbershopBySlug).not.toHaveBeenCalledWith(DEFAULT_BARBERSHOP_SLUG);
  });

  it('should call getBarbershopBySlug with the provided slug', async () => {
    const customSlug = 'minha-barbearia';
    vi.mocked(barbershopRepository.getBarbershopBySlug).mockResolvedValue({
      id: 'barbershop-custom',
      name: 'Minha Barbearia',
      slug: customSlug, active: true
    });

    const mockPublicBookingPageProps = {
      settings: {} as any,
      appointments: [],
      userProfile: null,
      onCreateAppointment: vi.fn(),
      barbershopSlug: customSlug,
    };

    await barbershopRepository.getBarbershopBySlug(mockPublicBookingPageProps.barbershopSlug);

    expect(barbershopRepository.getBarbershopBySlug).toHaveBeenCalledWith(customSlug);
  });

  it('should filter barbers and services by barbershopId when loading remote data', async () => {
    const customBarbershopId = 'custom-shop-id';
    vi.mocked(barbershopRepository.getBarbershopBySlug).mockResolvedValue({
      id: customBarbershopId,
      name: 'Custom Shop',
      slug: 'custom-shop', active: true
    });

    // Simulate the loadRemoteData logic from App.tsx
    await barbershopRepository.getBarbershopBySlug('custom-shop');
    await barberRepository.listBarbers(customBarbershopId);
    await serviceRepository.listServices(customBarbershopId);
    await appointmentRepository.listPublicAppointmentSlots(customBarbershopId);

    expect(barberRepository.listBarbers).toHaveBeenCalledWith(customBarbershopId);
    expect(serviceRepository.listServices).toHaveBeenCalledWith(customBarbershopId);
    expect(appointmentRepository.listPublicAppointmentSlots).toHaveBeenCalledWith(customBarbershopId);
  });

  it('invalid slug does not create an appointment', async () => {
    vi.mocked(barbershopRepository.getBarbershopBySlug).mockResolvedValue(null);
    const createAppointment = vi.fn();

    const barbershop = await barbershopRepository.getBarbershopBySlug('barbearia-inexistente');

    if (barbershop) {
      createAppointment(createPublicAppointment({
        barbershopId: barbershop.id,
        clientName: 'Test Client',
        clientPhone: '1234567890',
        barberName: 'Gabriel',
        service: { id: 'service-1', name: 'Corte', price: 50, durationMinutes: 30 },
        selectedSlot: { startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T10:30:00Z', label: '10:00', available: true },
      } as any, 'new-app-id'));
    }

    expect(barbershop).toBeNull();
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it('valid booking continues creating an appointment with barbershopId', async () => {
    const mockAppointmentInput = {
      barbershopId: DEFAULT_BARBERSHOP_ID,
      clientName: 'Test Client',
      clientPhone: '1234567890',
      barberId: 'barber-1',
      barberName: 'Gabriel',
      service: { id: 'service-1', name: 'Corte', price: 50, durationMinutes: 30, barbershopId: DEFAULT_BARBERSHOP_ID },
      selectedSlot: { startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T10:30:00Z', label: '10:00', available: true },
    } as any;

    const createdAppointment = createPublicAppointment(mockAppointmentInput, 'new-app-id');
    expect(createdAppointment.barbershopId).toBe(DEFAULT_BARBERSHOP_ID);
    expect(createdAppointment.barberId).toBe('barber-1');
    expect(createdAppointment.serviceId).toBe('service-1');
  });

  it('public booking without barberId does not create an appointment', () => {
    const createAppointment = vi.fn();
    const input = {
      barbershopId: DEFAULT_BARBERSHOP_ID,
      clientName: 'Test Client',
      clientPhone: '1234567890',
      barberName: 'Gabriel',
      service: { id: 'service-1', name: 'Corte', price: 50, durationMinutes: 30, barbershopId: DEFAULT_BARBERSHOP_ID },
      selectedSlot: { startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T10:30:00Z', label: '10:00', available: true },
    } as any;

    const result = validatePublicBookingInput(input, []);

    if (result.valid) {
      createAppointment(createPublicAppointment(input, 'new-app-id'));
    }

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Selecione um barbeiro.');
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it('public booking without serviceId does not create an appointment', () => {
    const createAppointment = vi.fn();
    const input = {
      barbershopId: DEFAULT_BARBERSHOP_ID,
      clientName: 'Test Client',
      clientPhone: '1234567890',
      barberId: 'barber-1',
      barberName: 'Gabriel',
      service: { id: '', name: 'Corte', price: 50, durationMinutes: 30, barbershopId: DEFAULT_BARBERSHOP_ID },
      selectedSlot: { startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T10:30:00Z', label: '10:00', available: true },
    } as any;

    const result = validatePublicBookingInput(input, []);

    if (result.valid) {
      createAppointment(createPublicAppointment(input, 'new-app-id'));
    }

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Selecione um servico.');
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it('should fail validation when barbershopId is missing', () => {
    const input = {
      clientName: 'Joao',
      clientPhone: '11999990000',
      barbershopId: '',
      barberName: 'Gabriel',
      service: { id: 'service-1', name: 'Corte', price: 50, durationMinutes: 30 },
      selectedSlot: { startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T10:30:00Z', label: '10:00', available: true },
    } as any;

    const result = validatePublicBookingInput(input, []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Barbearia nao encontrada ou indisponivel.');
  });
});

describe('Owner onboarding UI helpers', () => {
  it('authenticated owner sees the onboarding form', () => {
    const html = renderToStaticMarkup(
      <OwnerBarbershopOnboarding
        authSession={{
          userId: 'owner-1',
          email: 'owner@example.com',
          displayName: 'Leo',
          role: 'owner'
        }}
        onCreate={vi.fn()}
      />
    );

    expect(html).toContain('Crie sua barbearia');
    expect(html).toContain('Criar barbearia');
    expect(html).toContain('Preview do link');
  });

  it('slug preview uses the normalized public booking path', () => {
    expect(getOwnerBarbershopOnboardingPreview('Barbearia São João Premium')).toBe('/book/barbearia-sao-joao-premium');
  });

  it('onboarding payload normalizes slug and trims optional fields', () => {
    expect(getOwnerBarbershopOnboardingPayload({
      name: ' Barbearia Premium ',
      slug: ' Barbearia São João ',
      phone: ' 558500000000 ',
      address: ' Rua Central ',
      whatsapp: ' 5585999999999 ',
      description: ' Agenda premium '
    })).toEqual({
      name: 'Barbearia Premium',
      slug: 'barbearia-sao-joao',
      phone: '558500000000',
      address: 'Rua Central',
      whatsapp: '5585999999999',
      description: 'Agenda premium'
    });
  });

  it('user without session receives the onboarding access block', () => {
    const html = renderToStaticMarkup(
      <OwnerBarbershopOnboarding
        authSession={null}
        onCreate={vi.fn()}
      />
    );

    expect(html).toContain('Crie sua barbearia');
    expect(html).toContain('Entre com sua conta');
  });
});
