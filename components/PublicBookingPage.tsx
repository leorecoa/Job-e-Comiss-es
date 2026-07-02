import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle, Clock, MapPin, MessageCircle, Phone, Scissors } from 'lucide-react';
import { Appointment, AppSettings, BarberOption, Barbershop, Service, UserProfile } from '../types';
import { getBarbershopBySlug } from '../services/barbershopRepository';
import {
  DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES,
  createPublicAppointment,
  getAvailableTimeSlots,
  getPublicBookingWorkdayForDate,
  isAppointmentConflictError,
  PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE,
  PublicBookingInput,
  TimeSlot,
  validatePublicBookingInput
} from '../scheduling';
import { formatCurrency, generateId } from '../utils';

interface PublicBookingPageProps {
  settings: AppSettings;
  appointments: Appointment[];
  barbershopSlug?: string;
  userProfile: UserProfile | null;
  onCreateAppointment: (appointment: Appointment) => Promise<void> | void;
}

export type PublicBarberOption = {
  value: string;
  id: string;
  name: string;
  barbershopId?: string;
  active?: boolean;
};

const getTodayString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const normalizeSlugLabel = (slug?: string): string | null => {
  const trimmed = slug?.trim();
  if (!trimmed) return null;

  return trimmed.replace(/-/g, ' ');
};

const isBarberOption = (barber: unknown): barber is BarberOption => {
  return (
    typeof barber === 'object' &&
    barber !== null &&
    'id' in barber &&
    'name' in barber
  );
};

type SectionTitleProps = {
  step: string;
  title: string;
  description: string;
};

const SectionTitle: React.FC<SectionTitleProps> = ({ step, title, description }) => (
  <div className="flex items-start gap-3">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gold-400/20 bg-gold-500/10 text-[11px] font-black text-gold-300">
      {step}
    </span>
    <span>
      <span className="block font-display text-lg font-bold text-white">{title}</span>
      <span className="mt-0.5 block text-sm text-gray-500">{description}</span>
    </span>
  </div>
);

type EmptyStateProps = {
  message: string;
  tone?: 'default' | 'warning';
};

const EmptyState: React.FC<EmptyStateProps> = ({ message, tone = 'default' }) => (
  <div className={`rounded-2xl border p-4 text-sm ${
    tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-100'
      : 'border-gray-700 bg-gray-900/60 text-gray-400'
  }`}>
    {message}
  </div>
);

type SummaryRowProps = {
  label: string;
  value: string;
  highlight?: boolean;
};

const SummaryRow: React.FC<SummaryRowProps> = ({ label, value, highlight = false }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
    <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
    <span className={`text-right text-sm font-bold ${highlight ? 'text-gold-300' : 'text-gray-200'}`}>{value}</span>
  </div>
);

export const normalizePublicBarberOptions = (
  barbers: Array<BarberOption | string> = []
): PublicBarberOption[] => {
  const byValue = new Map<string, PublicBarberOption>();

  barbers.forEach((barber) => {
    if (!isBarberOption(barber)) return;

    const id = barber.id?.trim();
    const name = barber.name?.trim();

    if (!id || !name) return;

    byValue.set(`id:${id}`, {
      value: `id:${id}`,
      id,
      name,
      barbershopId: barber.barbershopId,
      active: barber.active !== false
    });
  });

  return Array.from(byValue.values());
};

export const getPublicBookingBranding = (
  barbershop: Barbershop | null,
  settings: AppSettings,
  barbershopSlug?: string
) => {
  const explicitSlug = barbershopSlug?.trim();
  const hasExplicitSlug = Boolean(explicitSlug);
  const slugLabel = normalizeSlugLabel(explicitSlug);
  const fallbackShopName = hasExplicitSlug
    ? (slugLabel || 'Agendamento')
    : 'Escolha uma barbearia';
  const shopName = barbershop?.name?.trim() || fallbackShopName;
  const logoUrl = barbershop?.logoUrl?.trim() || null;
  const coverImageUrl = barbershop?.coverImageUrl?.trim() || null;
  const description = barbershop?.description?.trim() || null;
  const address = barbershop?.address?.trim() || null;
  const whatsapp = barbershop?.whatsapp?.trim() || barbershop?.phone?.trim() || null;
  const instagramUrl = barbershop?.instagramUrl?.trim() || null;
  const primaryColor = barbershop?.primaryColor?.trim() || null;
  const secondaryColor = barbershop?.secondaryColor?.trim() || null;

  return {
    shopName,
    logoUrl,
    coverImageUrl,
    description,
    address,
    whatsapp,
    instagramUrl,
    primaryColor,
    secondaryColor,
    hasVisualBranding: Boolean(logoUrl || coverImageUrl || description || address || whatsapp || instagramUrl || primaryColor || secondaryColor)
  };
};

const DEFAULT_PUBLIC_BOOKING_DESCRIPTION = 'Corte, barba e acabamento com horario marcado.';

