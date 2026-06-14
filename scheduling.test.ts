import { describe, expect, it, vi } from 'vitest';
import { Appointment, AppSettings, DEFAULT_SETTINGS } from './types';
import {
  buildWhatsAppLink,
  completeAppointmentFinancialRecord,
  appointmentToClient,
  createPublicAppointment,
  getAvailableTimeSlots,
  getPublicBookingWorkdayForDate,
  hasAppointmentConflict,
  TimeSlot,
  validatePublicBookingInput
} from './scheduling';

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appointment-1',
  barberId: 'barber-1',
  serviceId: 'service-1',
  clientName: 'Joao',
  clientPhone: '(11) 99999-0000',
  barberName: 'Carlos',
  commissionRate: 50,
  serviceType: 'Corte',
  serviceValue: 50,
  startAt: new Date(2026, 5, 4, 10, 0).toISOString(),
  endAt: new Date(2026, 5, 4, 10, 30).toISOString(),
  status: 'scheduled',
  createdAt: new Date(2026, 5, 1, 8, 0).toISOString(),
  updatedAt: new Date(2026, 5, 1, 8, 0).toISOString(),
  ...overrides
});

const settings: AppSettings = {
  ...DEFAULT_SETTINGS,
  commissionRate: 50
};

describe('hasAppointmentConflict', () => {
  it('detects overlapping appointments for the same barber', () => {
    const existing = makeAppointment();
    const candidate = makeAppointment({
      id: 'appointment-2',
      startAt: new Date(2026, 5, 4, 10, 15).toISOString(),
      endAt: new Date(2026, 5, 4, 10, 45).toISOString()
    });

    expect(hasAppointmentConflict([existing], candidate)).toBe(true);
  });

  it('allows adjacent appointments without overlap', () => {
    const existing = makeAppointment();
    const candidate = makeAppointment({
      id: 'appointment-2',
      startAt: existing.endAt,
      endAt: new Date(2026, 5, 4, 11, 0).toISOString()
    });

    expect(hasAppointmentConflict([existing], candidate)).toBe(false);
  });

  it('does not block different barbers by name when barberId is missing', () => {
    const existing = makeAppointment({ barberId: undefined });
    const candidate = makeAppointment({
      id: 'appointment-2',
      barberId: undefined,
      barberName: 'Marcos'
    });

    expect(hasAppointmentConflict([existing], candidate)).toBe(false);
  });

  it('detects conflict when barberId is the same', () => {
    const existing = makeAppointment({
      id: 'appointment-1',
      barberId: 'barber-1',
      barberName: 'Carlos'
    });

    const candidate = makeAppointment({
      id: 'appointment-2',
      barberId: 'barber-1',
      barberName: 'Carlos'
    });

    expect(hasAppointmentConflict([existing], candidate)).toBe(true);
  });

  it('does not detect conflict when barberName is the same but barberId is different', () => {
    const existing = makeAppointment({
      id: 'appointment-1',
      barberId: 'barber-1',
      barberName: 'Carlos'
    });

    const candidate = makeAppointment({
      id: 'appointment-2',
      barberId: 'barber-2',
      barberName: 'Carlos'
    });

    expect(hasAppointmentConflict([existing], candidate)).toBe(false);
  });

  it('falls back to barberName when barberId is missing', () => {
    const existing = makeAppointment({
      id: 'appointment-1',
      barberId: undefined,
      barberName: 'Carlos'
    });

    const candidate = makeAppointment({
      id: 'appointment-2',
      barberId: undefined,
      barberName: 'Carlos'
    });

    expect(hasAppointmentConflict([existing], candidate)).toBe(true);
  });

  it('ignores cancelled appointments', () => {
    const existing = makeAppointment({ status: 'cancelled' });
    const candidate = makeAppointment({ id: 'appointment-2' });

    expect(hasAppointmentConflict([existing], candidate)).toBe(false);
  });
});

describe('buildWhatsAppLink', () => {
  it('builds a manual wa.me link with sanitized phone and encoded message', () => {
    const link = buildWhatsAppLink(makeAppointment());

    expect(link).toContain('https://wa.me/5511999990000?text=');
    expect(decodeURIComponent(link || '')).toContain('Ola, Joao.');
    expect(decodeURIComponent(link || '')).toContain('Servico: Corte.');
  });

  it('returns null without a phone', () => {
    expect(buildWhatsAppLink(makeAppointment({ clientPhone: undefined }))).toBeNull();
  });
});

