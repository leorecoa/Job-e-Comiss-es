import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, MapPin, MessageCircle, Phone, Scissors } from 'lucide-react';
import { Appointment, AppSettings, BarberOption, Barbershop, Service, UserProfile } from '../types';
import { getBarbershopBySlug } from '../services/barbershopRepository';
import { listPublicAvailability } from '../services/appointmentRepository';
import { shouldUseLocalFallback } from '../lib/supabase';
import { BarberPhoto } from './BarberPhoto';
import {
  DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES,
  createPublicAppointment,
  getAvailableTimeSlots,
  getPublicBookingWorkdayForDate,
  isAppointmentConflictError,
  PUBLIC_BOOKING_ACTIVE_LIMIT_MESSAGE,
  PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE,
  PUBLIC_BOOKING_RATE_LIMIT_MESSAGE,
  PublicBookingInput,
  TimeSlot,
  validatePublicAppointmentRecord,
  validatePublicBookingInput
} from '../scheduling';
import { formatCurrency, generateId } from '../utils';
import { getOperationalErrorMessage, logOperationalError } from '../utils/errorHandling';

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
  photoPath?: string | null;
};

const getTodayString = (timeZone?: string | null): string => {
  const d = new Date();
  if (timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
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
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-muted text-[11px] font-black text-foreground">
      {step}
    </span>
    <span>
      <span className="block font-display text-lg font-bold text-foreground">{title}</span>
      <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
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
      : 'ui-owner-empty'
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
  <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-3 py-2">
    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className={`text-right text-sm font-bold ${highlight ? 'text-gold-700' : 'text-foreground'}`}>{value}</span>
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
      photoPath: barber.photoPath,
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

const DEFAULT_PUBLIC_BOOKING_DESCRIPTION = 'Corte, barba e acabamento com horário marcado.';

export const getPublicBookingLandingContent = (branding: ReturnType<typeof getPublicBookingBranding>) => {
  const description = branding.description
    || (branding.shopName === 'Escolha uma barbearia'
      ? 'Use o link público da sua barbearia para abrir a agenda correta.'
      : DEFAULT_PUBLIC_BOOKING_DESCRIPTION);

  return {
    eyebrow: 'Reserva oficial',
    headline: branding.shopName,
    subheadline: 'Agende seu horário',
    description,
    ctaLabel: 'Agendar agora',
    trustItems: ['Horário reservado', 'Atendimento por barbeiro']
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
    { key: 'service', label: 'Serviço', complete: hasService },
    { key: 'slot', label: 'Horário', complete: hasSlot },
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

const formatPublicBookingDateTimeLabel = (isoDate: string, timeZone?: string | null): string => {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return 'Horário agendado';
  }

  return `${date.toLocaleDateString('pt-BR', { timeZone: timeZone || undefined })} às ${date.toLocaleTimeString('pt-BR', {
    timeZone: timeZone || undefined,
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
  serviceName: service?.name || 'Selecione um serviço',
  serviceValue: service ? formatCurrency(service.price) : '--',
  duration: service ? `${service.durationMinutes} min` : '--',
  slotLabel: slot?.label || 'Selecione um horário',
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
  services,
  localAvailability = true
}: {
  barbershop: Barbershop | null;
  barbers: PublicBarberOption[];
  services: Service[];
  localAvailability?: boolean;
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
    if (localAvailability && !hasConfiguredBusinessHours) {
      issues.push('Horários de funcionamento não configurados.');
    }
    if (localAvailability && !hasValidSlotStepMinutes) {
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
    : error instanceof Error && [PUBLIC_BOOKING_RATE_LIMIT_MESSAGE, PUBLIC_BOOKING_ACTIVE_LIMIT_MESSAGE].includes(error.message)
      ? error.message
      : 'Não foi possível confirmar este horário. Tente novamente.'
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
    throw new Error('Barbearia não encontrada ou indisponível.');
  }

  if (!selectedBarber?.id) {
    throw new Error('Selecione um barbeiro.');
  }

  if (!selectedService?.id) {
    throw new Error('Selecione um serviço.');
  }

  if (!selectedSlot) {
    throw new Error('Selecione um horário.');
  }

  if (selectedBarber.barbershopId && selectedBarber.barbershopId !== barbershop.id) {
    throw new Error('O barbeiro selecionado não pertence a esta barbearia.');
  }

  if (selectedService.barbershopId && selectedService.barbershopId !== barbershop.id) {
    throw new Error('O serviço selecionado não pertence a esta barbearia.');
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
  const [date, setDate] = useState(shouldUseLocalFallback ? getTodayString() : '');
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [remoteAvailability, setRemoteAvailability] = useState<{ key: string; slots: TimeSlot[]; error: string | null }>({ key: '', slots: [], error: null });
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [loadingBarbershop, setLoadingBarbershop] = useState(false);
  const [barbershopError, setBarbershopError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setSubmitting] = useState(false);
  const submissionInFlightRef = useRef(false);
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
  const primaryActionStyle = {
    backgroundColor: primaryColor,
    boxShadow: `0 18px 36px ${primaryColor}24`
  };
  const selectedCardStyle = {
    borderColor: primaryColor,
    boxShadow: `0 18px 35px ${primaryColor}1f`
  };
  const subtleAccentStyle = {
    borderColor: `${secondaryColor}66`
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
      services,
      localAvailability: shouldUseLocalFallback
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
        logOperationalError('public-booking:load-barbershop', error);
        setBarbershop(null);
        setBarbershopError(getOperationalErrorMessage(
          error,
          'Não foi possível carregar esta barbearia. Tente novamente.',
          { networkMessage: 'Não foi possível conectar ao sistema de agendamento. Tente novamente.' }
        ));
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
  const availabilityKey = JSON.stringify([barbershopSlug, serviceId, selectedBarber?.id, date, barbershop?.operationalTimezone, availabilityRevision]);
  const canLoadAvailability = Boolean(barbershop && selectedService && selectedBarber && date);
  const availabilityLoading = !shouldUseLocalFallback && canLoadAvailability && remoteAvailability.key !== availabilityKey;
  const availabilityError = !shouldUseLocalFallback && remoteAvailability.key === availabilityKey ? remoteAvailability.error : null;

  useEffect(() => {
    if (!shouldUseLocalFallback && barbershop) setDate((current) => current || getTodayString(barbershop.operationalTimezone));
  }, [barbershop]);

  useEffect(() => {
    if (shouldUseLocalFallback) return;
    setSelectedSlot(null);
    if (!canLoadAvailability || !barbershopSlug || !selectedBarber) return;
    setRemoteAvailability({ key: '', slots: [], error: null });
    const controller = new AbortController();
    let active = true;
    listPublicAvailability({ slug: barbershopSlug, serviceId, barberId: selectedBarber.id, localDate: date }, controller.signal)
      .then((slots) => {
        if (!active) return;
        if (!barbershop?.operationalTimezone) throw new Error('A agenda desta barbearia precisa ser configurada. Entre em contato com a barbearia.');
        const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: barbershop.operationalTimezone, hour: '2-digit', minute: '2-digit' });
        setRemoteAvailability({ key: availabilityKey, error: null, slots: slots.map((slot) => ({
          startAt: slot.start_at, endAt: slot.end_at, available: true, label: formatter.format(new Date(slot.start_at))
        })) });
      })
      .catch((error) => {
        if (!active) return;
        const configurationMessage = 'A agenda desta barbearia precisa ser configurada. Entre em contato com a barbearia.';
        setRemoteAvailability({ key: availabilityKey, slots: [], error: error instanceof Error && error.message === configurationMessage ? configurationMessage : 'Não foi possível consultar os horários. Tente novamente.' });
      });
    return () => { active = false; controller.abort(); };
  }, [availabilityKey, canLoadAvailability]);
  const selectedDateTimeLabel = selectedSlot
    ? `${bookingDateLabel} às ${selectedSlot.label}`
    : 'Selecione data e horário';
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
    () => shouldUseLocalFallback && bookingReadiness.hasConfiguredBusinessHours
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

  const workdayLabel = !shouldUseLocalFallback ? 'Disponibilidade da barbearia' : selectedWorkday
    ? `${selectedWorkday.start} - ${selectedWorkday.end}`
    : 'Fechado';

  const workdayDescription = !shouldUseLocalFallback ? 'Horários consultados no sistema de agendamento.' : selectedWorkday
    ? workdayHasValidRange
      ? `Expediente do dia selecionado · intervalos de ${slotStepMinutes} min`
      : 'Horário configurado de forma inválida para este dia'
    : !bookingReadiness.hasConfiguredBusinessHours
      ? 'Defina os horários de funcionamento no painel interno.'
      : !bookingReadiness.hasValidSlotStepMinutes
        ? 'Intervalo de agenda inválido para esta barbearia.'
        : 'Sem atendimento neste dia';

  const emptySlotsMessage = !shouldUseLocalFallback ? 'Nenhum horário disponível para esta data.' : selectedWorkday
    ? workdayHasValidRange
      ? 'Nenhum horário disponível para esta combinação.'
      : 'Horário de funcionamento indisponível neste dia.'
    : !bookingReadiness.hasConfiguredBusinessHours
      ? 'Horários de funcionamento não configurados para esta barbearia.'
      : !bookingReadiness.hasValidSlotStepMinutes
        ? 'Intervalo de agenda inválido para esta barbearia.'
        : 'A barbearia não atende neste dia.';
  const emptySlotsNextStep = contactLinks.whatsapp
    ? 'Escolha outra data, tente outro profissional ou fale com a barbearia pelo WhatsApp.'
    : 'Escolha outra data ou tente outro profissional, se houver outro disponível.';
  
  const availableSlots = useMemo(() => {
    if (!shouldUseLocalFallback) return remoteAvailability.key === availabilityKey ? remoteAvailability.slots : [];
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
  }, [appointments, barbershop?.businessHours, barbershop?.slotStepMinutes, bookingReadiness.ready, date, selectedBarber, selectedService, remoteAvailability, availabilityKey]);

  const validateBooking = (input: PublicBookingInput) => {
    if (shouldUseLocalFallback) return validatePublicBookingInput(input, appointments, { barbers: barberOptions, services, availableSlots });
    try {
      const record = createPublicAppointment(input, 'validation');
      const errors = validatePublicAppointmentRecord(record);
      if (!availableSlots.some((slot) => slot.startAt === input.selectedSlot?.startAt && slot.endAt === input.selectedSlot?.endAt)) errors.push('Escolha um horário disponível.');
      return { valid: errors.length === 0, errors };
    } catch {
      return { valid: false, errors: ['Preencha seus dados e escolha um horário disponível.'] };
    }
  };
  const bookingValidation = validateBooking({
    clientName,
    clientPhone,
    barbershopId: barbershop?.id || '',
    barberId: selectedBarber?.id,
    barberName: selectedBarber?.name || '',
    service: selectedService,
    selectedSlot,
    notes
  });

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

  if (submissionInFlightRef.current) return;

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
    setErrors(['O barbeiro selecionado não pertence a esta barbearia.']);
    return;
  }

  if (selectedService.barbershopId && selectedService.barbershopId !== barbershop.id) {
    setErrors(['O serviço selecionado não pertence a esta barbearia.']);
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
  const validation = validateBooking(input);

  if (!validation.valid) {
    setErrors(validation.errors);
    return;
  }

  const appointment = createPublicAppointment(input, generateId());

  

  submissionInFlightRef.current = true;
  setSubmitting(true);

  try {
    await onCreateAppointment(appointment);
    setCreatedAppointment(appointment);
    setErrors([]);
  } catch (error) {
    logOperationalError('public-booking:submit', error);
    setErrors([getPublicBookingSubmissionErrorMessage(error)]);
  } finally {
    submissionInFlightRef.current = false;
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
    if (!shouldUseLocalFallback) setAvailabilityRevision((revision) => revision + 1);
    setCreatedAppointment(null);
    setSelectedSlot(null);
    setClientName('');
    setClientPhone('');
    setNotes('');
  };

  if (loadingBarbershop) {
    return (
      <div className="ui-public-shell min-h-screen flex items-start justify-center p-4 pt-20 font-sans">
        <div className="ui-surface w-full max-w-md p-5 text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-pulse rounded-xl border border-gold-400/20 bg-gold-500/10" />
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gold-300">Reserva publica</p>
          <h1 className="font-display text-xl font-bold mb-2">Carregando barbearia...</h1>
          <p className="ui-owner-help text-sm">Preparando a agenda.</p>
        </div>
      </div>
    );
  }

  if (barbershopError) {
    return (
      <div className="ui-public-shell min-h-screen flex items-center justify-center p-4 font-sans">
        <div className="ui-surface w-full max-w-lg rounded-3xl p-7 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-300">
            <Scissors size={30} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-red-300">Link indisponível</p>
          <h1 className="font-display text-2xl font-bold mb-3">{barbershopError}</h1>
          <p className="ui-owner-help text-sm">Confira o link recebido ou fale diretamente com a barbearia.</p>
        </div>
      </div>
    );
  }

  if (createdAppointment) {
    const whatsappLink = contactLinks.whatsapp;
    const whenLabel = formatPublicBookingDateTimeLabel(createdAppointment.startAt, shouldUseLocalFallback ? undefined : barbershop?.operationalTimezone);

    return (
      <div className="ui-public-shell min-h-screen flex items-center justify-center p-4 font-sans">
        <div className="ui-surface w-full max-w-lg rounded-3xl p-7 text-center animate-slide-in">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-green-500/10 border border-green-400/20 flex items-center justify-center text-green-300 mb-5">
            <CheckCircle size={42} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-green-300">Reserva confirmada</p>
          <h1 className="font-display text-2xl font-bold mb-2">Horário reservado com sucesso</h1>
          <p className="ui-owner-help text-sm mb-6">A barbearia já recebeu seu agendamento. O pagamento, quando houver, é combinado diretamente no atendimento.</p>

          <div className="ui-owner-card rounded-2xl p-4 text-left space-y-3 mb-6">
            <p className="ui-owner-help text-xs font-bold uppercase tracking-widest">Resumo confirmado</p>
            <SummaryRow label="Barbearia" value={branding.shopName} />
            <SummaryRow label="Cliente" value={createdAppointment.clientName} />
            <SummaryRow label="Serviço" value={`${createdAppointment.serviceType} · ${formatCurrency(createdAppointment.serviceValue)}`} />
            <SummaryRow label="Barbeiro" value={createdAppointment.barberName} />
            <SummaryRow label="Horário" value={whenLabel} highlight />
            <p className="ui-owner-status-success inline-flex rounded-full px-3 py-1 text-xs font-bold">Status: solicitado</p>
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
          <a href="/" className="mt-5 inline-block text-xs text-muted-foreground hover:text-foreground">Ir para o painel interno</a>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-public-shell min-h-screen p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <section className="ui-surface overflow-hidden rounded-3xl mb-5" aria-label="Sobre a barbearia">
          {branding.coverImageUrl && (
            <img
              src={branding.coverImageUrl}
              alt={`Capa da ${branding.shopName}`}
              className="h-40 w-full object-cover sm:h-52 md:h-64"
              decoding="async"
              fetchPriority="high"
              loading="eager"
            />
          )}
          <div className="space-y-4 p-4 sm:p-6">
            <header className="flex items-center gap-3">
              {branding.logoUrl && (
                <img src={branding.logoUrl} alt={`Logo da ${branding.shopName}`} className="h-14 w-14 shrink-0 rounded-xl border border-border object-contain" decoding="async" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{landingContent.eyebrow}</p>
                <h1 className="font-display text-2xl font-bold break-words sm:text-3xl">{landingContent.headline}</h1>
              </div>
            </header>
            <p className="text-sm leading-relaxed text-muted-foreground">{landingContent.description}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-foreground">
              <span>{barberOptions.length} {barberOptions.length === 1 ? 'profissional' : 'profissionais'}</span>
              <span>{services.length} {services.length === 1 ? 'serviço' : 'serviços'}</span>
            </div>
            {contactLinks.address && (
              <p className="flex items-start gap-2 text-sm text-foreground">
                <MapPin size={18} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{contactLinks.address}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <a href="#booking-flow" className="ui-button ui-button-primary min-h-11 w-full justify-center sm:w-auto">
                {landingContent.ctaLabel}
              </a>
              {contactLinks.whatsapp && (
                <a href={contactLinks.whatsapp} target="_blank" rel="noreferrer" className="ui-button ui-button-secondary min-h-11">
                  <Phone size={16} aria-hidden="true" /> WhatsApp
                </a>
              )}
              {contactLinks.instagram && (
                <a href={contactLinks.instagram} target="_blank" rel="noreferrer" className="ui-button ui-button-secondary min-h-11">
                  <MessageCircle size={16} aria-hidden="true" /> Instagram
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="ui-surface mb-4 rounded-2xl p-2.5">
          <div className="grid grid-cols-5 gap-1 sm:gap-2">
            {bookingSteps.map((step, index) => (
              <div
                key={step.key}
                className={`min-w-0 rounded-xl border px-1 py-2 text-center transition-all ${
                  step.active ? 'ui-owner-badge' : step.complete ? 'ui-owner-status-success' : 'ui-owner-card text-muted-foreground'
                }`}
                style={step.active ? selectedCardStyle : undefined}
              >
                <p className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted text-xs font-bold">{index + 1}</p>
                <p className="text-[10px] font-bold sm:text-xs">{step.label}</p>
              </div>
            ))}
          </div>
        </section>

        <main id="booking-flow" className="grid scroll-mt-6 lg:grid-cols-[1.18fr_0.82fr] gap-4 items-start">

          <form onSubmit={handleSubmit} className="ui-surface rounded-3xl p-5 md:p-6 space-y-5">
            {!bookingReadiness.ready && (
              <div className="ui-owner-status-warning space-y-1 rounded-xl p-3 text-sm">
                <p className="font-semibold text-foreground">Antes de agendar, esta barbearia precisa concluir a configuração:</p>
                {bookingReadiness.issues.map((issue) => <p key={issue}>{issue}</p>)}
              </div>
            )}

            {barberOptions.length === 0 && (
              <div className="ui-owner-status-error rounded-xl p-3 text-sm">
                Esta barbearia ainda não tem barbeiros ativos. O owner precisa cadastrar ou ativar um barbeiro no painel interno.
              </div>
            )}

            {errors.length > 0 && (
              <div className="ui-owner-status-error space-y-1 rounded-xl p-3 text-sm">
                {errors.map(error => <p key={error}>{error}</p>)}
              </div>
            )}

            <div className="space-y-3">
              <SectionTitle step="01" title="Profissional" description="Escolha quem vai te atender." />
              {barberOptions.length === 0 ? (
                <EmptyState message="Nenhum barbeiro ativo nesta barbearia. Assim que a equipe for configurada, os profissionais aparecerão aqui." />
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
                        className={`rounded-2xl border p-3.5 text-left text-foreground transition-all ${selected ? 'ui-owner-card-solid' : 'ui-owner-card'}`}
                        style={selected ? selectedCardStyle : undefined}
                      >
                        <span className="mb-3 block"><BarberPhoto barber={barber} size="booking" /></span>
                        <span className="block font-bold">{barber.name}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{selected ? 'Selecionado' : 'Toque para escolher'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <SectionTitle step="02" title="Serviço" description="Confira valor e duração." />
              {services.length === 0 ? (
                <EmptyState message="Nenhum serviço ativo nesta barbearia. O agendamento público será liberado quando houver pelo menos um serviço cadastrado." />
              ) : (
                <div className="grid gap-3">
                  {services.map((service: Service) => {
                    const selected = selectedService?.id === service.id;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${selected ? 'Serviço selecionado' : 'Escolher serviço'}: ${service.name}, ${formatCurrency(service.price)}, ${service.durationMinutes} minutos`}
                        onClick={() => handleServiceChange(service.id)}
                        className={`rounded-2xl border p-3.5 text-left text-foreground transition-all ${selected ? 'ui-owner-card-solid' : 'ui-owner-card'}`}
                        style={selected ? selectedCardStyle : undefined}
                      >
                        <span className="flex items-start justify-between gap-4">
                          <span>
                            <span className="block font-bold">{service.name}</span>
                            <span className="mt-1 block text-xs text-muted-foreground">{service.durationMinutes} min</span>
                          </span>
                          <span className="ui-owner-badge rounded-xl px-3 py-2 text-sm font-bold">
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
                <label className="ui-label mb-1.5 block">Barbeiro</label>
                <select
  id="public-booking-barber"
  name="barberId"
  required
  value={selectedBarber?.value || ''}
  onChange={(e) => handleBarberChange(e.target.value)}
  className="ui-input w-full"
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
                <label className="ui-label mb-1.5 block">Serviço</label>
                <select required
                  value={selectedService?.id || ''}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="ui-input w-full">
                  {services.map((service: Service) => (
                    <option key={service.id} value={service.id}>{service.name} · {formatCurrency(service.price)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <SectionTitle step="03" title="Horário" description="Escolha data e horário livre." />
              <p className="text-xs text-muted-foreground">{workdayLabel} · {workdayDescription}</p>
              <div className="ui-owner-card rounded-2xl p-4" style={subtleAccentStyle}>
                <label className="ui-label mb-1.5 block">Data</label>
                <input type="date" required min={getTodayString(shouldUseLocalFallback ? undefined : barbershop?.operationalTimezone)} value={date} onChange={(e) => { setDate(e.target.value); setSelectedSlot(null); }} className="ui-input w-full" />
              </div>
            </div>

            <div>
              <label className="ui-label mb-2 block">Horários disponíveis</label>
              {availabilityLoading ? <p role="status">Consultando horários...</p> : availabilityError ? <p role="alert" className="ui-owner-status-error">{availabilityError}</p> : availableSlots.length === 0 ? (
                <p className="ui-owner-empty text-sm">
  {emptySlotsMessage} {emptySlotsNextStep}
</p>
              ) : (
                <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 gap-2">
                  {availableSlots.map(slot => (
                    <button
                      key={slot.startAt}
                      type="button"
                      aria-pressed={selectedSlot?.startAt === slot.startAt}
                      aria-label={`${selectedSlot?.startAt === slot.startAt ? 'Horário selecionado' : 'Escolher horário'}: ${slot.label}`}
                      onClick={() => setSelectedSlot(slot)}
                      style={selectedSlot?.startAt === slot.startAt ? selectedCardStyle : undefined}
                      className={`py-3.5 rounded-2xl border text-sm font-bold transition-all ${
                        selectedSlot?.startAt === slot.startAt
                          ? 'ui-owner-card-solid text-foreground'
                          : 'ui-owner-card text-foreground hover:border-gold-700'
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
                <label className="ui-label mb-1.5 block">Seu nome</label>
                <input required value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome de quem vai ser atendido" className="ui-input w-full" />
              </div>
              <div>
                <label className="ui-label mb-1.5 block">WhatsApp</label>
                <input required value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Ex: 81999999999" className="ui-input w-full" />
              </div>
              </div>
            </div>

            <div>
              <label className="ui-label mb-1.5 block">Observações</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Opcional: detalhe alguma preferência para o atendimento" className="ui-textarea w-full" />
            </div>

            {selectedSlot && <div className="ui-owner-card rounded-2xl p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Confira sua reserva</p>
              <div className="grid gap-2 text-sm text-foreground sm:grid-cols-2">
                <SummaryRow label="Barbearia" value={branding.shopName} />
                <SummaryRow label="Barbeiro" value={bookingSummary.barberName} />
                <SummaryRow label="Serviço" value={bookingSummary.serviceName} />
                <SummaryRow label="Data" value={bookingDateLabel} />
                <SummaryRow label="Horário" value={bookingSummary.slotLabel} highlight={Boolean(selectedSlot)} />
                <SummaryRow label="Duração" value={bookingSummary.duration} />
                <SummaryRow label="Valor" value={bookingSummary.serviceValue} highlight={Boolean(selectedService)} />
                <SummaryRow label="Cliente" value={clientName.trim() || 'Informe seu nome'} />
                <SummaryRow label="Status" value={isSubmitDisabled ? 'Faltam dados' : 'Pronto para reservar'} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Revise os dados antes de confirmar. Esta etapa reserva o horário, mas não confirma pagamento online.
              </p>
            </div>}

            <button type="submit" disabled={isSubmitDisabled} style={primaryActionStyle} className="w-full disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-2xl shadow-lg">
              {isSubmitting ? 'Confirmando...' : 'Reservar horário'}
            </button>
          </form>
          <aside aria-label="Resumo da reserva" className="ui-surface rounded-3xl p-4 lg:sticky lg:top-5">
            <h2 className="font-display text-lg font-bold mb-3">Sua reserva</h2>
            {!selectedBarber && !selectedService && !selectedSlot && (
              <p className="text-sm text-muted-foreground">Escolha profissional, serviço e horário para montar sua reserva.</p>
            )}
            <div className="space-y-2">
              {selectedBarber && <SummaryRow label="Barbeiro" value={bookingSummary.barberName} />}
              {selectedService && <>
                <SummaryRow label="Serviço" value={bookingSummary.serviceName} />
                <SummaryRow label="Valor" value={bookingSummary.serviceValue} />
                <SummaryRow label="Duração" value={bookingSummary.duration} />
              </>}
              {selectedSlot && <SummaryRow label="Horário" value={selectedDateTimeLabel} highlight />}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
};
