import React, { useRef, useState } from 'react';
import { Barbershop } from '../types';
import { Button, InlineNotice, Input, Label, Surface } from './ui';
import { requireFinancialTimezone, suggestFinancialTimezone } from '../utils/financialTimezone';

export const FinancialTimezoneSettings = ({ barbershop, onSave }: {
  barbershop: Barbershop;
  onSave: (timezone: string) => Promise<void>;
}) => {
  const [value, setValue] = useState(() => barbershop.financialTimezone ?? suggestFinancialTimezone());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const pending = useRef(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await onSave(requireFinancialTimezone(value));
      setSuccess(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível salvar a timezone financeira.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return <Surface className="mt-6">
    <h2 className="text-xl font-bold text-foreground">Timezone financeira</h2>
    <p className="mt-2 text-sm text-foreground">{barbershop.financialTimezone
      ? `Timezone atual: ${barbershop.financialTimezone}` : 'Timezone financeira não configurada'}</p>
    <p className="mt-2 text-sm text-muted-foreground">Esta escolha definirá a interpretação dos períodos financeiros. Nesta versão, relatórios, booking e agenda ainda não são alterados.</p>
    <form onSubmit={submit} aria-busy={saving} className="mt-4 space-y-3">
      <Label htmlFor="financial-timezone">Timezone IANA</Label>
      <Input id="financial-timezone" value={value} disabled={saving} required
        onChange={event => { setValue(event.target.value); setSuccess(false); }} />
      {!barbershop.financialTimezone && <p className="text-sm text-muted-foreground">A sugestão do navegador só será salva após sua confirmação.</p>}
      <Button type="submit" loading={saving}>Confirmar e salvar timezone</Button>
      {error && <InlineNotice tone="error" role="alert">{error}</InlineNotice>}
      {success && <InlineNotice tone="success" role="status">Timezone financeira salva.</InlineNotice>}
    </form>
  </Surface>;
};