describe('appointmentToClient', () => {
  it('uses appointment.commissionRate when available (snapshot priority)', () => {
    const appointment = makeAppointment({
      serviceValue: 100,
      commissionRate: 80, // Snapshot salvo no agendamento
      serviceType: 'Corte'
    });

    const customSettings: AppSettings = {
      ...settings,
      commissionRate: 40, // Taxa global diferente
      services: [
        { id: 'cut', name: 'Corte', price: 50, durationMinutes: 30, commissionRate: 50 } // Taxa atual do serviço diferente
      ]
    };

    const client = appointmentToClient(appointment, customSettings, 'client-1');

    // Deve usar os 80% do snapshot: 100 * 0.8 = 80
    expect(client.commissionValue).toBe(80);
  });

  it('falls back to service configuration when appointment.commissionRate is missing', () => {
    const appointment = makeAppointment({
      serviceValue: 100,
      commissionRate: undefined, // Sem snapshot
      serviceType: 'Corte'
    });

    const customSettings: AppSettings = {
      ...settings,
      commissionRate: 40, // Taxa global
      services: [
        { id: 'cut', name: 'Corte', price: 50, durationMinutes: 30, commissionRate: 45 } // Taxa do serviço
      ]
    };

    const client = appointmentToClient(appointment, customSettings, 'client-1');

    // Deve usar os 45% da configuração do serviço: 100 * 0.45 = 45
    expect(client.commissionValue).toBe(45);
  });
});

describe('completeAppointmentFinancialRecord', () => {
  it('does not duplicate financial records for the same completed appointment', () => {
    const appointment = makeAppointment({ status: 'completed' });
    const first = completeAppointmentFinancialRecord(appointment, [], settings, () => 'client-1');
    const second = completeAppointmentFinancialRecord(appointment, first.clients, settings, () => 'client-2');

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.clients).toHaveLength(1);
    expect(second.clients[0].appointmentId).toBe('appointment-1');
    expect(second.clients[0].commissionValue).toBe(25);
  });
});

describe('getAvailableTimeSlots', () => {
  it('generates slots inside the workday', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-10',
      barberName: 'Carlos',
      serviceDurationMinutes: 30,
      appointments: [],
      workdayStart: '09:00',
      workdayEnd: '10:00',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 9, 8, 0)
    });

    expect(slots.map(slot => slot.label)).toEqual(['09:00', '09:30']);
    expect(slots.every(slot => slot.available)).toBe(true);
  });

  it('marks occupied slots unavailable', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-10',
      barberId: 'barber-1',
      barberName: 'Carlos',
      serviceDurationMinutes: 30,
      appointments: [
        makeAppointment({
          barberId: 'barber-1',
          startAt: new Date(2026, 5, 10, 9, 30).toISOString(),
          endAt: new Date(2026, 5, 10, 10, 0).toISOString()
        })
      ],
      workdayStart: '09:00',
      workdayEnd: '10:30',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 9, 8, 0)
    });

    expect(slots.find(slot => slot.label === '09:30')?.available).toBe(false);
  });

  it('does not block slots with cancelled appointments', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-10',
      barberName: 'Carlos',
      serviceDurationMinutes: 30,
      appointments: [
        makeAppointment({
          status: 'cancelled',
          startAt: new Date(2026, 5, 10, 9, 30).toISOString(),
          endAt: new Date(2026, 5, 10, 10, 0).toISOString()
        })
      ],
      workdayStart: '09:00',
      workdayEnd: '10:30',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 9, 8, 0)
    });

    expect(slots.find(slot => slot.label === '09:30')?.available).toBe(true);
  });

  it('does not block slots for another barber by barberId', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-10',
      barberId: 'barber-2',
      barberName: 'Carlos',
      serviceDurationMinutes: 30,
      appointments: [
        makeAppointment({
          barberId: 'barber-1',
          barberName: 'Carlos',
          startAt: new Date(2026, 5, 10, 9, 30).toISOString(),
          endAt: new Date(2026, 5, 10, 10, 0).toISOString()
        })
      ],
      workdayStart: '09:00',
      workdayEnd: '10:30',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 9, 8, 0)
    });

    expect(slots.find(slot => slot.label === '09:30')?.available).toBe(true);
  });

  it('does not block slots for another barber by name fallback', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-10',
      barberName: 'Marcos',
      serviceDurationMinutes: 30,
      appointments: [
        makeAppointment({
          barberId: undefined,
          barberName: 'Carlos',
          startAt: new Date(2026, 5, 10, 9, 30).toISOString(),
          endAt: new Date(2026, 5, 10, 10, 0).toISOString()
        })
      ],
      workdayStart: '09:00',
      workdayEnd: '10:30',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 9, 8, 0)
    });

    expect(slots.find(slot => slot.label === '09:30')?.available).toBe(true);
  });

  it('uses longer service duration to block overlapping slots', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-10',
      barberName: 'Carlos',
      serviceDurationMinutes: 60,
      appointments: [
        makeAppointment({
          startAt: new Date(2026, 5, 10, 10, 30).toISOString(),
          endAt: new Date(2026, 5, 10, 11, 0).toISOString()
        })
      ],
      workdayStart: '10:00',
      workdayEnd: '12:00',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 9, 8, 0)
    });

    expect(slots.find(slot => slot.label === '10:00')?.available).toBe(false);
    expect(slots.find(slot => slot.label === '11:00')?.available).toBe(true);
  });

  it('does not include past slots for today', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-06',
      barberName: 'Carlos',
      serviceDurationMinutes: 30,
      appointments: [],
      workdayStart: '09:00',
      workdayEnd: '12:00',
      slotStepMinutes: 30,
      now: new Date(2026, 5, 6, 10, 15)
    });

    expect(slots.map(slot => slot.label)).not.toContain('09:00');
    expect(slots.map(slot => slot.label)).not.toContain('10:00');
    expect(slots.map(slot => slot.label)).toContain('10:30');
  });
});

