import React, { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Copy, ExternalLink, Link2, Package, Scissors, Store } from 'lucide-react';
import { BarberOption, Barbershop, Service } from '../types';
import { AuthSession, AppRole } from '../services/authRepository';
import { getBarbershopPublicBookingPath } from '../services/barbershopRepository';

type OwnerSetupChecklistProps = {
  role?: AppRole | null;
  authSession?: AuthSession | null;
  barbershop: Barbershop | null;
  barbers: BarberOption[];
  services: Service[];
};

export type OwnerSetupChecklistState = {
  ready: boolean;
  issues: string[];
  publicBookingPath: string | null;
  items: Array<{
    key:
      | 'barbershop-loaded'
      | 'barbershop-active'
      | 'slug'
      | 'business-hours'
      | 'slot-step'
      | 'active-barbers'
      | 'active-services'
      | 'public-link';
    label: string;
    complete: boolean;
  }>;
};

const isValidOwnerSlotStepMinutes = (value?: number | null): boolean => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 5;
};

const hasAtLeastOneActiveBusinessDay = (businessHours?: Barbershop['businessHours'] | null): boolean => {
  if (!businessHours) return false;

  return Object.values(businessHours).some((day) => (
    Boolean(day?.active)
    && typeof day.open === 'string'
    && typeof day.close === 'string'
    && day.open < day.close
  ));
};

export const isOwnerSetupChecklistVisible = (role?: AppRole | null): boolean => role === 'owner';

export const getOwnerSetupChecklistState = ({
  authSession,
  barbershop,
  barbers,
  services
}: Omit<OwnerSetupChecklistProps, 'role'>): OwnerSetupChecklistState => {
  const authenticatedBarbershopId = authSession?.barbershopId?.trim() || null;
  const resolvedBarbershopId = authenticatedBarbershopId || barbershop?.id?.trim() || null;
  const hasLoadedBarbershop = Boolean(
    barbershop
    && resolvedBarbershopId
    && barbershop.id === resolvedBarbershopId
  );
  const hasActiveBarbershop = Boolean(hasLoadedBarbershop && barbershop?.active);
  const hasPublicSlug = Boolean(barbershop?.slug?.trim());
  const hasConfiguredBusinessHours = Boolean(
    hasLoadedBarbershop
    && barbershop?.hasConfiguredBusinessHours
    && hasAtLeastOneActiveBusinessDay(barbershop.businessHours)
  );
  const hasValidSlotStepMinutes = Boolean(
    hasLoadedBarbershop
    && barbershop?.hasConfiguredSlotStepMinutes
    && isValidOwnerSlotStepMinutes(barbershop.slotStepMinutes)
  );

  const scopedBarbers = authenticatedBarbershopId
    ? barbers.filter((barber) => barber.barbershopId === authenticatedBarbershopId)
    : barbers;
  const scopedServices = authenticatedBarbershopId
    ? services.filter((service) => service.barbershopId === authenticatedBarbershopId)
    : services;

  const hasActiveBarbers = scopedBarbers.some((barber) => barber.active !== false);
  const hasActiveServices = scopedServices.some((service) => service.active !== false);
  const publicBookingPath = hasPublicSlug && barbershop?.slug
    ? getBarbershopPublicBookingPath(barbershop.slug)
    : null;

  const items: OwnerSetupChecklistState['items'] = [
    { key: 'barbershop-loaded', label: 'Barbearia carregada', complete: hasLoadedBarbershop },
    { key: 'barbershop-active', label: 'Barbearia ativa', complete: hasActiveBarbershop },
    { key: 'slug', label: 'Slug publico disponivel', complete: hasPublicSlug },
    { key: 'business-hours', label: 'Horario de funcionamento configurado', complete: hasConfiguredBusinessHours },
    { key: 'slot-step', label: 'Intervalo de agenda valido', complete: hasValidSlotStepMinutes },
    { key: 'active-barbers', label: 'Pelo menos 1 barbeiro ativo', complete: hasActiveBarbers },
    { key: 'active-services', label: 'Pelo menos 1 servico ativo', complete: hasActiveServices },
    { key: 'public-link', label: 'Link publico /book/:slug disponivel', complete: Boolean(publicBookingPath) }
  ];

  const issues = items
    .filter((item) => !item.complete)
    .map((item) => {
      switch (item.key) {
        case 'barbershop-loaded':
          return 'Barbearia do tenant autenticado nao foi carregada.';
        case 'barbershop-active':
          return 'Barbearia inativa.';
        case 'slug':
          return 'Slug publico indisponivel.';
        case 'business-hours':
          return 'Horarios de funcionamento nao configurados.';
        case 'slot-step':
          return 'Intervalo de agenda invalido.';
        case 'active-barbers':
          return 'Nenhum barbeiro ativo.';
        case 'active-services':
          return 'Nenhum servico ativo.';
        case 'public-link':
          return 'Link publico de agendamento indisponivel.';
        default:
          return 'Configuracao operacional pendente.';
      }
    });

  return {
    ready: issues.length === 0,
    issues,
    publicBookingPath,
    items
  };
};