export const getPublicBookingLandingContent = (branding: ReturnType<typeof getPublicBookingBranding>) => {
  const description = branding.description
    || (branding.shopName === 'Escolha uma barbearia'
      ? 'Use o link publico da sua barbearia para abrir a agenda correta.'
      : DEFAULT_PUBLIC_BOOKING_DESCRIPTION);

  return {
    eyebrow: 'Reserva oficial',
    headline: branding.shopName,
    subheadline: 'Agende seu horario',
    description,
    ctaLabel: 'Agendar agora',
    trustItems: ['Horario reservado', 'Atendimento por barbeiro']
  };
};

export const getPublicBookingContactLinks = (branding: ReturnType<typeof getPublicBookingBranding>) => ({
  whatsapp: branding.whatsapp ? getWhatsAppHref(branding.whatsapp) : null,
  instagram: branding.instagramUrl ? getExternalHref(branding.instagramUrl) : null,
  address: branding.address || null
});

const getExternalHref = (value: string): string => {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
};

const getWhatsAppHref = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 10) return `https://wa.me/${digits}`;
  return getExternalHref(value);
};

const getTimeValueInMinutes = (timeInput: string): number => {
  const [hours, minutes] = timeInput.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const isSafeHexColor = (value: string | null): value is string => {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
};

export type PublicBookingStepKey = 'barber' | 'service' | 'slot' | 'client' | 'confirm';

export type PublicBookingStep = {
  key: PublicBookingStepKey;
  label: string;
  complete: boolean;
  active: boolean;
};

export const getPublicBookingSteps = ({
  hasBarber,
  hasService,
  hasSlot,
  hasClient,
  hasReadyToConfirm = false
}: {
  hasBarber: boolean;
  hasService: boolean;
  hasSlot: boolean;
  hasClient: boolean;
  hasReadyToConfirm?: boolean;
}): PublicBookingStep[] => {
  const steps: Array<Omit<PublicBookingStep, 'active'>> = [
    { key: 'barber', label: 'Barbeiro', complete: hasBarber },
    { key: 'service', label: 'Servico', complete: hasService },
    { key: 'slot', label: 'Horario', complete: hasSlot },
    { key: 'client', label: 'Dados', complete: hasClient },
    { key: 'confirm', label: 'Confirmar', complete: hasReadyToConfirm }
  ];
  const activeIndex = Math.max(0, steps.findIndex((step) => !step.complete));

  return steps.map((step, index) => ({
    ...step,
    active: index === (activeIndex === -1 ? steps.length - 1 : activeIndex)
  }));
};

const formatPublicBookingDateLabel = (dateInput: string): string => {
  const [year, month, day] = dateInput.split('-').map(Number);

  if (!year || !month || !day) {
    return 'Selecione uma data';
  }

  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit'
  });
};