describe('public booking business hours', () => {
  it('closes on monday', () => {
    expect(getPublicBookingWorkdayForDate('2026-06-08')).toBeNull();
  });

  it('opens from 08:00 to 20:00 from tuesday to saturday', () => {
    expect(getPublicBookingWorkdayForDate('2026-06-09')).toEqual({
      start: '08:00',
      end: '20:00'
    });

    expect(getPublicBookingWorkdayForDate('2026-06-13')).toEqual({
      start: '08:00',
      end: '20:00'
    });
  });

  it('opens from 10:00 to 18:00 on sunday', () => {
    expect(getPublicBookingWorkdayForDate('2026-06-14')).toEqual({
      start: '10:00',
      end: '18:00'
    });
  });

  it('does not generate slots on monday', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-08',
      barberName: 'Carlos',
      serviceDurationMinutes: 30,
      appointments: [],
      now: new Date(2026, 5, 7, 8, 0)
    });

    expect(slots).toEqual([]);
  });

  it('generates sunday slots between 10:00 and 18:00', () => {
    const slots = getAvailableTimeSlots({
      date: '2026-06-14',
      barberName: 'Carlos',
      serviceDurationMinutes: 30,
      appointments: [],
      now: new Date(2026, 5, 13, 8, 0)
    });

    expect(slots[0]?.label).toBe('10:00');
    expect(slots.at(-1)?.label).toBe('17:30');
  });
});

