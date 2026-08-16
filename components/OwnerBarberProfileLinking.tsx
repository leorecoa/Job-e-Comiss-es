import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Link2, Scissors } from 'lucide-react';
import { AppRole } from '../services/authRepository';
import {
  getBarberProfileLinkingSuccessMessage,
  getBarberProfileLinkingErrorMessage,
  normalizeBarberProfileLinkingEmail
} from '../services/profileLinkingRepository';
import { BarberOption } from '../types';
import { logOperationalError } from '../utils/errorHandling';
import { Button, InlineNotice, Input, Label } from './ui';

type OwnerBarberProfileLinkingProps = {
  role?: AppRole | null;
  barbers: BarberOption[];
  onLinkProfile: (input: { targetEmail: string; targetBarberId: string }) => Promise<unknown> | unknown;
};

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
};

export type OwnerBarberProfileLinkingSubmitResult = FeedbackState;

export const canManageOwnerBarberProfileLinking = (role?: AppRole | null): boolean => role === 'owner';

export const isBasicEmailValid = (email?: string): boolean => {
  const normalizedEmail = normalizeBarberProfileLinkingEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
};

export const getAvailableBarbersForProfileLinking = (
  barbers: BarberOption[],
  linkedBarberIds: ReadonlySet<string> = new Set()
): BarberOption[] => barbers
  .filter((barber) => barber.active !== false && !linkedBarberIds.has(barber.id))
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

export const isOwnerBarberProfileLinkingSubmitDisabled = ({
  barber,
  email,
  isSubmitting
}: {
  barber?: BarberOption | null;
  email?: string;
  isSubmitting?: boolean;
}): boolean => Boolean(isSubmitting) || !barber?.id?.trim() || !isBasicEmailValid(email);

export const submitOwnerBarberProfileLinking = async ({
  barber,
  email,
  onLinkProfile
}: {
  barber?: BarberOption | null;
  email?: string;
  onLinkProfile: (input: { targetEmail: string; targetBarberId: string }) => Promise<unknown> | unknown;
}): Promise<OwnerBarberProfileLinkingSubmitResult | null> => {
  const normalizedEmail = normalizeBarberProfileLinkingEmail(email);

  if (isOwnerBarberProfileLinkingSubmitDisabled({ barber, email: normalizedEmail })) return null;

  try {
    await onLinkProfile({
      targetEmail: normalizedEmail,
      targetBarberId: barber.id
    });

    return {
      type: 'success',
      message: getBarberProfileLinkingSuccessMessage({ barberName: barber.name, email: normalizedEmail })
    };
  } catch (error) {
    logOperationalError('owner:link-barber-profile', error);
    return { type: 'error', message: getBarberProfileLinkingErrorMessage(error) };
  }
};

export const OwnerBarberProfileLinking: React.FC<OwnerBarberProfileLinkingProps> = ({
  role,
  barbers,
  onLinkProfile
}) => {
  const [email, setEmail] = useState('');
  const [selectedBarberId, setSelectedBarberId] = useState('');
  const [linkedBarberIds, setLinkedBarberIds] = useState<Set<string>>(() => new Set());
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const sortedBarbers = useMemo(
    () => [...barbers].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [barbers]
  );
  const availableBarbers = useMemo(
    () => getAvailableBarbersForProfileLinking(barbers, linkedBarberIds),
    [barbers, linkedBarberIds]
  );
  const selectedBarber = availableBarbers.find((barber) => barber.id === selectedBarberId);

  if (!canManageOwnerBarberProfileLinking(role)) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitLockRef.current) return;

    if (!email.trim()) {
      setFeedback({ type: 'error', message: 'Informe o e-mail usado pelo barbeiro no login.' });
      return;
    }
    if (!isBasicEmailValid(email)) {
      setFeedback({ type: 'error', message: 'Informe um e-mail válido.' });
      return;
    }
    if (!selectedBarber) {
      setFeedback({ type: 'error', message: 'Escolha o profissional correspondente.' });
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await submitOwnerBarberProfileLinking({ barber: selectedBarber, email, onLinkProfile });
      if (!result) return;

      setFeedback(result);
      if (result.type === 'success') {
        setLinkedBarberIds((current) => new Set(current).add(selectedBarber.id));
        setEmail('');
        setSelectedBarberId('');
      }
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="ui-owner-panel mb-6 rounded-3xl p-5">
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2 text-sky-700">
          <Link2 size={18} aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-widest">Acesso do barbeiro</span>
        </div>
        <h2 className="text-2xl font-bold">Vincular barbeiro à equipe</h2>
        <p className="ui-owner-help mt-1 text-sm">Informe o mesmo e-mail usado pelo barbeiro no login e escolha o profissional correspondente.</p>
      </div>

      <form onSubmit={handleSubmit} className="ui-owner-card-solid mb-5 grid gap-4 rounded-2xl p-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end" aria-busy={isSubmitting} noValidate>
        <div className="ui-field">
          <Label htmlFor="barber-link-email">E-mail usado no login</Label>
          <Input
            id="barber-link-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="barbeiro@exemplo.com"
            disabled={isSubmitting}
          />
        </div>
        <div className="ui-field">
          <Label htmlFor="barber-link-professional">Profissional correspondente</Label>
          <select
            id="barber-link-professional"
            value={selectedBarberId}
            onChange={(event) => setSelectedBarberId(event.target.value)}
            className="ui-input min-h-11"
            disabled={isSubmitting || availableBarbers.length === 0}
          >
            <option value="">Selecione um profissional</option>
            {availableBarbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
          </select>
        </div>
        <Button type="submit" loading={isSubmitting} className="min-h-11" disabled={availableBarbers.length === 0}>
          {isSubmitting ? 'Vinculando...' : 'Vincular usuário'}
        </Button>
      </form>

      <div aria-live="polite" className="mb-5">
        {feedback && <InlineNotice tone={feedback.type}>{feedback.message}</InlineNotice>}
      </div>

      <div className="ui-owner-info mb-5 rounded-2xl p-4 text-sm">
        <p className="font-bold">Como funciona</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>O barbeiro cria uma conta usando o e-mail dele.</li>
          <li>Você informa aqui o mesmo e-mail usado no login.</li>
          <li>Escolha o profissional correspondente e clique em vincular.</li>
        </ol>
      </div>

      {availableBarbers.length === 0 && (
        <InlineNotice tone="info" className="mb-5">
          <p className="font-bold">Nenhum profissional ativo aguardando vínculo.</p>
          <p className="mt-1">Cadastre ou ative um profissional no <a href="#management-catalog" className="font-bold underline underline-offset-4">Catálogo</a> antes de realizar o vínculo.</p>
        </InlineNotice>
      )}

      <div className="space-y-3" aria-label="Profissionais da equipe">
        {sortedBarbers.map((barber) => {
          const linked = linkedBarberIds.has(barber.id);
          return (
            <div key={barber.id} className="ui-owner-card-solid rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-foreground">
                  <Scissors size={16} aria-hidden="true" />
                  <p className="truncate text-sm font-bold">{barber.name}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${barber.active === false ? 'ui-owner-status-warning' : 'ui-owner-status-success'}`}>
                    <CheckCircle2 size={11} aria-hidden="true" />
                    {barber.active === false ? 'Inativo' : 'Ativo'}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${linked ? 'ui-owner-status-success' : 'ui-owner-status-warning'}`}>
                    {linked ? <CheckCircle2 size={11} aria-hidden="true" /> : <CircleAlert size={11} aria-hidden="true" />}
                    {linked ? 'Vinculado' : 'Vínculo pendente'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