const formatPublicBookingDateTimeLabel = (isoDate: string): string => {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return 'Horario agendado';
  }

  return `${date.toLocaleDateString('pt-BR')} as ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
};

export const getPublicBookingSummary = (
  barber: PublicBarberOption | null,
  service: Service | undefined,
  slot: TimeSlot | null
) => ({
  barberName: barber?.name || 'Selecione um barbeiro',
  serviceName: service?.name || 'Selecione um servico',
  serviceValue: service ? formatCurrency(service.price) : '--',
  duration: service ? `${service.durationMinutes} min` : '--',
  slotLabel: slot?.label || 'Selecione um horario',
  ready: Boolean(barber?.id && service?.id && slot)
});

export type PublicBookingReadiness = {
  ready: boolean;
  issues: string[];
  hasResolvedBarbershop: boolean;
  hasActiveBarbershop: boolean;
  hasConfiguredBusinessHours: boolean;
  hasValidSlotStepMinutes: boolean;
  hasActiveBarbers: boolean;
  hasActiveServices: boolean;
};

const hasAtLeastOneActiveBusinessDay = (businessHours?: Barbershop['businessHours'] | null): boolean => {
  if (!businessHours) return false;

  return Object.values(businessHours).some((day) => {
    if (!day?.active) return false;
    return getTimeValueInMinutes(day.open) < getTimeValueInMinutes(day.close);
  });
};

export const isValidPublicBookingSlotStepMinutes = (value?: number | null): boolean => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 5;
};

export const getPublicBookingReadiness = ({
  barbershop,
  barbers,
  services
}: {
  barbershop: Barbershop | null;
  barbers: PublicBarberOption[];
  services: Service[];
}): PublicBookingReadiness => {
  const issues: string[] = [];

  const hasResolvedBarbershop = Boolean(barbershop);
  const hasActiveBarbershop = Boolean(barbershop?.active);
  const hasConfiguredBusinessHours = Boolean(
    barbershop?.hasConfiguredBusinessHours
    && hasAtLeastOneActiveBusinessDay(barbershop.businessHours)
  );
  const hasValidSlotStepMinutes = Boolean(
    barbershop?.hasConfiguredSlotStepMinutes
    && isValidPublicBookingSlotStepMinutes(barbershop.slotStepMinutes)
  );
  const hasActiveBarbers = barbers.length > 0;
  const hasActiveServices = services.length > 0;

  if (!hasResolvedBarbershop) {
    issues.push('Barbearia não encontrada ou indisponível.');
  } else {
    if (!hasActiveBarbershop) {
      issues.push('Barbearia inativa.');
    }
    if (!hasConfiguredBusinessHours) {
      issues.push('Horários de funcionamento não configurados.');
    }
    if (!hasValidSlotStepMinutes) {
      issues.push('Intervalo de agenda inválido.');
    }
    if (!hasActiveBarbers) {
      issues.push('Nenhum barbeiro ativo.');
    }
    if (!hasActiveServices) {
      issues.push('Nenhum serviço ativo.');
    }
  }

  return {
    ready: issues.length === 0,
    issues,
    hasResolvedBarbershop,
    hasActiveBarbershop,
    hasConfiguredBusinessHours,
    hasValidSlotStepMinutes,
    hasActiveBarbers,
    hasActiveServices
  };
};

export const isPublicBookingSubmitDisabled = ({
  readiness,
  barbershop,
  selectedBarber,
  selectedService,
  selectedSlot,
  formValid,
  isSubmitting
}: {
  readiness: PublicBookingReadiness;
  barbershop: Barbershop | null;
  selectedBarber: PublicBarberOption | null;
  selectedService: Service | undefined;
  selectedSlot: TimeSlot | null;
  formValid?: boolean;
  isSubmitting: boolean;
}): boolean => (
  isSubmitting
  || !readiness.ready
  || formValid === false
  || !barbershop?.id
  || !selectedBarber?.id
  || !selectedService?.id
  || !selectedSlot?.startAt
  || !selectedSlot?.endAt
);

export const getPublicBookingSubmissionErrorMessage = (error: unknown): string => (
  isAppointmentConflictError(error)
    ? PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE
    : 'Nao foi possivel confirmar este horario. Tente novamente.'
);

export const buildPublicBookingInput = ({
  barbershop,
  selectedBarber,
  selectedService,
  selectedSlot,
  clientName,
  clientPhone,
  notes
}: {
  barbershop: Barbershop | null;
  selectedBarber: PublicBarberOption | null;
  selectedService: Service | undefined;
  selectedSlot: TimeSlot | null;
  clientName: string;
  clientPhone: string;
  notes?: string;
}): PublicBookingInput => {
  if (!barbershop?.id) {
    throw new Error('Barbearia nao encontrada ou indisponivel.');
  }

  if (!selectedBarber?.id) {
    throw new Error('Selecione um barbeiro.');
  }

  if (!selectedService?.id) {
    throw new Error('Selecione um servico.');
  }

  if (!selectedSlot) {
    throw new Error('Selecione um horario.');
  }

  if (selectedBarber.barbershopId && selectedBarber.barbershopId !== barbershop.id) {
    throw new Error('O barbeiro selecionado nao pertence a esta barbearia.');
  }

  if (selectedService.barbershopId && selectedService.barbershopId !== barbershop.id) {
    throw new Error('O servico selecionado nao pertence a esta barbearia.');
  }

  return {
    clientName,
    clientPhone,
    barberId: selectedBarber.id,
    barbershopId: barbershop.id,
    barberName: selectedBarber.name,
    service: selectedService,
    selectedSlot,
    notes
  };
};

const isLocalFallbackBarbershop = (barbershop: Barbershop): boolean => barbershop.id === 'local-barbershop';

const belongsToPublicTenant = (
  itemBarbershopId: string | undefined,
  currentBarbershopId: string,
  allowUnscopedLocalItems: boolean
): boolean => {
  if (allowUnscopedLocalItems) {
    return !itemBarbershopId || itemBarbershopId === currentBarbershopId;
  }

  return itemBarbershopId === currentBarbershopId;
};

export const getPublicBookingScopedSettings = (
  appSettings: AppSettings,
  barbershop: Barbershop | null
): AppSettings => {
  if (!barbershop) {
    return appSettings;
  }

  const allowUnscopedLocalItems = isLocalFallbackBarbershop(barbershop);

  return {
    ...appSettings,
    shopName: barbershop.name,
    barbers: appSettings.barbers.filter((barber) => belongsToPublicTenant(barber.barbershopId, barbershop.id, allowUnscopedLocalItems)),
    services: appSettings.services.filter((service) => belongsToPublicTenant(service.barbershopId, barbershop.id, allowUnscopedLocalItems))
  };
};

export const PublicBookingPage: React.FC<PublicBookingPageProps> = ({
  settings: appSettings,
  appointments,
  barbershopSlug,
  userProfile,
  onCreateAppointment
}) => {
  const [selectedBarberValue, setSelectedBarberValue] = useState('');
  const [serviceId, setServiceId] = useState(''); // This is the ID of the selected service
  const [date, setDate] = useState(getTodayString());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [loadingBarbershop, setLoadingBarbershop] = useState(false);
  const [barbershopError, setBarbershopError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setSubmitting] = useState(false);
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);

  const settings = useMemo(() => getPublicBookingScopedSettings(appSettings, barbershop), [appSettings, barbershop]);
  const branding = useMemo(
    () => getPublicBookingBranding(barbershop, settings, barbershopSlug),
    [barbershop, settings, barbershopSlug]
  );
  const landingContent = useMemo(
    () => getPublicBookingLandingContent(branding),
    [branding]
  );
  const contactLinks = useMemo(
    () => getPublicBookingContactLinks(branding),
    [branding]
  );
  const primaryColor = isSafeHexColor(branding.primaryColor) ? branding.primaryColor : '#f59e0b';
  const secondaryColor = isSafeHexColor(branding.secondaryColor) ? branding.secondaryColor : '#0ea5e9';
  const brandingHeaderStyle = {
    background: `linear-gradient(135deg, ${primaryColor}33, rgba(15,23,42,0.86) 45%, ${secondaryColor}26)`
  };
  const primaryActionStyle = {
    backgroundColor: primaryColor,
    boxShadow: `0 18px 36px ${primaryColor}24`
  };
  const heroCtaStyle = {
    backgroundColor: primaryColor,
    boxShadow: `0 18px 36px ${primaryColor}24`
  };
  const selectedCardStyle = {
    borderColor: primaryColor,
    boxShadow: `0 18px 35px ${primaryColor}1f`
  };
  const subtleAccentStyle = {
    borderColor: `${secondaryColor}66`,
    background: `linear-gradient(135deg, ${secondaryColor}18, rgba(17,24,39,0.82))`
  };

  const barberOptions = useMemo(
    () => normalizePublicBarberOptions(settings.barbers || []),
    [settings.barbers]
  );

  const services = settings.services || [];
  const bookingReadiness = useMemo(
    () => getPublicBookingReadiness({
      barbershop,
      barbers: barberOptions,
      services
    }),
    [barberOptions, barbershop, services]
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${branding.shopName} | Agendamento`;

    return () => {
      document.title = previousTitle;
    };
  }, [branding.shopName]);

  useEffect(() => {
    let active = true;
    const resolvedBarbershopSlug = barbershopSlug?.trim();

    if (!resolvedBarbershopSlug) {
      setBarbershop(null);
      setBarbershopError('Selecione uma barbearia para agendar.');
      setLoadingBarbershop(false);
      return () => {
        active = false;
      };
    }

    const loadBarbershop = async () => {
      setLoadingBarbershop(true);
      setBarbershopError(null);

      try {
        const resolvedBarbershop = await getBarbershopBySlug(resolvedBarbershopSlug);

        if (!active) return;

        if (!resolvedBarbershop) {
          setBarbershop(null);
          setBarbershopError('Barbearia não encontrada ou indisponível.');
          return;
        }

        setBarbershop(resolvedBarbershop);
      } catch (error) {
        if (!active) return;
        console.error(error);
        setBarbershop(null);
        setBarbershopError('Nao foi possivel carregar esta barbearia.');
      } finally {
        if (active) setLoadingBarbershop(false);
      }
    };

    loadBarbershop();

    return () => {
      active = false;
    };
  }, [barbershopSlug]);

  useEffect(() => {
    const hasSelectedBarber = barberOptions.some((barber) => barber.value === selectedBarberValue);

    if (!barberOptions.length) {
      if (selectedBarberValue) {
        setSelectedBarberValue('');
      }
      return;
    }

    if (!hasSelectedBarber) {
      setSelectedBarberValue(barberOptions[0].value);
      setSelectedSlot(null);
    }
  }, [barberOptions, selectedBarberValue]);

  useEffect(() => {
    const hasSelectedService = services.some((service) => service.id === serviceId);

    if (!services.length) {
      if (serviceId) {
        setServiceId('');
      }
      return;
    }

    if (!hasSelectedService) {
      setServiceId(services[0].id);
      setSelectedSlot(null);
    }
  }, [serviceId, services]);

  const selectedBarber = useMemo(
    () => barberOptions.find((barber) => barber.value === selectedBarberValue) || null,
    [barberOptions, selectedBarberValue]
  );

  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId),
    [services, serviceId]
  );
  const bookingDateLabel = useMemo(() => formatPublicBookingDateLabel(date), [date]);
  const selectedDateTimeLabel = selectedSlot
    ? `${bookingDateLabel} as ${selectedSlot.label}`
    : 'Selecione data e horario';
  const bookingSteps = useMemo(() => getPublicBookingSteps({
    hasBarber: Boolean(selectedBarber?.id),
    hasService: Boolean(selectedService?.id),
    hasSlot: Boolean(selectedSlot),
    hasClient: Boolean(clientName.trim() && clientPhone.trim()),
    hasReadyToConfirm: Boolean(selectedBarber?.id && selectedService?.id && selectedSlot && clientName.trim() && clientPhone.trim())
  }), [clientName, clientPhone, selectedBarber, selectedService, selectedSlot]);
  const bookingSummary = useMemo(
    () => getPublicBookingSummary(selectedBarber, selectedService, selectedSlot),
    [selectedBarber, selectedService, selectedSlot]
  );
  const selectedWorkday = useMemo(
    () => bookingReadiness.hasConfiguredBusinessHours
      ? getPublicBookingWorkdayForDate(date, barbershop?.businessHours)
      : null,
    [barbershop?.businessHours, bookingReadiness.hasConfiguredBusinessHours, date]
  );

  const slotStepMinutes = bookingReadiness.hasValidSlotStepMinutes
    ? barbershop?.slotStepMinutes || DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES
    : null;
  const workdayHasValidRange = selectedWorkday
    ? getTimeValueInMinutes(selectedWorkday.start) < getTimeValueInMinutes(selectedWorkday.end)
    : false;

  const workdayLabel = selectedWorkday
    ? `${selectedWorkday.start} - ${selectedWorkday.end}`
    : 'Fechado';

  const workdayDescription = selectedWorkday
    ? workdayHasValidRange
      ? `Expediente do dia selecionado · intervalos de ${slotStepMinutes} min`
      : 'Horario configurado de forma invalida para este dia'
    : !bookingReadiness.hasConfiguredBusinessHours
      ? 'Defina os horarios de funcionamento no painel interno.'
      : !bookingReadiness.hasValidSlotStepMinutes
        ? 'Intervalo de agenda invalido para esta barbearia.'
        : 'Sem atendimento neste dia';

  const emptySlotsMessage = selectedWorkday
    ? workdayHasValidRange
      ? 'Nenhum horario disponivel para esta combinacao.'
      : 'Horario de funcionamento indisponivel neste dia.'
    : !bookingReadiness.hasConfiguredBusinessHours
      ? 'Horarios de funcionamento nao configurados para esta barbearia.'
      : !bookingReadiness.hasValidSlotStepMinutes
        ? 'Intervalo de agenda invalido para esta barbearia.'
        : 'A barbearia nao atende neste dia.';
  const emptySlotsNextStep = contactLinks.whatsapp
    ? 'Escolha outra data, tente outro profissional ou fale com a barbearia pelo WhatsApp.'
    : 'Escolha outra data ou tente outro profissional, se houver outro disponivel.';
  
  const availableSlots = useMemo(() => {
    if (!bookingReadiness.ready || !selectedBarber || !selectedService || !date) return [];

    return getAvailableTimeSlots({
      date,
      barbershopId: barbershop?.id,
      barberId: selectedBarber.id,
      barberName: selectedBarber.name,
      serviceDurationMinutes: selectedService.durationMinutes,
      appointments,
      businessHours: barbershop?.businessHours,
      slotStepMinutes: barbershop?.slotStepMinutes || undefined
    }).filter((slot) => slot.available);
  }, [appointments, barbershop?.businessHours, barbershop?.slotStepMinutes, bookingReadiness.ready, date, selectedBarber, selectedService]);

  const bookingValidation = useMemo(() => validatePublicBookingInput({
    clientName,
    clientPhone,
    barbershopId: barbershop?.id || '',
    barberId: selectedBarber?.id,
    barberName: selectedBarber?.name || '',
    service: selectedService,
    selectedSlot,
    notes
  }, appointments, {
    barbers: barberOptions,
    services,
    availableSlots
  }), [appointments, availableSlots, barberOptions, barbershop?.id, clientName, clientPhone, notes, selectedBarber?.id, selectedBarber?.name, selectedService, selectedSlot, services]);

  const handleBarberChange = (value: string) => {
    setSelectedBarberValue(value);
    setSelectedSlot(null);
  };

  const handleServiceChange = (id: string) => {
    setServiceId(id);
    setSelectedSlot(null);
  };