describe('public booking helpers', () => {
  const slot: TimeSlot = {
    startAt: new Date(2026, 5, 10, 9, 0).toISOString(),
    endAt: new Date(2026, 5, 10, 9, 30).toISOString(),
    label: '09:00',
    available: true
  };

  it('creates a scheduled appointment from public booking input', () => {
    const appointment = createPublicAppointment({
      clientName: ' Maria ',
      clientPhone: '(85) 98888-7777',
      barberId: 'barber-1',
      barbershopId: 'shop-1',
      barberName: 'Carlos',
      service: settings.services[0],
      selectedSlot: slot,
      notes: 'Preferencia por maquina 1'
    }, 'public-1', new Date(2026, 5, 9, 8, 0));

    expect(appointment.id).toBe('public-1');
    expect(appointment.barberId).toBe('barber-1');
    expect(appointment.serviceId).toBe(settings.services[0].id);
    expect(appointment.status).toBe('scheduled');
    expect(appointment.clientName).toBe('Maria');
    expect(appointment.clientPhone).toBe('85988887777');
    expect(appointment.serviceType).toBe(settings.services[0].name);
    expect(appointment.serviceValue).toBe(settings.services[0].price);
    expect(appointment.commissionRate).toBe(settings.services[0].commissionRate);
    expect(appointment.startAt).toBe(slot.startAt);
    expect(appointment.endAt).toBe(slot.endAt);
  });

  it('rejects public appointment creation without barbershopId', () => {
    expect(() => createPublicAppointment({
      clientName: 'Maria',
      clientPhone: '(85) 98888-7777',
      barberId: 'barber-1',
      barbershopId: '',
      barberName: 'Carlos',
      service: settings.services[0],
      selectedSlot: slot
    }, 'public-1')).toThrow('Barbearia');
  });

  it('rejects public appointment creation without barberId', () => {
    expect(() => createPublicAppointment({
      clientName: 'Maria',
      clientPhone: '(85) 98888-7777',
      barbershopId: 'shop-1',
      barberName: 'Carlos',
      service: settings.services[0],
      selectedSlot: slot
    }, 'public-1')).toThrow('Selecione um barbeiro.');
  });

  it('rejects public appointment creation without serviceId', () => {
    expect(() => createPublicAppointment({
      clientName: 'Maria',
      clientPhone: '(85) 98888-7777',
      barberId: 'barber-1',
      barbershopId: 'shop-1',
      barberName: 'Carlos',
      service: { ...settings.services[0], id: '' },
      selectedSlot: slot
    }, 'public-1')).toThrow('Selecione um serviço.');
  });

  it('validates required public booking fields', () => {
    const result = validatePublicBookingInput({
      clientName: '',
      clientPhone: '',
      barbershopId: '',
      barberName: '',
      service: undefined,
      selectedSlot: null
    }, []);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Barbearia não encontrada ou indisponível.');
    expect(result.errors).toContain('Selecione um barbeiro.');
    expect(result.errors).toContain('Selecione um serviço.');
    expect(result.errors).toContain('Escolha um barbeiro.');
    expect(result.errors).toContain('Escolha um servico.');
    expect(result.errors).toContain('Escolha um horario disponivel.');
    expect(result.errors).toContain('Informe seu nome.');
    expect(result.errors).toContain('Informe um WhatsApp valido com DDD.');
  });
});

describe('barbershop repository local fallback', () => {
  it('returns the local gestao-maxima fallback without image fields', async () => {
    vi.resetModules();
    vi.doMock('./lib/supabase', () => ({
      isSupabaseConfigured: false,
      supabase: null
    }));

    const { getBarbershopBySlug } = await import('./services/barbershopRepository');

    await expect(getBarbershopBySlug('gestao-maxima')).resolves.toMatchObject({
      slug: 'gestao-maxima',
      logoUrl: null,
      coverImageUrl: null,
      description: null,
      instagramUrl: null,
      whatsapp: null
    });

    vi.doUnmock('./lib/supabase');
  });

  it("returns null for an invalid slug instead of falling back to gestao-maxima", async () => {
    vi.resetModules();
    vi.doMock('./lib/supabase', () => ({
      isSupabaseConfigured: false,
      supabase: null
    }));

    const { getBarbershopBySlug } = await import('./services/barbershopRepository');

    await expect(getBarbershopBySlug('barbearia-inexistente')).resolves.toBeNull();

    vi.doUnmock('./lib/supabase');
  });

  it('maps Supabase branding fields to camelCase', async () => {
    vi.resetModules();

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'barbershop-brand',
        name: 'Barbearia Premium',
        slug: 'barbearia-premium',
        phone: null,
        address: 'Rua Central, 100',
        logo_url: 'https://cdn.example.com/logo.png',
        cover_image_url: 'https://cdn.example.com/cover.jpg',
        description: 'Cortes classicos com agenda online.',
        instagram_url: 'https://instagram.com/barbearia_premium',
        whatsapp: '5585999999999',
        active: true
      },
      error: null
    });
    const eqActive = vi.fn(() => ({ maybeSingle }));
    const eqSlug = vi.fn(() => ({ eq: eqActive }));
    const select = vi.fn(() => ({ eq: eqSlug }));
    const from = vi.fn(() => ({ select }));

    vi.doMock('./lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: { from }
    }));

    const { getBarbershopBySlug } = await import('./services/barbershopRepository');

    await expect(getBarbershopBySlug('barbearia-premium')).resolves.toMatchObject({
      id: 'barbershop-brand',
      slug: 'barbearia-premium',
      logoUrl: 'https://cdn.example.com/logo.png',
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
      description: 'Cortes classicos com agenda online.',
      instagramUrl: 'https://instagram.com/barbearia_premium',
      whatsapp: '5585999999999'
    });

    expect(from).toHaveBeenCalledWith('barbershops');
    expect(select).toHaveBeenCalledWith('id,name,slug,phone,address,logo_url,cover_image_url,description,instagram_url,whatsapp,active');

    vi.doUnmock('./lib/supabase');
  });
});
