import React, { useEffect, useState } from 'react';
import { getTenantCommercialState, type TenantCommercialState, type TenantCommercialStatus } from '../services/tenantCommercialRepository';
import { Badge, Button, InlineNotice, Surface } from './ui';

type Props = { active: boolean; userId: string; barbershopId: string };
type State = { kind: 'idle' | 'loading' | 'error' } | { kind: 'success'; data: TenantCommercialState };
const labels: Record<TenantCommercialStatus, string> = {
  unassigned: 'Não atribuído', pending: 'Pendente', trialing: 'Em período de teste',
  active: 'Ativo', paused: 'Pausado', canceled: 'Cancelado'
};
const dates = {
  trialStartedAt: 'Início do período de teste', trialEndsAt: 'Fim do período de teste',
  currentPeriodStart: 'Início do período atual', currentPeriodEnd: 'Fim do período atual'
} as const;
const formatDate = (value: string): string => {
  // Require an explicit offset rather than interpreting an unzoned date locally.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return 'Data indisponível';
  const date = new Date(value);
  const calendarDate = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(calendarDate.getTime())
    || calendarDate.toISOString().slice(0, 10) !== value.slice(0, 10)) return 'Data indisponível';
  return `${new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' }).format(date)} UTC`;
};

function ActiveCommercialCard() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setState({ kind: 'loading' });
    getTenantCommercialState().then(
      data => { if (current) setState({ kind: 'success', data }); },
      () => { if (current) setState({ kind: 'error' }); }
    );
    return () => { current = false; };
  }, [attempt]);
  const loading = state.kind === 'idle' || state.kind === 'loading';
  return <Surface aria-label="Estado comercial" aria-busy={loading}>
    <h2 className="text-xl font-bold text-foreground">Estado comercial</h2>
    <p className="mt-2 text-sm text-muted-foreground">Informação administrativa, sem alteração das funcionalidades disponíveis.</p>
    {loading && <InlineNotice>Carregando estado comercial...</InlineNotice>}
    {state.kind === 'error' && <InlineNotice>Estado comercial indisponível</InlineNotice>}
    {(loading || state.kind === 'error') && <Button type="button" variant="secondary" loading={loading}
      onClick={() => { setState({ kind: 'loading' }); setAttempt(value => value + 1); }}>Tentar novamente</Button>}
    {state.kind === 'success' && <div className="mt-4 space-y-2">
      <Badge>{labels[state.data.status]}</Badge>
      {state.data.status === 'unassigned' && <p>Nenhuma assinatura comercial atribuída.</p>}
      {state.data.planCode !== null && <p>Código do plano: {state.data.planCode}</p>}
      {(Object.keys(dates) as Array<keyof typeof dates>).map(field => state.data[field] !== null
        ? <p key={field}>{dates[field]}: {formatDate(state.data[field])}</p> : null)}
    </div>}
  </Surface>;
}

export function TenantCommercialStateCard({ active, userId, barbershopId }: Props) {
  // Remount only this informational card; never retain data across identity/activation changes.
  if (!active || !userId.trim() || !barbershopId.trim()) return null;
  return <ActiveCommercialCard key={JSON.stringify([userId, barbershopId])} />;
}
