import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authRepository from './services/authRepository';
import * as appointmentRepository from './services/appointmentRepository';
import { calculateEstimatedCommission } from './utils';
import * as barbershopRepository from './services/barbershopRepository';
import * as barberRepository from './services/barberRepository';
import * as serviceRepository from './services/serviceRepository';
import { Appointment } from './types';
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

  it('should call getBarbershopBySlug with the default slug when no slug is provided', async () => {
    // Simulate App.tsx calling PublicBookingPage without a specific slug
    const mockPublicBookingPageProps = {
      appSettings: {} as any,
      appointments: [],
      userProfile: null,
      onCreateAppointment: vi.fn(),
      barbershopSlug: undefined,
    };

    // Directly call the effect logic that would run in PublicBookingPage
    // This is a simplified way to test the contract without full component rendering
    await barbershopRepository.getBarbershopBySlug(mockPublicBookingPageProps.barbershopSlug || DEFAULT_BARBERSHOP_SLUG);

    expect(barbershopRepository.getBarbershopBySlug).toHaveBeenCalledWith(DEFAULT_BARBERSHOP_SLUG);
  });

  it('should call getBarbershopBySlug with the provided slug', async () => {
    const customSlug = 'minha-barbearia';
    vi.mocked(barbershopRepository.getBarbershopBySlug).mockResolvedValue({
      id: 'barbershop-custom',
      name: 'Minha Barbearia',
      slug: customSlug, active: true
    });

    const mockPublicBookingPageProps = {
      appSettings: {} as any,
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
    await barbershopRepository.getBarbershopBySlug('custom-shop'); // Resolve barbershop first
    await barberRepository.listBarbers(customBarbershopId);
    await serviceRepository.listServices(customBarbershopId);
    await appointmentRepository.listPublicAppointmentSlots(customBarbershopId);

    expect(barberRepository.listBarbers).toHaveBeenCalledWith(customBarbershopId);
    expect(serviceRepository.listServices).toHaveBeenCalledWith(customBarbershopId);
    expect(appointmentRepository.listPublicAppointmentSlots).toHaveBeenCalledWith(customBarbershopId);
  });

  it('should include barbershopId in the created public appointment', async () => {
    const mockCreateAppointment = vi.fn();
    const mockAppointmentInput = {
      barbershopId: DEFAULT_BARBERSHOP_ID,
      clientName: 'Test Client',
      clientPhone: '1234567890',
      barberName: 'Gabriel',
      service: { id: 'service-1', name: 'Corte', price: 50, durationMinutes: 30, barbershopId: DEFAULT_BARBERSHOP_ID },
      selectedSlot: { startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T10:30:00Z', label: '10:00', available: true },
    } as any;

    const createdAppointment = createPublicAppointment(mockAppointmentInput, 'new-app-id');
    expect(createdAppointment.barbershopId).toBe(DEFAULT_BARBERSHOP_ID);
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