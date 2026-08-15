import React, { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Link2, Mail, Scissors, UserRound } from 'lucide-react';
import { AppRole } from '../services/authRepository';
import {
  getBarberProfileLinkingSuccessMessage,
  getBarberProfileLinkingErrorMessage,
  normalizeBarberProfileLinkingEmail
} from '../services/profileLinkingRepository';
import { BarberOption } from '../types';
import { logOperationalError } from '../utils/errorHandling';

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

export const isOwnerBarberProfileLinkingSubmitDisabled = ({
  barber,
  email,
  isSubmitting
}: {
  barber?: BarberOption | null;
  email?: string;
  isSubmitting?: boolean;
}): boolean => (
  Boolean(isSubmitting)
  || !barber?.id?.trim()
  || !normalizeBarberProfileLinkingEmail(email)
);

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

  if (isOwnerBarberProfileLinkingSubmitDisabled({ barber, email: normalizedEmail })) {
    return null;
  }

  try {
    await onLinkProfile({
      targetEmail: normalizedEmail,
      targetBarberId: barber.id
    });

    return {
      type: 'success',
      message: getBarberProfileLinkingSuccessMessage({
        barberName: barber.name,
        email: normalizedEmail
      })
    };
  } catch (error) {
    logOperationalError('owner:link-barber-profile', error);
    return {
      type: 'error',
      message: getBarberProfileLinkingErrorMessage(error)
    };
  }
};

export const OwnerBarberProfileLinking: React.FC<OwnerBarberProfileLinkingProps> = ({
  role,
  barbers,
  onLinkProfile
}) => {
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [pendingBarberId, setPendingBarberId] = useState<string | null>(null);
  const [feedbackByBarberId, setFeedbackByBarberId] = useState<Record<string, FeedbackState | null>>({});

  const sortedBarbers = useMemo(
    () => [...barbers].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [barbers]
  );

  if (!canManageOwnerBarberProfileLinking(role)) {
    return null;
  }

  const handleSubmit = async (barber: BarberOption) => {
    if (isOwnerBarberProfileLinkingSubmitDisabled({
      barber,
      email: emailDrafts[barber.id],
      isSubmitting: pendingBarberId === barber.id
    })) {
      return;
    }

    setPendingBarberId(barber.id);
    setFeedbackByBarberId((prev) => ({ ...prev, [barber.id]: null }));

    try {
      const result = await submitOwnerBarberProfileLinking({
        barber,
        email: emailDrafts[barber.id],
        onLinkProfile
      });

      if (result) {
        setFeedbackByBarberId((prev) => ({
          ...prev,
          [barber.id]: result
        }));
      }
    } finally {
      setPendingBarberId(null);
    }
  };

  return (
    <section className="ui-owner-panel mb-6 rounded-3xl p-5">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sky-300">
            <Link2 size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Acesso do barbeiro</span>
          </div>
          <h2 className="text-2xl font-bold">Vincular barbeiro a usuário</h2>
          <p className="ui-owner-help mt-1 text-sm">Conecte a conta de login do barbeiro ao profissional cadastrado. Depois do vínculo, ele acessa somente a própria agenda.</p>
        </div>
        <div className="ui-owner-badge inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-widest">
          <Mail size={14} />
          O barbeiro precisa criar conta antes
        </div>
      </div>

      <div className="ui-owner-info mb-5 rounded-2xl p-4 text-sm">
        <p className="font-bold">Como funciona</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>O barbeiro cria uma conta usando o e-mail dele.</li>
          <li>Você informa aqui o mesmo e-mail usado no login.</li>
          <li>Escolha o profissional correspondente e clique em vincular.</li>
        </ol>
        <p className="ui-owner-help mt-3 text-xs">Este fluxo não envia convite automático por e-mail. Depois de vincular, avise o barbeiro para entrar novamente se a agenda ainda não aparecer.</p>
      </div>

      {sortedBarbers.length === 0 ? (
        <div className="ui-owner-empty rounded-2xl px-4 py-5 text-sm">
          Cadastre pelo menos um barbeiro na sua barbearia para liberar o vínculo com usuário.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedBarbers.map((barber) => {
            const feedback = feedbackByBarberId[barber.id];
            const isSubmitting = pendingBarberId === barber.id;
            const disabled = isOwnerBarberProfileLinkingSubmitDisabled({
              barber,
              email: emailDrafts[barber.id],
              isSubmitting
            });

            return (
              <div key={barber.id} className="ui-owner-card-solid rounded-2xl p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-foreground">
                      <Scissors size={16} />
                      <p className="truncate text-sm font-bold">{barber.name}</p>
                    </div>
                    <div className="ui-owner-help mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${
                        barber.active === false
                          ? 'ui-owner-status-warning'
                          : 'ui-owner-status-success'
                      }`}>
                        <CheckCircle2 size={11} />
                        {barber.active === false ? 'Inativo' : 'Ativo'}
                      </span>
                      <span>Conta de usuário ainda precisa ser vinculada pelo e-mail de login.</span>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 lg:max-w-xl lg:flex-row">
                    <div className="relative flex-1">
                      <UserRound size={14} className="ui-owner-input-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={emailDrafts[barber.id] || ''}
                        onChange={(event) => setEmailDrafts((prev) => ({ ...prev, [barber.id]: event.target.value }))}
                        placeholder="E-mail da conta do barbeiro"
                        aria-label={`E-mail da conta do barbeiro ${barber.name}`}
                        className="ui-owner-input w-full rounded-xl px-10 py-2.5 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSubmit(barber)}
                      disabled={disabled}
                      className="ui-owner-button ui-owner-button-primary inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold"
                    >
                      {isSubmitting ? 'Vinculando...' : 'Vincular usuário'}
                    </button>
                  </div>
                </div>

                {feedback && (
                  <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                    feedback.type === 'success'
                      ? 'ui-owner-status-success'
                      : 'ui-owner-status-error'
                  }`}>
                    <div className="flex items-start gap-2">
                      {feedback.type === 'success'
                        ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                        : <CircleAlert size={14} className="mt-0.5 shrink-0" />}
                      <span>{feedback.message}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
