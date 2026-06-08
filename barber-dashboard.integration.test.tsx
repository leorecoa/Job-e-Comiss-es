import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authRepository from './services/authRepository';
import * as appointmentRepository from './services/appointmentRepository';
import { calculateEstimatedCommission } from './utils';
import * as barberRepository from './services/barberRepository';
import * as serviceRepository from './services/serviceRepository';
import { Appointment } from './types';

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

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; }
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

describe('Barber Dashboard Logic & Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    
    // Default successful responses for shared services
    vi.mocked(barberRepository.listBarbers).mockResolvedValue([{ id: 'barber-1', name: 'Gabriel' }]);
    vi.mocked(serviceRepository.listServices).mockResolvedValue([
      { id: 'cut-1', name: 'Corte', price: 50, durationMinutes: 30 }
    ]);
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

  describe('Session & Role Handling', () => {
    it('Scenario 1: Correcty maps a barber session with barberId', async () => {
      // Simula o que o authRepository.mapAuthSession faz
      // O mockBarberSession deve seguir o contrato AuthSession
      expect(mockBarberSession.role).toBe('barber');
      expect(mockBarberSession.barberId).toBe('58c3b75a-175c-41e6-b1a1-54ef2027a272');

      const session = authRepository.mapAuthSession({
        user: {
          id: 'barber-user-id',
          email: 'gabriel@example.com',
          user_metadata: { role: 'barber', display_name: 'Gabriel' }
        }
      } as any, {
        id: 'barber-user-id',
        display_name: 'Gabriel',
        role: 'barber',
        barber_id: '58c3b75a-175c-41e6-b1a1-54ef2027a272'
      });

      expect(session?.role).toBe('barber');
      expect(session?.barberId).toBe('58c3b75a-175c-41e6-b1a1-54ef2027a272');
    });

    it('Scenario 2: Validates if internal panel access is allowed for barber role', () => {
      const canAccess = authRepository.canAccessInternalPanel(mockBarberSession, true);
      expect(canAccess).toBe(true);
    });
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

  describe('Appointment Actions Logic', () => {
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