import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Link2, Scissors, Store } from 'lucide-react';
import { AuthSession } from '../services/authRepository';
import {
  CreateBarbershopForCurrentOwnerInput,
  getBarbershopPublicBookingPath,
  normalizeBarbershopSlug
} from '../services/barbershopRepository';
import { Barbershop } from '../types';

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
      <div className="min-h-screen bg-transparent px-4 py-8 font-sans">
        <div className="mx-auto max-w-lg rounded-3xl border border-gray-800 bg-gray-900/80 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-500/20 bg-gold-500/10 text-gold-400">
            <Store size={30} />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Crie sua barbearia</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">Entre com sua conta para criar a barbearia e liberar o link publico de agendamento.</p>
        </div>
      </div>
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
      <div className="min-h-screen bg-transparent px-4 py-8 font-sans">
        <div className="mx-auto max-w-lg rounded-3xl border border-gray-800 bg-gray-900/80 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-green-400/20 bg-green-500/10 text-green-300">
            <CheckCircle2 size={30} />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Barbearia criada</h1>
          <p className="mt-3 text-sm text-gray-400">Seu painel sera aberto em instantes.</p>
          <div className="mt-5 rounded-2xl border border-gray-700 bg-gray-950/70 p-4 text-left">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Link publico</p>
            <p className="mt-2 break-all font-mono text-sm text-gold-300">{getBarbershopPublicBookingPath(createdBarbershop.slug)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-4 py-8 font-sans">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[0.88fr_1.12fr]">
        <section className="rounded-3xl border border-gray-800 bg-gray-900/80 p-6 shadow-2xl">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-gold-500/20 bg-gold-500/10 text-gold-400">
            <Scissors size={26} />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-gold-300">Onboarding owner</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-white">Crie sua barbearia</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">Configure a base da sua operacao e receba um link publico para agendamento.</p>

          <div className="mt-6 rounded-2xl border border-gray-700 bg-gray-950/70 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Preview do link</p>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-gray-800 bg-black/30 px-3 py-3">
              <Link2 size={16} className="text-gold-300" />
              <span className="font-mono text-sm text-gray-200">{previewPath}</span>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="rounded-3xl border border-gray-800 bg-gray-900/80 p-6 shadow-2xl">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome da barbearia" value={form.name} required onChange={(value) => handleChange('name', value)} />
            <Field
              label="Slug"
              value={form.slug}
              required
              onFocus={() => setSlugTouched(true)}
              onChange={(value) => {
                setSlugTouched(true);
                handleChange('slug', value);
              }}
            />
            <Field label="Telefone" value={form.phone} onChange={(value) => handleChange('phone', value)} />
            <Field label="WhatsApp" value={form.whatsapp} onChange={(value) => handleChange('whatsapp', value)} />
          </div>

          <div className="mt-4">
            <Field label="Endereco" value={form.address} onChange={(value) => handleChange('address', value)} />
          </div>

          <div className="mt-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-400">Descricao</span>
              <textarea
                value={form.description}
                onChange={(event) => handleChange('description', event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-500 px-4 py-3.5 font-bold text-black shadow-lg shadow-gold-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Criando...' : 'Criar barbearia'}
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

type FieldProps = {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
  onFocus?: () => void;
};

const Field: React.FC<FieldProps> = ({ label, value, required = false, onChange, onFocus }) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-medium text-gray-400">{label}</span>
    <input
      value={value}
      required={required}
      onFocus={onFocus}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
    />
  </label>
);
