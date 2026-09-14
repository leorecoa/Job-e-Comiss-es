import React, { useRef, useState } from 'react';
import { Barbershop } from '../types';
import { Button, InlineNotice, Input, Label, Surface } from './ui';
import { requireOperationalTimezone, suggestOperationalTimezone } from '../utils/operationalTimezone';

export const OperationalTimezoneSettings = ({ barbershop, onSave }: {
  barbershop: Barbershop;
  onSave: (timezone: string) => Promise<void>;
}) => {
  const [value, setValue] = useState(() => barbershop.operationalTimezone ?? suggestOperationalTimezone());
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
      await onSave(requireOperationalTimezone(value));
      setSuccess(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível salvar a timezone operacional.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return <Surface className="mt-6">
    <h2 className="text-xl font-bold text-foreground">Timezone operacional</h2>
    <p className="mt-2 text-sm text-foreground">{barbershop.operationalTimezone
      ? `Timezone operacional atual: ${barbershop.operationalTimezone}` : 'Não configurado'}</p>
    <p className="mt-2 text-sm text-muted-foreground">Será usada para agenda e jornada operacional. Nesta versão, não altera booking, agenda ou períodos financeiros.</p>
    <form onSubmit={submit} aria-busy={saving} className="mt-4 space-y-3">
      <Label htmlFor="operational-timezone">Timezone operacional IANA</Label>
      <Input id="operational-timezone" value={value} disabled={saving} required
        onChange={event => { setValue(event.target.value); setSuccess(false); }} />
      {!barbershop.operationalTimezone && <p className="text-sm text-muted-foreground">A sugestão do navegador só será salva após sua confirmação.</p>}
      <Button type="submit" loading={saving}>Confirmar timezone operacional</Button>
      {error && <InlineNotice tone="error" role="alert">{error}</InlineNotice>}
      {success && <InlineNotice tone="success" role="status">Timezone operacional salva.</InlineNotice>}
    </form>
  </Surface>;
};
