import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Scissors } from 'lucide-react';
import { AuthSession } from '../services/authRepository';
import {
  CreateBarbershopForCurrentOwnerInput,
  getBarbershopPublicBookingPath,
  normalizeBarbershopSlug
} from '../services/barbershopRepository';
import { Barbershop } from '../types';
import { AuthLayout, Badge, Button, EmptyState, InlineNotice, Input, Label, Surface, Textarea } from './ui';

type OwnerBarbershopOnboardingProps = {
  authSession: AuthSession | null;
  onCreate: (input: CreateBarbershopForCurrentOwnerInput) => Promise<Barbershop>;
  onComplete?: (barbershop: Barbershop) => void;
};

type OwnerBarbershopOnboardingFormState = {
  name: string;
  slug: string;
  phone: string;
  address: string;
  whatsapp: string;
  description: string;
};

export const getOwnerBarbershopOnboardingPreview = (slug: string): string => {
  const normalizedSlug = normalizeBarbershopSlug(slug);
  return normalizedSlug ? getBarbershopPublicBookingPath(normalizedSlug) : '/book/seu-slug';
};

export const getOwnerBarbershopOnboardingPayload = (
  form: OwnerBarbershopOnboardingFormState
): CreateBarbershopForCurrentOwnerInput => ({
  name: form.name.trim(),
  slug: normalizeBarbershopSlug(form.slug),
  phone: form.phone.trim(),
  address: form.address.trim(),
  whatsapp: form.whatsapp.trim(),
  description: form.description.trim()
});

export const OwnerBarbershopOnboarding: React.FC<OwnerBarbershopOnboardingProps> = ({
  authSession,
  onCreate,
  onComplete
}) => {
  const [form, setForm] = useState<OwnerBarbershopOnboardingFormState>({
    name: '',
    slug: '',
    phone: '',
    address: '',
    whatsapp: '',
    description: ''
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdBarbershop, setCreatedBarbershop] = useState<Barbershop | null>(null);

  const previewPath = useMemo(() => getOwnerBarbershopOnboardingPreview(form.slug), [form.slug]);

  useEffect(() => {
    if (!createdBarbershop || !onComplete) return undefined;

    const timeout = window.setTimeout(() => onComplete(createdBarbershop), 1400);
    return () => window.clearTimeout(timeout);
  }, [createdBarbershop, onComplete]);

  if (!authSession) {
    return (
      <AuthLayout>
        <Surface>
          <EmptyState title="Crie sua barbearia" description="Entre com sua conta para criar a barbearia e liberar o link publico de agendamento." />
        </Surface>
      </AuthLayout>
    );
  }

  const handleChange = (field: keyof OwnerBarbershopOnboardingFormState, value: string) => {
    setForm((prev) => {
      if (field === 'name' && !slugTouched) {
        return {
          ...prev,
          name: value,
          slug: normalizeBarbershopSlug(value)
        };
      }

      if (field === 'slug') {
        return {
          ...prev,
          slug: normalizeBarbershopSlug(value)
        };
      }

      return { ...prev, [field]: value };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const created = await onCreate(getOwnerBarbershopOnboardingPayload(form));
      setCreatedBarbershop(created);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Nao foi possivel criar a barbearia.');
    } finally {
      setSaving(false);
    }
  };

  if (createdBarbershop) {
    return (
      <AuthLayout>
        <Surface className="ui-auth-content ui-auth-content-center" role="status" aria-live="polite">
          <CheckCircle2 className="ui-success-mark mx-auto" size={34} aria-hidden="true" />
          <h1 className="ui-state-title mt-4 text-3xl">Barbearia criada</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Seu painel sera aberto em instantes.</p>
          <InlineNotice tone="success" className="mt-5 text-left">
            <strong>Link publico</strong>
            <code className="mt-1 block break-all">{getBarbershopPublicBookingPath(createdBarbershop.slug)}</code>
          </InlineNotice>
        </Surface>
      </AuthLayout>
    );
  }

  return (
    <main className="ui-auth-shell">
      <div className="ui-onboarding-grid">
        <Surface className="ui-onboarding-intro">
          <span className="ui-auth-mark"><Scissors size={22} aria-hidden="true" /></span>
          <Badge className="mt-4">Configuracao inicial</Badge>
          <h1>Crie sua barbearia</h1>
          <p>Configure a base da sua operacao e receba um link publico para agendamento.</p>
          <div className="ui-onboarding-preview">
            <strong className="text-sm">Preview do link</strong>
            <code>{previewPath}</code>
          </div>
        </Surface>

        <Surface>
          <form onSubmit={handleSubmit} className="ui-onboarding-form" aria-busy={saving}>
            <p className="ui-required-note">Campos marcados com * sao obrigatorios.</p>
            {error && <InlineNotice id="onboarding-error" tone="error" className="mb-4">{error}</InlineNotice>}

            <div className="ui-form-grid">
              <Field id="barbershop-name" label="Nome da barbearia" value={form.name} required errorId={error ? 'onboarding-error' : undefined} onChange={(value) => handleChange('name', value)} />
            <Field
              id="barbershop-slug"
              label="Slug"
              value={form.slug}
              required
              errorId={error ? 'onboarding-error' : undefined}
              onFocus={() => setSlugTouched(true)}
              onChange={(value) => {
                setSlugTouched(true);
                handleChange('slug', value);
              }}
            />
              <Field id="barbershop-phone" label="Telefone" value={form.phone} autoComplete="tel" onChange={(value) => handleChange('phone', value)} />
              <Field id="barbershop-whatsapp" label="WhatsApp" value={form.whatsapp} autoComplete="tel" onChange={(value) => handleChange('whatsapp', value)} />
              <Field id="barbershop-address" label="Endereco" value={form.address} autoComplete="street-address" className="ui-field-wide" onChange={(value) => handleChange('address', value)} />
              <div className="ui-field ui-field-wide">
                <Label htmlFor="barbershop-description">Descricao</Label>
                <Textarea
                  id="barbershop-description"
                value={form.description}
                onChange={(event) => handleChange('description', event.target.value)}
                rows={3}
                />
              </div>
            </div>

            <div className="ui-onboarding-actions">
              <Button type="submit" loading={saving}>
                {saving ? 'Criando...' : 'Criar barbearia'}
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
            </div>
          </form>
        </Surface>
      </div>
    </main>
  );
};

type FieldProps = {
  id: string;
  label: string;
  value: string;
  required?: boolean;
  autoComplete?: string;
  className?: string;
  errorId?: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
};

const Field: React.FC<FieldProps> = ({ id, label, value, required = false, autoComplete, className, errorId, onChange, onFocus }) => (
  <div className={`ui-field ${className || ''}`.trim()}>
    <Label htmlFor={id}>{label}{required ? ' *' : ''}</Label>
    <Input
      id={id}
      value={value}
      required={required}
      autoComplete={autoComplete}
      aria-invalid={Boolean(errorId)}
      aria-describedby={errorId}
      onFocus={onFocus}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);
