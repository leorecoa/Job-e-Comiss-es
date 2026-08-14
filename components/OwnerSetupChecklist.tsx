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
    description: string;
    nextStep: string;
    actionLabel?: string;
    actionHref?: string;
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
    {
      key: 'barbershop-loaded',
      label: 'Barbearia carregada',
      complete: hasLoadedBarbershop,
      description: 'Confirma que o painel esta usando a barbearia do owner autenticado.',
      nextStep: 'Entre novamente ou conclua a criacao da barbearia se este item continuar pendente.'
    },
    {
      key: 'barbershop-active',
      label: 'Barbearia ativa',
      complete: hasActiveBarbershop,
      description: 'A barbearia precisa estar ativa para operar o booking publico.',
      nextStep: 'Revise o cadastro da barbearia antes de divulgar o link.'
    },
    {
      key: 'slug',
      label: 'Slug publico disponivel',
      complete: hasPublicSlug,
      description: 'O slug define o endereco publico da barbearia em /book/:slug.',
      nextStep: 'Defina um slug valido na criacao da barbearia ou revise o cadastro do tenant.'
    },
    {
      key: 'business-hours',
      label: 'Horario de funcionamento configurado',
      complete: hasConfiguredBusinessHours,
      description: 'O booking usa estes dias e horarios para gerar a agenda publica.',
      nextStep: 'Configure pelo menos um dia aberto com abertura menor que fechamento.',
      actionLabel: 'Configurar horarios',
      actionHref: '#owner-barbershop-settings'
    },
    {
      key: 'slot-step',
      label: 'Intervalo de agenda valido',
      complete: hasValidSlotStepMinutes,
      description: 'O intervalo define de quantos em quantos minutos os horarios aparecem.',
      nextStep: 'Escolha um intervalo valido de agenda.',
      actionLabel: 'Configurar intervalo',
      actionHref: '#owner-barbershop-settings'
    },
    {
      key: 'active-barbers',
      label: 'Pelo menos 1 barbeiro ativo',
      complete: hasActiveBarbers,
      description: 'O cliente precisa escolher um profissional no booking publico.',
      nextStep: 'Cadastre ou ative pelo menos um barbeiro da sua barbearia.',
      actionLabel: 'Configurar barbeiros',
      actionHref: '#owner-catalog-manager'
    },
    {
      key: 'active-services',
      label: 'Pelo menos 1 servico ativo',
      complete: hasActiveServices,
      description: 'O cliente precisa escolher um servico com valor e duracao.',
      nextStep: 'Cadastre ou ative pelo menos um servico.',
      actionLabel: 'Configurar servicos',
      actionHref: '#owner-catalog-manager'
    },
    {
      key: 'public-link',
      label: 'Link publico /book/:slug disponivel',
      complete: Boolean(publicBookingPath),
      description: 'O link publico deve apontar para o slug real desta barbearia.',
      nextStep: 'Conclua o slug publico para gerar o link do booking.'
    }
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
  const nextPendingItem = checklist.items.find((item) => !item.complete);

  return (
    <section className="ui-owner-panel mb-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-emerald-300">
            <Store size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Setup do booking</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Prontidao operacional</h2>
          <p className="ui-owner-help mt-1">Confira se sua barbearia ja tem o minimo necessario para receber agendamentos no link publico.</p>
        </div>

        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold ${
          checklist.ready
            ? 'ui-owner-status-success'
            : 'ui-owner-status-warning'
        }`}>
          {checklist.ready ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
          {checklist.ready ? 'Booking pronto para receber agendamentos.' : 'Booking incompleto.'}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {checklist.items.map((item) => (
          <div
            key={item.key}
            className={`rounded-2xl px-4 py-3 ${
              item.complete
                ? 'ui-owner-status-success'
                : 'ui-owner-card'
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              {item.key === 'active-barbers' ? <Scissors size={15} className="text-blue-300" /> : null}
              {item.key === 'active-services' ? <Package size={15} className="text-gold-300" /> : null}
              {item.key === 'public-link' ? <Link2 size={15} className="text-sky-300" /> : null}
              {!['active-barbers', 'active-services', 'public-link'].includes(item.key) ? (
                item.complete ? <CheckCircle2 size={15} className="text-emerald-300" /> : <CircleAlert size={15} className="text-amber-300" />
              ) : null}
              <span className="text-sm font-semibold text-foreground">{item.label}</span>
            </div>
            <p className={`text-xs ${item.complete ? 'ui-owner-success' : 'text-muted-foreground'}`}>
              {item.complete ? 'OK' : 'Pendente'}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
            {!item.complete && (
              <p className="mt-2 text-xs leading-relaxed text-amber-100/90">{item.nextStep}</p>
            )}
          </div>
        ))}
      </div>

      {!checklist.ready && nextPendingItem && (
        <div className="ui-owner-info mt-5 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Proximo passo</p>
          <p className="mt-2 text-sm font-bold text-foreground">{nextPendingItem.label}</p>
          <p className="mt-1 text-sm text-foreground">{nextPendingItem.nextStep}</p>
          {nextPendingItem.actionHref && nextPendingItem.actionLabel && (
            <a
              href={nextPendingItem.actionHref}
              className="ui-button ui-button-secondary mt-3"
            >
              {nextPendingItem.actionLabel}
            </a>
          )}
        </div>
      )}

      {checklist.publicBookingPath && (
        <div className="ui-owner-card mt-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Link publico</p>
          <p className="mt-2 break-all font-mono text-sm text-gold-300">{checklist.publicBookingPath}</p>
          {!checklist.ready && (
            <p className="mt-2 text-sm text-amber-100/90">
              O link ja existe, mas o booking ainda nao deve ser divulgado como operacional ate concluir as pendencias.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={checklist.publicBookingPath}
              target="_blank"
              rel="noreferrer"
              className="ui-button ui-button-secondary"
            >
              <ExternalLink size={14} />
              Abrir link
            </a>
            <button
              type="button"
              onClick={handleCopyLink}
              className="ui-button ui-button-secondary"
            >
              <Copy size={14} />
              Copiar link
            </button>
          </div>
          {copyFeedback && (
            <p className="mt-2 text-xs text-muted-foreground">{copyFeedback}</p>
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
