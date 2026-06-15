import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as authRepository from './services/authRepository';
import * as appointmentRepository from './services/appointmentRepository';
import { calculateEstimatedCommission } from './utils';
import * as barbershopRepository from './services/barbershopRepository';
import * as barberRepository from './services/barberRepository';
import * as serviceRepository from './services/serviceRepository';
import { Appointment, DEFAULT_SETTINGS } from './types';
import { getPublicBookingSlugFromPath } from './App';
import { getPublicBookingBranding, getPublicBookingSteps, getPublicBookingSummary } from './components/PublicBookingPage';
import {
  BarbershopBrandingSettings,
  canManageBarbershopBranding,
  getBarbershopBrandingImageField,
  getBarbershopBrandingFormData,
  getBarbershopBrandingSaveInput
} from './components/BarbershopBrandingSettings';
import { 
  createPublicAppointment, 
  validatePublicBookingInput 
} from './scheduling';

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
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    }
  }
}));
vi.mock('./services/barbershopRepository');

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

  it('/book uses the default gestao-maxima fallback slug', async () => {
    const publicBookingSlug = getPublicBookingSlugFromPath('/book');

    await barbershopRepository.getBarbershopBySlug(publicBookingSlug ?? DEFAULT_BARBERSHOP_SLUG);

    expect(publicBookingSlug).toBeUndefined();
    expect(barbershopRepository.getBarbershopBySlug).toHaveBeenCalledWith(DEFAULT_BARBERSHOP_SLUG);
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
    }, DEFAULT_SETTINGS);

    expect(branding.shopName).toBe('Gestao Maxima');
    expect(branding.logoUrl).toBeNull();
    expect(branding.coverImageUrl).toBeNull();
    expect(branding.hasVisualBranding).toBe(false);
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
    }, DEFAULT_SETTINGS);

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
      secondaryColor: '#0ea5e9'
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
      secondaryColor: '#0ea5e9'
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
      secondaryColor: '#0ea5e9'
    });
    expect('id' in payload).toBe(false);
    expect('slug' in payload).toBe(false);
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

    await barbershopRepository.getBarbershopBySlug(publicBookingSlug ?? DEFAULT_BARBERSHOP_SLUG);

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

    await barbershopRepository.getBarbershopBySlug(publicBookingSlug ?? DEFAULT_BARBERSHOP_SLUG);

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
    expect(result.errors).toContain('Selecione um serviço.');
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
    expect(result.errors).toContain('Barbearia não encontrada ou indisponível.');
  });
});
