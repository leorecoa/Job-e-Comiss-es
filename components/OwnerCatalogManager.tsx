import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Package, Plus, RotateCcw, Save, Scissors, Trash2 } from 'lucide-react';
import { BarberOption, Service } from '../types';

type OwnerCatalogManagerProps = {
  barbers: BarberOption[];
  services: Service[];
  loading?: boolean;
  error?: string | null;
  onCreateBarber: (name: string) => Promise<void> | void;
  onUpdateBarber: (barberId: string, patch: { name?: string; active?: boolean }) => Promise<void> | void;
  onRemoveBarber: (barberId: string) => Promise<void> | void;
  onCreateService: (input: { name: string; price: number; durationMinutes: number; commissionRate?: number }) => Promise<void> | void;
  onUpdateService: (serviceId: string, patch: { name?: string; price?: number; durationMinutes?: number; commissionRate?: number; active?: boolean }) => Promise<void> | void;
  onRemoveService: (serviceId: string) => Promise<void> | void;
};

type BarberDraftMap = Record<string, string>;
type ServiceDraftMap = Record<string, { name: string; price: string; durationMinutes: string; commissionRate: string }>;

export const getOwnerCatalogPublicSnapshot = (barbers: BarberOption[], services: Service[]) => ({
  barbers: barbers.filter((barber) => barber.active !== false),
  services: services.filter((service) => service.active !== false)
});

