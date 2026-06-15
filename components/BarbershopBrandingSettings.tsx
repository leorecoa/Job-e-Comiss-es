import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Globe2, Save, Upload } from 'lucide-react';
import { Barbershop } from '../types';
import { AppRole } from '../services/authRepository';
import { BarbershopBrandingImageType, BarbershopBrandingInput } from '../services/barbershopRepository';

export type BarbershopBrandingFormData = {
  name: string;
  phone: string;
  address: string;
  whatsapp: string;
  instagramUrl: string;
  description: string;
  logoUrl: string;
  coverImageUrl: string;
  primaryColor: string;
  secondaryColor: string;
};

type BarbershopBrandingSettingsProps = {
  barbershop: Barbershop | null;
  role?: AppRole | null;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  success?: string | null;
  onSave: (input: BarbershopBrandingInput) => Promise<void> | void;
  onUploadImage?: (file: File, type: BarbershopBrandingImageType) => Promise<string>;
};

export const canManageBarbershopBranding = (role?: AppRole | null): boolean => role !== 'barber';

export const getBarbershopBrandingFormData = (barbershop: Barbershop | null): BarbershopBrandingFormData => ({
  name: barbershop?.name || '',
  phone: barbershop?.phone || '',
  address: barbershop?.address || '',
  whatsapp: barbershop?.whatsapp || '',
  instagramUrl: barbershop?.instagramUrl || '',
  description: barbershop?.description || '',
  logoUrl: barbershop?.logoUrl || '',
  coverImageUrl: barbershop?.coverImageUrl || '',
  primaryColor: barbershop?.primaryColor || '#f59e0b',
  secondaryColor: barbershop?.secondaryColor || '#0ea5e9'
});

export const getBarbershopBrandingSaveInput = (formData: BarbershopBrandingFormData): BarbershopBrandingInput => ({
  name: formData.name,
  phone: formData.phone,
  address: formData.address,
  whatsapp: formData.whatsapp,
  instagramUrl: formData.instagramUrl,
  description: formData.description,
  logoUrl: formData.logoUrl,
  coverImageUrl: formData.coverImageUrl,
  primaryColor: formData.primaryColor,
  secondaryColor: formData.secondaryColor
});

export const getBarbershopBrandingImageField = (type: BarbershopBrandingImageType): 'logoUrl' | 'coverImageUrl' => (
  type === 'logo' ? 'logoUrl' : 'coverImageUrl'
);

const isSafeHexColor = (color: string): boolean => /^#[0-9a-fA-F]{6}$/.test(color);