const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();

  if (!bookingReadiness.ready) {
    setErrors(bookingReadiness.issues);
    return;
  }

  if (!barbershop) {
    setErrors(['Barbearia não encontrada ou indisponível.']);
    return;
  }

  if (!selectedBarber?.id) {
    setErrors(['Selecione um barbeiro.']);
    return;
  }

  if (!selectedService?.id) {
    setErrors(['Selecione um serviço.']);
    return;
  }

  if (!selectedSlot) {
    setErrors(['Selecione um horário.']);
    return;
  }

  if (selectedBarber.barbershopId && selectedBarber.barbershopId !== barbershop.id) {
    setErrors(['O barbeiro selecionado nao pertence a esta barbearia.']);
    return;
  }

  if (selectedService.barbershopId && selectedService.barbershopId !== barbershop.id) {
    setErrors(['O servico selecionado nao pertence a esta barbearia.']);
    return;
  }

  const input = buildPublicBookingInput({
    barbershop,
    selectedBarber,
    selectedService,
    selectedSlot,
    clientName,
    clientPhone,
    notes
  });
  const validation = validatePublicBookingInput(input, appointments, {
    barbers: barberOptions,
    services,
    availableSlots
  });

  if (!validation.valid) {
    setErrors(validation.errors);
    return;
  }

  const appointment = createPublicAppointment(input, generateId());

  

  setSubmitting(true);

  try {
    await onCreateAppointment(appointment);
    setCreatedAppointment(appointment);
    setErrors([]);
  } catch (error) {
    setErrors([getPublicBookingSubmissionErrorMessage(error)]);
  } finally {
    setSubmitting(false);
  }
};

  const isSubmitDisabled = isPublicBookingSubmitDisabled({
    readiness: bookingReadiness,
    barbershop,
    selectedBarber,
    selectedService,
    selectedSlot,
    formValid: bookingValidation.valid,
    isSubmitting
  });

  const handleNewBooking = () => {
    setCreatedAppointment(null);
    setSelectedSlot(null);
    setClientName('');
    setClientPhone('');
    setNotes('');
  };

  if (loadingBarbershop) {
    return (
      <div className="min-h-screen bg-transparent flex items-start justify-center p-4 pt-20 font-sans">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/55 p-5 text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-pulse rounded-xl border border-gold-400/20 bg-gold-500/10" />
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gold-300">Reserva publica</p>
          <h1 className="font-display text-xl font-bold text-white mb-2">Carregando barbearia...</h1>
          <p className="text-sm text-gray-400">Preparando a agenda.</p>
        </div>
      </div>
    );
  }

  if (barbershopError) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4 font-sans">
        <div className="glass-card w-full max-w-lg rounded-3xl p-7 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-300">
            <Scissors size={30} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-red-300">Link indisponivel</p>
          <h1 className="font-display text-2xl font-bold text-white mb-3">{barbershopError}</h1>
          <p className="text-sm text-gray-400">Confira o link recebido ou fale diretamente com a barbearia.</p>
        </div>
      </div>
    );
  }

  if (createdAppointment) {
    const whatsappLink = contactLinks.whatsapp;
    const whenLabel = formatPublicBookingDateTimeLabel(createdAppointment.startAt);

    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4 font-sans">
        <div className="glass-card w-full max-w-lg rounded-3xl p-7 text-center animate-slide-in">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-green-500/10 border border-green-400/20 flex items-center justify-center text-green-300 mb-5">
            <CheckCircle size={42} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-green-300">Reserva confirmada</p>
          <h1 className="font-display text-2xl font-bold text-white mb-2">Horario reservado com sucesso</h1>
          <p className="text-gray-400 text-sm mb-6">A barbearia ja recebeu seu agendamento. O pagamento, quando houver, e combinado diretamente no atendimento.</p>

          <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-4 text-left space-y-3 mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Resumo confirmado</p>
            <SummaryRow label="Barbearia" value={branding.shopName} />
            <SummaryRow label="Cliente" value={createdAppointment.clientName} />
            <SummaryRow label="Servico" value={`${createdAppointment.serviceType} · ${formatCurrency(createdAppointment.serviceValue)}`} />
            <SummaryRow label="Barbeiro" value={createdAppointment.barberName} />
            <SummaryRow label="Horario" value={whenLabel} highlight />
            <p className="inline-flex rounded-full border border-green-400/20 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-200">Status: solicitado</p>
          </div>

          <div className="flex flex-col xs:flex-row gap-3">
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 text-green-300 font-bold py-3 rounded-xl">
                <MessageCircle size={18} />
                Falar com a barbearia
              </a>
            )}
            <button onClick={handleNewBooking} className="flex-1 bg-gold-500 hover:bg-gold-600 text-black font-bold py-3 rounded-xl">
              Nova reserva
            </button>
          </div>
          <a href="/" className="inline-block text-xs text-gray-500 hover:text-white mt-5">Ir para o painel interno</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <img src="/brand-mark.svg" alt={`Marca da ${branding.shopName}`} className="w-12 h-12" decoding="async" />
            <div>
              <h1 className="text-white font-display font-bold text-lg">{branding.shopName}</h1>
              <p className="text-gold-400 text-[10px] uppercase tracking-widest font-bold">Reserva oficial</p>
            </div>
          </div>
          {contactLinks.whatsapp && (
            <a href={contactLinks.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-green-400/20 bg-green-500/10 px-3 py-2 text-sm font-bold text-green-200">
              <Phone size={16} />
              WhatsApp
            </a>
          )}
        </header>

        <section className="glass-card overflow-hidden rounded-3xl mb-5">
          <div className="relative min-h-[300px] md:min-h-[340px]" style={brandingHeaderStyle}>
            {branding.coverImageUrl && (
              <img
                src={branding.coverImageUrl}
                alt={`Capa da ${branding.shopName}`}
                className="absolute inset-0 h-full w-full object-cover"
                decoding="async"
                fetchPriority="high"
                loading="eager"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/62 to-gray-950/95" />
            <div className="relative flex min-h-[300px] flex-col justify-between p-5 md:min-h-[340px] md:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-100">
                  <CalendarCheck size={14} />
                  {landingContent.eyebrow}
                </span>
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-gray-200 md:justify-end">
                  {contactLinks.instagram && (
                    <a href={contactLinks.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-pink-400/20 bg-pink-500/10 px-3 py-2 text-pink-100">
                      <MessageCircle size={14} />
                      Instagram
                    </a>
                  )}
                  {contactLinks.address && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/35 px-3 py-2">
                      <MapPin size={14} />
                      Localizacao
                    </span>
                  )}
                </div>
              </div>

              <div className="max-w-2xl">
                <div className="mb-4 flex h-18 w-18 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-gray-950/75 text-gold-300 shadow-xl shadow-black/30 md:h-20 md:w-20">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt={`Logo da ${branding.shopName}`} className="h-full w-full object-cover" decoding="async" />
                  ) : (
                    <Scissors size={28} />
                  )}
                </div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-gold-300">{landingContent.eyebrow}</p>
                <h2 className="font-display text-3xl font-black leading-tight text-white md:text-5xl">{landingContent.headline}</h2>
                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-gray-300">{landingContent.subheadline}</p>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-200 md:text-base">{landingContent.description}</p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a href="#booking-flow" className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-black text-black" style={heroCtaStyle}>
                    {landingContent.ctaLabel}
                  </a>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {landingContent.trustItems.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur">
                    <CheckCircle size={16} className="mb-1.5 text-green-300" />
                    <p className="text-sm font-bold text-white">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-2.5 mb-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {bookingSteps.map((step, index) => (
              <div
                key={step.key}
                className={`rounded-xl border px-2 py-3 text-center transition-all ${
                  step.active ? 'bg-white/10 text-white' : step.complete ? 'bg-green-500/10 text-green-200 border-green-400/20' : 'bg-gray-900/50 text-gray-500 border-gray-700'
                }`}
                style={step.active ? selectedCardStyle : undefined}
              >
                <p className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-xs font-bold">{index + 1}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide">{step.label}</p>
              </div>
            ))}
          </div>
        </section>

        <main id="booking-flow" className="grid scroll-mt-6 lg:grid-cols-[0.82fr_1.18fr] gap-4 items-start">
          <section className="glass-card rounded-3xl p-5 md:p-6 lg:sticky lg:top-5">
            <div className="flex items-center gap-2 text-gold-400 mb-3">
              <CalendarCheck size={22} />
              <span className="text-xs font-bold uppercase tracking-widest">Reserva em poucos passos</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Reserve em poucos segundos</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-5">Escolha profissional, servico, data e horario. Antes de confirmar, confira o resumo da reserva.</p>

            <div className="grid xs:grid-cols-2 gap-3">
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                <Clock className="text-blue-300 mb-2" size={20} />
                <p className="text-white font-bold text-sm">{workdayLabel}</p>
                <p className="text-gray-500 text-xs">{workdayDescription}</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                <Scissors className="text-gold-400 mb-2" size={20} />
                <p className="text-white font-bold text-sm">{services.length} servicos</p>
                <p className="text-gray-500 text-xs">Agenda por servico</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-700 bg-gray-950/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Sua reserva</p>
                  <h3 className="font-display text-lg font-bold text-white">Resumo rapido</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${bookingSummary.ready ? 'bg-green-500/10 text-green-200 border border-green-400/20' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                  {bookingSummary.ready ? 'Pronto' : 'Em andamento'}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <SummaryRow label="Barbeiro" value={bookingSummary.barberName} />
                <SummaryRow label="Servico" value={bookingSummary.serviceName} />
                <SummaryRow label="Valor" value={bookingSummary.serviceValue} />
                <SummaryRow label="Duracao" value={bookingSummary.duration} />
                <SummaryRow label="Horario" value={selectedDateTimeLabel} highlight={Boolean(selectedSlot)} />
              </div>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-5 md:p-6 space-y-5">
            {!bookingReadiness.ready && (
              <div className="bg-amber-500/10 border border-amber-400/20 text-amber-100 text-sm rounded-xl p-3 space-y-1">
                <p className="font-semibold text-amber-200">Antes de agendar, esta barbearia precisa concluir a configuracao:</p>
                {bookingReadiness.issues.map((issue) => <p key={issue}>{issue}</p>)}
              </div>
            )}

            {barberOptions.length === 0 && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl p-3">
                Esta barbearia ainda nao tem barbeiros ativos. O owner precisa cadastrar ou ativar um barbeiro no painel interno.
              </div>
            )}

            {errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-xl p-3 space-y-1">
                {errors.map(error => <p key={error}>{error}</p>)}
              </div>
            )}

            <div className="space-y-3">
              <SectionTitle step="01" title="Profissional" description="Escolha quem vai te atender." />
              {barberOptions.length === 0 ? (
                <EmptyState message="Nenhum barbeiro ativo nesta barbearia. Assim que a equipe for configurada, os profissionais aparecerao aqui." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {barberOptions.map((barber) => {
                    const selected = selectedBarber?.value === barber.value;
                    return (
                      <button
                        key={barber.value}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${selected ? 'Barbeiro selecionado' : 'Escolher barbeiro'}: ${barber.name}`}
                        onClick={() => handleBarberChange(barber.value)}
                        className={`rounded-2xl border p-3.5 text-left transition-all ${selected ? 'bg-white/10 text-white' : 'bg-gray-900/60 text-gray-300 border-gray-700 hover:border-gray-500'}`}
                        style={selected ? selectedCardStyle : undefined}
                      >
                        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-black/30 text-gold-300">
                          <Scissors size={20} />
                        </span>
                        <span className="block font-bold">{barber.name}</span>
                        <span className="mt-1 block text-xs text-gray-500">{selected ? 'Selecionado' : 'Toque para escolher'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <SectionTitle step="02" title="Servico" description="Confira valor e duracao." />
              {services.length === 0 ? (
                <EmptyState message="Nenhum servico ativo nesta barbearia. O agendamento publico sera liberado quando houver pelo menos um servico cadastrado." />
              ) : (
                <div className="grid gap-3">
                  {services.map((service: Service) => {
                    const selected = selectedService?.id === service.id;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${selected ? 'Servico selecionado' : 'Escolher servico'}: ${service.name}, ${formatCurrency(service.price)}, ${service.durationMinutes} minutos`}
                        onClick={() => handleServiceChange(service.id)}
                        className={`rounded-2xl border p-3.5 text-left transition-all ${selected ? 'bg-white/10 text-white' : 'bg-gray-900/60 text-gray-300 border-gray-700 hover:border-gray-500'}`}
                        style={selected ? selectedCardStyle : undefined}
                      >
                        <span className="flex items-start justify-between gap-4">
                          <span>
                            <span className="block font-bold">{service.name}</span>
                            <span className="mt-1 block text-xs text-gray-500">{service.durationMinutes} min</span>
                          </span>
                          <span className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white">
                            {formatCurrency(service.price)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sr-only">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Barbeiro</label>
                <select
  id="public-booking-barber"
  name="barberId"
  required
  value={selectedBarber?.value || ''}
  onChange={(e) => handleBarberChange(e.target.value)}
  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
>
  <option value="" disabled>
    Selecione um barbeiro
  </option>

  {barberOptions.map((barber) => (
    <option key={barber.value} value={barber.value}>
      {barber.name}
    </option>
  ))}
</select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Servico</label>
                <select required
                  value={selectedService?.id || ''}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500">
                  {services.map((service: Service) => (
                    <option key={service.id} value={service.id}>{service.name} · {formatCurrency(service.price)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <SectionTitle step="03" title="Horario" description="Escolha data e horario livre." />
              <div className="rounded-2xl border border-gray-700 bg-gray-900/60 p-4" style={subtleAccentStyle}>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Data</label>
                <input type="date" required min={getTodayString()} value={date} onChange={(e) => { setDate(e.target.value); setSelectedSlot(null); }} className="w-full bg-gray-950/80 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Horarios disponiveis</label>
              {availableSlots.length === 0 ? (
                <p className="text-sm text-gray-400 bg-gray-900/50 border border-gray-700 rounded-2xl p-4">
  {emptySlotsMessage} {emptySlotsNextStep}
</p>
              ) : (
                <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 gap-2">
                  {availableSlots.map(slot => (
                    <button
                      key={slot.startAt}
                      type="button"
                      aria-pressed={selectedSlot?.startAt === slot.startAt}
                      aria-label={`${selectedSlot?.startAt === slot.startAt ? 'Horario selecionado' : 'Escolher horario'}: ${slot.label}`}
                      onClick={() => setSelectedSlot(slot)}
                      style={selectedSlot?.startAt === slot.startAt ? selectedCardStyle : undefined}
                      className={`py-3.5 rounded-2xl border text-sm font-bold transition-all ${
                        selectedSlot?.startAt === slot.startAt
                          ? 'bg-white/10 text-white'
                          : 'bg-gray-900/70 text-gray-300 border-gray-700 hover:border-gold-500/40'
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <SectionTitle step="04" title="Seus dados" description="Informe nome e WhatsApp." />
              <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Seu nome</label>
                <input required value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome de quem vai ser atendido" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">WhatsApp</label>
                <input required value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Ex: 81999999999" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500" />
              </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Observacoes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Opcional: detalhe alguma preferencia para o atendimento" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500" />
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-950/70 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">Confira sua reserva</p>
              <div className="grid gap-2 text-sm text-gray-300 sm:grid-cols-2">
                <SummaryRow label="Barbearia" value={branding.shopName} />
                <SummaryRow label="Barbeiro" value={bookingSummary.barberName} />
                <SummaryRow label="Servico" value={bookingSummary.serviceName} />
                <SummaryRow label="Data" value={bookingDateLabel} />
                <SummaryRow label="Horario" value={bookingSummary.slotLabel} highlight={Boolean(selectedSlot)} />
                <SummaryRow label="Duracao" value={bookingSummary.duration} />
                <SummaryRow label="Valor" value={bookingSummary.serviceValue} highlight={Boolean(selectedService)} />
                <SummaryRow label="Cliente" value={clientName.trim() || 'Informe seu nome'} />
                <SummaryRow label="Status" value={isSubmitDisabled ? 'Faltam dados' : 'Pronto para reservar'} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-gray-500">
                Revise os dados antes de confirmar. Esta etapa reserva o horario, mas nao confirma pagamento online.
              </p>
            </div>

            <button type="submit" disabled={isSubmitDisabled} style={primaryActionStyle} className="w-full disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-2xl shadow-lg">
              {isSubmitting ? 'Confirmando...' : 'Reservar horario'}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
};