export const OwnerCatalogManager: React.FC<OwnerCatalogManagerProps> = ({
  barbers,
  services,
  loading = false,
  error = null,
  onCreateBarber,
  onUpdateBarber,
  onRemoveBarber,
  onCreateService,
  onUpdateService,
  onRemoveService
}) => {
  const [newBarberName, setNewBarberName] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('30');
  const [newServiceCommission, setNewServiceCommission] = useState('50');
  const [pendingBarberId, setPendingBarberId] = useState<string | null>(null);
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const [isCreatingBarber, setCreatingBarber] = useState(false);
  const [isCreatingService, setCreatingService] = useState(false);
  const [barberDrafts, setBarberDrafts] = useState<BarberDraftMap>({});
  const [serviceDrafts, setServiceDrafts] = useState<ServiceDraftMap>({});

  useEffect(() => {
    setBarberDrafts(Object.fromEntries(barbers.map((barber) => [barber.id, barber.name])));
  }, [barbers]);

  useEffect(() => {
    setServiceDrafts(Object.fromEntries(services.map((service) => [service.id, {
      name: service.name,
      price: String(service.price),
      durationMinutes: String(service.durationMinutes),
      commissionRate: String(service.commissionRate ?? 0)
    }])));
  }, [services]);

  const activeSnapshot = useMemo(
    () => getOwnerCatalogPublicSnapshot(barbers, services),
    [barbers, services]
  );

  const handleCreateBarber = async () => {
    const trimmedName = newBarberName.trim();
    if (!trimmedName) return;

    setCreatingBarber(true);
    try {
      await onCreateBarber(trimmedName);
      setNewBarberName('');
    } finally {
      setCreatingBarber(false);
    }
  };

  const handleCreateService = async () => {
    const trimmedName = newServiceName.trim();
    if (!trimmedName) return;

    setCreatingService(true);
    try {
      await onCreateService({
        name: trimmedName,
        price: Number(newServicePrice) || 0,
        durationMinutes: Math.max(1, Number(newServiceDuration) || 30),
        commissionRate: Math.max(0, Math.min(100, Number(newServiceCommission) || 0))
      });
      setNewServiceName('');
      setNewServicePrice('');
      setNewServiceDuration('30');
      setNewServiceCommission('50');
    } finally {
      setCreatingService(false);
    }
  };

  return (
    <section id="owner-catalog-manager" className="ui-owner-panel mb-6 scroll-mt-24">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="ui-owner-warning text-xs font-bold uppercase tracking-widest">Operação</p>
          <h2 className="font-display text-2xl font-bold text-foreground">Catálogo operacional</h2>
          <p className="ui-owner-help mt-1">Cadastre equipe e serviços da sua própria barbearia. Itens com histórico são desativados para preservar agendamentos antigos.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:w-[320px]">
          <SummaryPill label="Barbeiros ativos" value={activeSnapshot.barbers.length.toString()} icon={<Scissors size={16} />} />
          <SummaryPill label="Serviços ativos" value={activeSnapshot.services.length.toString()} icon={<Package size={16} />} />
        </div>
      </div>

      {error && (
        <div className="ui-owner-status-error mb-4 rounded-2xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="ui-owner-empty">
          Carregando catálogo da barbearia...
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="ui-owner-card space-y-4">
            <div className="flex items-center gap-2 text-foreground">
              <Scissors size={18} />
              <h3 className="font-bold text-foreground">Barbeiros</h3>
            </div>

            <div className="flex gap-2">
              <input
                value={newBarberName}
                onChange={(event) => setNewBarberName(event.target.value)}
                placeholder="Nome do barbeiro"
                className="ui-input flex-1"
              />
              <button
                type="button"
                onClick={handleCreateBarber}
                disabled={isCreatingBarber}
                className="ui-button ui-button-primary"
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {barbers.length === 0 ? (
                <EmptyState
                  title="Nenhum barbeiro cadastrado ainda."
                  description="Cadastre pelo menos um barbeiro para liberar profissionais no booking público."
                  nextStep="Use o campo acima para adicionar o primeiro barbeiro."
                />
              ) : (
                barbers.map((barber) => (
                  <div key={barber.id} className="ui-owner-record-card">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        value={barberDrafts[barber.id] || ''}
                        onChange={(event) => setBarberDrafts((prev) => ({ ...prev, [barber.id]: event.target.value }))}
                        className="ui-input flex-1"
                      />
                      <StatusBadge active={barber.active !== false} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setPendingBarberId(barber.id);
                          try {
                            await onUpdateBarber(barber.id, { name: barberDrafts[barber.id] || barber.name });
                          } finally {
                            setPendingBarberId(null);
                          }
                        }}
                        disabled={pendingBarberId === barber.id}
                        className="ui-button ui-button-secondary"
                      >
                        <Save size={14} />
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setPendingBarberId(barber.id);
                          try {
                            await onUpdateBarber(barber.id, { active: barber.active === false });
                          } finally {
                            setPendingBarberId(null);
                          }
                        }}
                        disabled={pendingBarberId === barber.id}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50 ${
                          barber.active === false
                            ? 'ui-button ui-button-secondary'
                            : 'ui-button ui-button-danger'
                        }`}
                        >
                          <RotateCcw size={14} />
                          {barber.active === false ? 'Ativar' : 'Desativar'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setPendingBarberId(barber.id);
                          try {
                            await onRemoveBarber(barber.id);
                          } finally {
                            setPendingBarberId(null);
                          }
                        }}
                        disabled={pendingBarberId === barber.id}
                        className="ui-button ui-button-danger"
                      >
                        <Trash2 size={14} />
                        Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="ui-owner-card space-y-4">
            <div className="flex items-center gap-2 text-foreground">
              <Package size={18} />
              <h3 className="font-bold text-foreground">Serviços</h3>
            </div>

            <div className="grid gap-2 md:grid-cols-[1.4fr_0.75fr_0.75fr_0.75fr_auto]">
              <input
                value={newServiceName}
                onChange={(event) => setNewServiceName(event.target.value)}
                placeholder="Nome do serviço"
                className="ui-input"
              />
              <input
                value={newServicePrice}
                onChange={(event) => setNewServicePrice(event.target.value)}
                placeholder="Valor"
                type="number"
                min="0"
                step="0.01"
                className="ui-input"
              />
              <input
                value={newServiceDuration}
                onChange={(event) => setNewServiceDuration(event.target.value)}
                placeholder="Min"
                type="number"
                min="1"
                step="1"
                className="ui-input"
              />
              <input
                value={newServiceCommission}
                onChange={(event) => setNewServiceCommission(event.target.value)}
                placeholder="%"
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="ui-input"
              />
              <button
                type="button"
                onClick={handleCreateService}
                disabled={isCreatingService}
                className="ui-button ui-button-primary"
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {services.length === 0 ? (
                <EmptyState
                  title="Nenhum serviço cadastrado ainda."
                  description="Cadastre pelo menos um serviço com valor e duração para permitir agendamentos."
                  nextStep="Use os campos acima para criar o primeiro serviço."
                />
              ) : (
                services.map((service) => {
                  const draft = serviceDrafts[service.id] || {
                    name: service.name,
                    price: String(service.price),
                    durationMinutes: String(service.durationMinutes),
                    commissionRate: String(service.commissionRate ?? 0)
                  };

                  return (
                    <div key={service.id} className="ui-owner-record-card">
                      <div className="grid gap-2 md:grid-cols-[1.35fr_0.8fr_0.8fr_0.8fr]">
                        <input
                          value={draft.name}
                          onChange={(event) => setServiceDrafts((prev) => ({
                            ...prev,
                            [service.id]: { ...draft, name: event.target.value }
                          }))}
                          className="ui-input"
                        />
                        <input
                          value={draft.price}
                          onChange={(event) => setServiceDrafts((prev) => ({
                            ...prev,
                            [service.id]: { ...draft, price: event.target.value }
                          }))}
                          type="number"
                          min="0"
                          step="0.01"
                          className="ui-input"
                        />
                        <input
                          value={draft.durationMinutes}
                          onChange={(event) => setServiceDrafts((prev) => ({
                            ...prev,
                            [service.id]: { ...draft, durationMinutes: event.target.value }
                          }))}
                          type="number"
                          min="1"
                          step="1"
                          className="ui-input"
                        />
                        <input
                          value={draft.commissionRate}
                          onChange={(event) => setServiceDrafts((prev) => ({
                            ...prev,
                            [service.id]: { ...draft, commissionRate: event.target.value }
                          }))}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="ui-input"
                        />
                      </div>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <StatusBadge active={service.active !== false} />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              setPendingServiceId(service.id);
                              try {
                                await onUpdateService(service.id, {
                                  name: draft.name,
                                  price: Number(draft.price) || 0,
                                  durationMinutes: Math.max(1, Number(draft.durationMinutes) || 30),
                                  commissionRate: Math.max(0, Math.min(100, Number(draft.commissionRate) || 0))
                                });
                              } finally {
                                setPendingServiceId(null);
                              }
                            }}
                            disabled={pendingServiceId === service.id}
                            className="ui-button ui-button-secondary"
                          >
                            <Save size={14} />
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setPendingServiceId(service.id);
                              try {
                                await onUpdateService(service.id, { active: service.active === false });
                              } finally {
                                setPendingServiceId(null);
                              }
                            }}
                            disabled={pendingServiceId === service.id}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50 ${
                              service.active === false
                                ? 'ui-button ui-button-secondary'
                                : 'ui-button ui-button-danger'
                            }`}
                          >
                            <RotateCcw size={14} />
                            {service.active === false ? 'Ativar' : 'Desativar'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setPendingServiceId(service.id);
                              try {
                                await onRemoveService(service.id);
                              } finally {
                                setPendingServiceId(null);
                              }
                            }}
                            disabled={pendingServiceId === service.id}
                            className="ui-button ui-button-danger"
                          >
                            <Trash2 size={14} />
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const SummaryPill: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="ui-owner-counter">
    <div className="ui-owner-warning mb-2">{icon}</div>
    <p className="text-lg font-bold text-foreground">{value}</p>
    <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
  </div>
);

const StatusBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
    active
      ? 'ui-owner-status-success'
      : 'ui-owner-status-warning'
  }`}>
    <CheckCircle2 size={12} />
    {active ? 'Ativo' : 'Inativo'}
  </span>
);

const EmptyState: React.FC<{ title: string; description: string; nextStep?: string }> = ({ title, description, nextStep }) => (
  <div className="ui-owner-empty">
    <p className="font-bold text-foreground">{title}</p>
    <p className="mt-1">{description}</p>
    {nextStep && <p className="ui-owner-pending-copy mt-2 text-xs font-bold uppercase tracking-widest">{nextStep}</p>}
  </div>
);