export const BarbershopBrandingSettings: React.FC<BarbershopBrandingSettingsProps> = ({
  barbershop,
  role,
  loading = false,
  saving = false,
  error,
  success,
  onSave,
  onUploadImage
}) => {
  const [formData, setFormData] = useState<BarbershopBrandingFormData>(() => getBarbershopBrandingFormData(barbershop));
  const [uploadingType, setUploadingType] = useState<BarbershopBrandingImageType | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  useEffect(() => {
    setFormData(getBarbershopBrandingFormData(barbershop));
  }, [barbershop]);

  const canManage = canManageBarbershopBranding(role);
  const primaryColor = isSafeHexColor(formData.primaryColor) ? formData.primaryColor : '#f59e0b';
  const secondaryColor = isSafeHexColor(formData.secondaryColor) ? formData.secondaryColor : '#0ea5e9';
  const previewStyle = useMemo(() => ({
    borderColor: primaryColor,
    background: `linear-gradient(135deg, ${primaryColor}33, rgba(17,24,39,0.92) 45%, ${secondaryColor}26)`
  }), [primaryColor, secondaryColor]);

  const primaryButtonStyle = useMemo(() => ({
    backgroundColor: primaryColor,
    borderColor: primaryColor
  }), [primaryColor]);

  const secondaryButtonStyle = useMemo(() => ({
    backgroundColor: `${secondaryColor}26`,
    borderColor: `${secondaryColor}80`,
    color: '#f8fafc'
  }), [secondaryColor]);

  if (!canManage) return null;

  const handleChange = (field: keyof BarbershopBrandingFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (type: BarbershopBrandingImageType, event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);

    if (!onUploadImage) {
      setUploadError('Upload de imagens nao esta disponivel neste ambiente.');
      input.value = '';
      return;
    }

    setUploadingType(type);

    try {
      const publicUrl = await onUploadImage(file, type);
      handleChange(getBarbershopBrandingImageField(type), publicUrl);
      setUploadSuccess(type === 'logo' ? 'Logo enviada. Salve a aparencia para publicar.' : 'Capa enviada. Salve a aparencia para publicar.');
    } catch (uploadFailure) {
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : 'Nao foi possivel enviar a imagem.');
    } finally {
      setUploadingType(null);
      input.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSave(getBarbershopBrandingSaveInput(formData));
  };

  return (
    <section className="glass-card rounded-2xl p-5 md:p-6 mb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 text-gold-400 mb-2">
            <Globe2 size={20} />
            <span className="text-xs font-bold uppercase tracking-widest">Aparencia publica</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-white">Configuracoes da barbearia</h2>
          <p className="text-sm text-gray-400 mt-1">Personalize como sua barbearia aparece no link publico de agendamento.</p>
        </div>
        {barbershop?.slug && (
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 px-3 py-2 text-xs text-gray-400">
            Slug somente leitura: <span className="font-mono text-gray-200">{barbershop.slug}</span>
          </div>
        )}
      </div>

      {loading && <p className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-200">Carregando dados da barbearia...</p>}
      {error && <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {success && <p className="mb-4 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200">{success}</p>}
      {uploadError && <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{uploadError}</p>}
      {uploadSuccess && <p className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-200">{uploadSuccess}</p>}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <ImageUploadField
              label="Upload da logo"
              helpText="PNG, JPG ou WEBP ate 2MB"
              previewUrl={formData.logoUrl}
              uploading={uploadingType === 'logo'}
              onChange={(event) => handleImageUpload('logo', event)}
            />
            <ImageUploadField
              label="Upload da capa"
              helpText="PNG, JPG ou WEBP ate 5MB"
              previewUrl={formData.coverImageUrl}
              uploading={uploadingType === 'cover'}
              onChange={(event) => handleImageUpload('cover', event)}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Nome da barbearia" value={formData.name} onChange={(value) => handleChange('name', value)} required />
            <Field label="Telefone" value={formData.phone} onChange={(value) => handleChange('phone', value)} />
            <Field label="Endereco" value={formData.address} onChange={(value) => handleChange('address', value)} />
            <Field label="WhatsApp" value={formData.whatsapp} onChange={(value) => handleChange('whatsapp', value)} />
            <Field label="Instagram" value={formData.instagramUrl} onChange={(value) => handleChange('instagramUrl', value)} />
            <Field label="URL da logo" value={formData.logoUrl} onChange={(value) => handleChange('logoUrl', value)} />
            <Field label="URL da imagem de capa" value={formData.coverImageUrl} onChange={(value) => handleChange('coverImageUrl', value)} />
            <Field label="Cor principal" type="color" value={formData.primaryColor} onChange={(value) => handleChange('primaryColor', value)} />
            <Field label="Cor secundaria" type="color" value={formData.secondaryColor} onChange={(value) => handleChange('secondaryColor', value)} />
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-gray-400 mb-1.5">Descricao curta</span>
            <textarea
              value={formData.description}
              onChange={(event) => handleChange('description', event.target.value)}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
            />
          </label>

          <button type="submit" disabled={saving || loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 py-3 font-bold text-black shadow-lg shadow-gold-500/20 disabled:cursor-not-allowed disabled:opacity-50">
            <Save size={18} />
            {saving ? 'Salvando...' : 'Salvar aparencia'}
          </button>
        </form>

        <div className="rounded-2xl border bg-gray-950/80 p-4" style={previewStyle}>
          <div className="flex items-center gap-2 text-white/80 mb-4">
            <Eye size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Preview publico</span>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/35">
            <div className="h-24 bg-gray-900 relative">
              {formData.coverImageUrl && <img src={formData.coverImageUrl} alt="" className="h-full w-full object-cover opacity-80" />}
            </div>
            <div className="p-4 -mt-8 relative">
              <div className="h-16 w-16 rounded-2xl border border-white/20 bg-gray-950 overflow-hidden flex items-center justify-center text-gold-300 mb-3">
                {formData.logoUrl ? <img src={formData.logoUrl} alt="" className="h-full w-full object-cover" /> : <Globe2 size={26} />}
              </div>
              <h3 className="font-display text-xl font-bold text-white">{formData.name || 'Nome da barbearia'}</h3>
              <p className="text-sm text-gray-300 mt-2">{formData.description || 'Descricao curta da experiencia publica.'}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-200">
                {formData.address && <span className="rounded-lg bg-white/10 px-2 py-1">{formData.address}</span>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-xl border px-3 py-2 text-xs font-bold text-black" style={primaryButtonStyle}>Agendar agora</span>
                {formData.whatsapp && <span className="rounded-xl border px-3 py-2 text-xs font-bold" style={secondaryButtonStyle}>WhatsApp</span>}
                {formData.instagramUrl && <span className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white">Instagram</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

type ImageUploadFieldProps = {
  label: string;
  helpText: string;
  previewUrl: string;
  uploading: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

const ImageUploadField: React.FC<ImageUploadFieldProps> = ({ label, helpText, previewUrl, uploading, onChange }) => (
  <label className="block rounded-2xl border border-gray-700 bg-gray-900/70 p-4">
    <span className="mb-3 flex items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-bold text-gray-200">{label}</span>
        <span className="block text-xs text-gray-500">{helpText}</span>
      </span>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-gold-300">
        <Upload size={17} />
      </span>
    </span>
    <span className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-700 bg-black/30 text-xs text-gray-500">
      {previewUrl ? <img src={previewUrl} alt="" className="h-full w-full object-cover" /> : 'Sem imagem'}
    </span>
    <input
      type="file"
      accept="image/png,image/jpeg,image/webp"
      disabled={uploading}
      onChange={onChange}
      className="block w-full text-sm text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gold-500 file:px-3 file:py-2 file:text-sm file:font-bold file:text-black disabled:cursor-not-allowed disabled:opacity-60"
    />
    {uploading && <span className="mt-2 block text-xs text-blue-200">Enviando imagem...</span>}
  </label>
);

type FieldProps = {
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  onChange: (value: string) => void;
};

const Field: React.FC<FieldProps> = ({ label, value, type = 'text', required = false, onChange }) => (
  <label className="block">
    <span className="block text-sm font-medium text-gray-400 mb-1.5">{label}</span>
    <input
      type={type}
      required={required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
    />
  </label>
);
