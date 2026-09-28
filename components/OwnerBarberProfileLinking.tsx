import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Link2, Scissors } from 'lucide-react';
import { AppRole } from '../services/authRepository';
import { BarberOption } from '../types';
import { isBasicEmailValid } from '../utils/emailValidation';
import { Button, InlineNotice, Input, Label } from './ui';
import { isSupabaseConfigured, shouldUseLocalFallback } from '../lib/supabase';
import { getTeamInvitationErrorMessage, INVITATIONS_ONLINE_ONLY, issueTeamInvitation, revokeTeamInvitation, type TeamInvitation } from '../services/teamInvitationRepository';

type OwnerBarberProfileLinkingProps = {
  role?: AppRole | null;
  barbers: BarberOption[];
  invitationContext?: string;
  invitationActive?: boolean;
};

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
};

export const canManageOwnerBarberProfileLinking = (role?: AppRole | null): boolean => role === 'owner';

export const OwnerBarberProfileLinking: React.FC<OwnerBarberProfileLinkingProps> = ({
  role,
  barbers,
  invitationContext,
  invitationActive = false
}) => {
  const sortedBarbers = useMemo(
    () => [...barbers].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [barbers]
  );
  if (!canManageOwnerBarberProfileLinking(role)) return null;

  return (
    <section className="ui-owner-panel mb-6 rounded-3xl p-5">
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2 text-sky-700">
          <Link2 size={18} aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-widest">Acesso do barbeiro</span>
        </div>
        <h2 className="text-2xl font-bold">Acesso da equipe</h2>
        <p className="ui-owner-help mt-1 text-sm">Convide o profissional para acessar a equipe mediante aceite do convite.</p>
      </div>

      {invitationActive && <TeamInvitationEntry key={invitationContext} barbers={sortedBarbers} />}

      <div className="ui-owner-info mb-5 rounded-2xl p-4 text-sm">
        <p className="font-bold">Como funciona</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Você gera um convite para o e-mail do profissional.</li>
          <li>Compartilhe o link do convite com o profissional.</li>
          <li>O profissional entra ou cria uma conta e aceita o convite.</li>
        </ol>
      </div>

      {!sortedBarbers.some((barber) => barber.active !== false) && (
        <InlineNotice tone="info" className="mb-5">
          <p className="font-bold">Nenhum profissional ativo.</p>
          <p className="mt-1">Cadastre ou ative um profissional no <a href="#management-catalog" className="font-bold underline underline-offset-4">Catálogo</a> antes de gerar um convite.</p>
        </InlineNotice>
      )}

      <div className="space-y-3" aria-label="Profissionais da equipe">
        {sortedBarbers.map((barber) => {
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
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const TeamInvitationEntry = ({ barbers }: { barbers: BarberOption[] }) => {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const online = isSupabaseConfigured && !shouldUseLocalFallback;
  return (
    <div className="ui-owner-card-solid mb-5 rounded-2xl p-4">
      <Button ref={opener} type="button" variant="secondary" className="min-h-11" disabled={!online || open} onClick={() => setOpen(true)}>Convidar acesso</Button>
      {!online && <p className="ui-owner-help mt-2">{INVITATIONS_ONLINE_ONLY}</p>}
      {online && open && <TeamInvitationForm barbers={barbers} onClose={() => {
        setOpen(false);
        window.requestAnimationFrame(() => opener.current?.focus());
      }} />}
    </div>
  );
};

const TeamInvitationForm = ({ barbers, onClose }: { barbers: BarberOption[]; onClose: () => void }) => {
  const [barberId, setBarberId] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<TeamInvitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const generation = useRef(0);
  const lock = useRef(false);
  useEffect(() => () => { generation.current += 1; }, []);
  const selected = barbers.find((barber) => barber.id === barberId && barber.active !== false);
  const link = result ? `${window.location.origin}/convite#token=${encodeURIComponent(result.token)}` : '';

  const resetResult = () => {
    generation.current += 1;
    lock.current = false;
    setBusy(false);
    setResult(null);
    setFeedback(null);
  };
  useEffect(() => {
    if (barberId && !selected) resetResult();
  }, [barberId, selected?.id]);

  const mutate = async (action: 'issue' | 'revoke') => {
    if (lock.current || (action === 'issue' && !selected) || (action === 'revoke' && !result)) return;
    lock.current = true;
    setBusy(true);
    setFeedback(null);
    if (action === 'issue') setResult(null);
    const request = ++generation.current;
    try {
      if (action === 'issue') {
        const issued = await issueTeamInvitation(barberId, email);
        if (request === generation.current) setResult(issued);
      } else {
        await revokeTeamInvitation(result!.invitationId);
        if (request === generation.current) {
          setResult(null);
          setFeedback({ type: 'success', message: 'Convite revogado.' });
        }
      }
    } catch (error) {
      if (request === generation.current) setFeedback({ type: 'error', message: getTeamInvitationErrorMessage(error) });
    } finally {
      if (request === generation.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  };

  const shareOrCopy = async (share: boolean) => {
    if (!result || lock.current) return;
    const request = generation.current;
    try {
      if (share && typeof navigator.share === 'function') {
        await navigator.share({ title: 'Convite de acesso', text: 'Use este link para acessar seu convite.', url: link });
      } else {
        if (!navigator.clipboard?.writeText) throw new Error();
        await navigator.clipboard.writeText(link);
        if (request === generation.current) setFeedback({ type: 'success', message: 'Link copiado.' });
      }
    } catch (error) {
      if (share && (error as { name?: string })?.name === 'AbortError') return;
      if (request === generation.current) setFeedback({ type: 'error', message: 'Selecione o link abaixo e copie manualmente.' });
    }
  };

  return (
    <section aria-label="Convite de acesso" className="mt-4 space-y-4" onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
      <p className="ui-owner-help">Gere o link e compartilhe com o profissional. Ele deve entrar com a conta destinatária e aceitar o convite.</p>
      <p className="ui-owner-help">Ao fechar, o link não poderá ser recuperado aqui. Se perdê-lo, gere outro convite.</p>
      <form className="grid gap-4" aria-busy={busy} onSubmit={(event) => { event.preventDefault(); void mutate('issue'); }}>
        <div className="ui-field">
          <Label htmlFor="invite-barber">Profissional do convite</Label>
          <select autoFocus id="invite-barber" className="ui-input min-h-11" value={barberId} disabled={busy} onChange={(event) => { resetResult(); setBarberId(event.target.value); }}>
            <option value="">Selecione um profissional</option>
            {barbers.filter((barber) => barber.active !== false).map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
          </select>
        </div>
        <div className="ui-field">
          <Label htmlFor="invite-email">E-mail do convite</Label>
          <Input id="invite-email" type="email" maxLength={254} required value={email} disabled={busy} onChange={(event) => { resetResult(); setEmail(event.target.value); }} />
        </div>
        <p className="ui-owner-help">Gerar um novo convite invalida o convite anterior deste profissional.</p>
        <Button type="submit" className="min-h-11" loading={busy} disabled={!selected || !isBasicEmailValid(email)}>{busy ? 'Aguarde...' : result ? 'Gerar novo convite' : 'Gerar convite'}</Button>
      </form>
      {result && selected && <div className="space-y-3" aria-label="Resultado do convite">
        <h3 className="font-bold">Convite gerado</h3>
        <p>Expiração informada: <time dateTime={result.expiresAt}>{new Date(result.expiresAt).toLocaleString('pt-BR')}</time></p>
        <Label htmlFor="invite-link">Link do convite</Label>
        <Input id="invite-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="min-h-11" disabled={busy} onClick={() => void shareOrCopy(false)}>Copiar</Button>
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && <Button type="button" className="min-h-11" disabled={busy} onClick={() => void shareOrCopy(true)}>Compartilhar</Button>}
          <Button type="button" variant="destructive" className="min-h-11" disabled={busy} onClick={() => void mutate('revoke')}>Revogar</Button>
        </div>
      </div>}
      <div aria-live="polite">{feedback && <InlineNotice tone={feedback.type}>{feedback.message}</InlineNotice>}</div>
      <Button type="button" variant="secondary" className="min-h-11" onClick={onClose}>Fechar convite</Button>
    </section>
  );
};