export const OwnerSetupChecklist: React.FC<OwnerSetupChecklistProps> = ({
  role,
  authSession,
  barbershop,
  barbers,
  services
}) => {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const checklist = useMemo(
    () => getOwnerSetupChecklistState({ authSession, barbershop, barbers, services }),
    [authSession, barbers, barbershop, services]
  );

  if (!isOwnerSetupChecklistVisible(role)) {
    return null;
  }

  const handleCopyLink = async () => {
    if (!checklist.publicBookingPath || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(checklist.publicBookingPath);
      setCopyFeedback('Link copiado.');
    } catch {
      setCopyFeedback('Nao foi possivel copiar o link.');
    }
  };

  return (
    <section className="mb-6 rounded-3xl border border-gray-700 bg-gray-800/80 p-5 shadow-xl shadow-black/10">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-emerald-300">
            <Store size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Setup do booking</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Prontidao operacional</h2>
          <p className="mt-1 text-sm text-gray-400">Confira se sua barbearia ja tem o minimo necessario para receber agendamentos no link publico.</p>
        </div>

        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold ${
          checklist.ready
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
            : 'border-amber-500/20 bg-amber-500/10 text-amber-200'
        }`}>
          {checklist.ready ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
          {checklist.ready ? 'Booking pronto para receber agendamentos.' : 'Booking incompleto.'}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {checklist.items.map((item) => (
          <div
            key={item.key}
            className={`rounded-2xl border px-4 py-3 ${
              item.complete
                ? 'border-emerald-500/15 bg-emerald-500/5'
                : 'border-gray-700 bg-gray-900/50'
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              {item.key === 'active-barbers' ? <Scissors size={15} className="text-blue-300" /> : null}
              {item.key === 'active-services' ? <Package size={15} className="text-gold-300" /> : null}
              {item.key === 'public-link' ? <Link2 size={15} className="text-sky-300" /> : null}
              {!['active-barbers', 'active-services', 'public-link'].includes(item.key) ? (
                item.complete ? <CheckCircle2 size={15} className="text-emerald-300" /> : <CircleAlert size={15} className="text-amber-300" />
              ) : null}
              <span className="text-sm font-semibold text-white">{item.label}</span>
            </div>
            <p className={`text-xs ${item.complete ? 'text-emerald-200/80' : 'text-gray-400'}`}>
              {item.complete ? 'OK' : 'Pendente'}
            </p>
          </div>
        ))}
      </div>

      {checklist.publicBookingPath && (
        <div className="mt-5 rounded-2xl border border-gray-700 bg-gray-900/50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Link publico</p>
          <p className="mt-2 break-all font-mono text-sm text-gold-300">{checklist.publicBookingPath}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={checklist.publicBookingPath}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-600 bg-gray-900 px-3 py-2 text-sm font-bold text-white"
            >
              <ExternalLink size={14} />
              Abrir link
            </a>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-600 bg-gray-900 px-3 py-2 text-sm font-bold text-white"
            >
              <Copy size={14} />
              Copiar link
            </button>
          </div>
          {copyFeedback && (
            <p className="mt-2 text-xs text-gray-400">{copyFeedback}</p>
          )}
        </div>
      )}

      {!checklist.ready && (
        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-sm font-bold text-amber-100">Pendencias para ativar o booking</p>
          <ul className="mt-3 space-y-2 text-sm text-amber-50/90">
            {checklist.issues.map((issue) => (
              <li key={issue} className="flex items-start gap-2">
                <CircleAlert size={14} className="mt-0.5 shrink-0 text-amber-300" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
