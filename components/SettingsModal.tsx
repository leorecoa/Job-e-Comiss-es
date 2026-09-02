
import React, { useEffect, useState } from 'react';
import { AppSettings, UserProfile, ProductItem, Client, Vale, Appointment } from '../types';
import {
  X,
  Save,
  Users,
  Trash2,
  Plus,
  Package,
  DollarSign,
  Download,
  Upload,
  ShieldCheck
} from 'lucide-react';
import { generateId } from '../utils';
import { logOperationalError } from '../utils/errorHandling';
import { APPOINTMENT_STORAGE_KEY } from '../scheduling';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  userProfile: UserProfile;
  clients: Client[];
  vales: Vale[];
  appointments: Appointment[];
  manageCatalogRemotely?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  userProfile,
  clients,
  vales,
  appointments,
  manageCatalogRemotely = false
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [newBarberName, setNewBarberName] = useState('');

  // Product Form State
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData(settings);
      setNewBarberName('');
      setNewProductName('');
      setNewProductPrice('');
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;
  const handleChange = (field: keyof AppSettings, value: string | number) => {
    if (typeof formData[field] === 'number') {
      const numericValue = Number(value);
      const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
      const normalizedValue = field === 'commissionRate'
        ? Math.min(100, Math.max(0, safeValue))
        : Math.max(0, safeValue);

      setFormData((prev) => ({
        ...prev,
        [field]: normalizedValue
      }));

      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddBarber = () => {
    const trimmedName = newBarberName.trim();

    const alreadyExists = (formData.barbers || []).some(
      (barber) => barber.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (trimmedName && !alreadyExists && (formData.barbers?.length || 0) < 4) {
      setFormData((prev) => ({
        ...prev,
        barbers: [
          ...(prev.barbers || []),
          {
            id: generateId(),
            name: trimmedName
          }
        ]
      }));

      setNewBarberName('');
    }
  };

  const handleRemoveBarber = (barberId: string) => {
    setFormData((prev) => ({
      ...prev,
      barbers: prev.barbers?.filter((barber) => barber.id !== barberId) || []
    }));
  };

  const handleAddProduct = () => {
    const productPrice = Number(newProductPrice);

    if (newProductName.trim() && Number.isFinite(productPrice) && productPrice > 0) {
      const newItem: ProductItem = {
        id: generateId(),
        name: newProductName.trim(),
        price: productPrice
      };

      setFormData((prev) => ({
        ...prev,
        products: [...(prev.products || []), newItem]
      }));

      setNewProductName('');
      setNewProductPrice('');
    }
  };

  const handleRemoveProduct = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products?.filter((p) => p.id !== id) || []
    }));
  };

  const handleServiceChange = (
    id: string,
    field: 'price' | 'durationMinutes',
    value: string
  ) => {
    const numericValue = Math.max(field === 'durationMinutes' ? 1 : 0, Number(value) || 0);

    setFormData((prev) => ({
      ...prev,
      services: (prev.services || []).map((service) => (
        service.id === id ? { ...service, [field]: numericValue } : service
      ))
    }));
  };

  const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  };

  const hasValidBackupShape = (data: unknown): data is {
    clients: Client[];
    vales: Vale[];
    appointments?: Appointment[];
    settings: AppSettings;
  } => {
    if (!isObjectRecord(data)) return false;
    if (!Array.isArray(data.clients) || !Array.isArray(data.vales)) return false;
    if (!isObjectRecord(data.settings)) return false;

    const restoredSettings = data.settings;

    return typeof restoredSettings.shopName === 'string'
      && typeof restoredSettings.priceCut === 'number'
      && typeof restoredSettings.priceBeard === 'number'
      && typeof restoredSettings.priceCombo === 'number'
      && typeof restoredSettings.commissionRate === 'number'
      && Array.isArray(restoredSettings.products)
      && Array.isArray(restoredSettings.barbers);
  };

  const handleBackup = () => {
    const data = {
      clients,
      vales,
      appointments,
      settings: formData,
      profile: userProfile,
      backupDate: new Date().toISOString(),
      version: '1.0'
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `backup_gestao_maxima_${new Date().toISOString().slice(0, 10)}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!window.confirm('ATENÇÃO: Isso irá substituir TODOS os dados atuais pelos do arquivo de backup. Tem certeza?')) {
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!hasValidBackupShape(data)) {
          alert('Arquivo de backup invalido ou incompleto.');
          return;
        }

        localStorage.setItem('barbearia_clients', JSON.stringify(data.clients));
        localStorage.setItem('barbearia_vales', JSON.stringify(data.vales));
        localStorage.setItem(APPOINTMENT_STORAGE_KEY, JSON.stringify(data.appointments || []));
        localStorage.setItem('barbearia_settings', JSON.stringify(data.settings));

        alert('Backup restaurado com sucesso! O sistema será reiniciado.');
        window.location.reload();
      } catch (error) {
        alert('Erro ao ler arquivo de backup. Verifique se é um arquivo válido.');
        logOperationalError('settings:restore-backup', error);
      }
    };

    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="ui-modal-backdrop animate-slide-in">
      <div className="ui-modal max-h-[90vh] w-full max-w-md overflow-y-auto">
        <div className="ui-modal-header flex items-center justify-between p-6">
          <h2 className="font-display text-xl font-bold text-foreground">Configurações</h2>
          <button type="button" onClick={onClose} className="ui-modal-close">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="settings-shop-name" className="ui-label mb-1 block">
              Nome da Barbearia
            </label>
            <input
              id="settings-shop-name"
              name="shopName"
              type="text"
              value={formData.shopName}
              onChange={(e) => handleChange('shopName', e.target.value)}
              className="ui-input w-full"
            />
          </div>

          {!manageCatalogRemotely && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="settings-price-cut" className="ui-label mb-1 block text-xs">
                Corte (R$)
              </label>
              <input
                id="settings-price-cut"
                name="priceCut"
                type="number"
                min="0"
                step="0.01"
                value={formData.priceCut}
                onChange={(e) => handleChange('priceCut', e.target.value)}
                className="ui-input w-full text-sm"
              />
            </div>

            <div>
              <label htmlFor="settings-price-beard" className="ui-label mb-1 block text-xs">
                Barba (R$)
              </label>
              <input
                id="settings-price-beard"
                name="priceBeard"
                type="number"
                min="0"
                step="0.01"
                value={formData.priceBeard || 0}
                onChange={(e) => handleChange('priceBeard', e.target.value)}
                className="ui-input w-full text-sm"
              />
            </div>

            <div>
              <label htmlFor="settings-price-combo" className="ui-label mb-1 block text-xs">
                Combo (R$)
              </label>
              <input
                id="settings-price-combo"
                name="priceCombo"
                type="number"
                min="0"
                step="0.01"
                value={formData.priceCombo}
                onChange={(e) => handleChange('priceCombo', e.target.value)}
                className="ui-input w-full text-sm"
              />
            </div>

            <div>
              <label htmlFor="settings-price-product" className="ui-label mb-1 block text-xs">
                Produto (Valor Base)
              </label>
              <input
                id="settings-price-product"
                name="priceProduct"
                type="number"
                min="0"
                step="0.01"
                value={formData.priceProduct || 0}
                onChange={(e) => handleChange('priceProduct', e.target.value)}
                className="ui-input w-full text-sm"
              />
            </div>
          </div>
          )}

          {manageCatalogRemotely ? (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
              O catalogo operacional da sua barbearia agora e gerenciado direto no painel principal.
            </div>
          ) : (
          <div className="p-4 rounded-xl border border-gold-500/20 bg-gold-500/5 space-y-3">
            <div className="flex items-center gap-2 text-gold-400 mb-2">
              <DollarSign size={18} />
              <h3 className="font-bold text-sm">Servicos da Agenda</h3>
            </div>

            <div className="space-y-2">
              {(formData.services || []).map((service) => (
                <div
                  key={service.id}
                  className="ui-owner-record-card grid grid-cols-[1fr_90px_80px] items-end gap-2"
                >
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{service.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Agenda</span>
                  </div>

                  <label className="text-xs text-muted-foreground">
                    Valor
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={service.price}
                      onChange={(e) => handleServiceChange(service.id, 'price', e.target.value)}
                      className="ui-input mt-1 w-full text-xs"
                    />
                  </label>

                  <label className="text-xs text-muted-foreground">
                    Min
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={service.durationMinutes}
                      onChange={(e) => handleServiceChange(service.id, 'durationMinutes', e.target.value)}
                      className="ui-input mt-1 w-full text-xs"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Products List Section */}
          <div className="ui-owner-card space-y-3 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <Package size={18} />
              <h3 className="font-bold text-sm">Catálogo de Produtos</h3>
            </div>

            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
              {(formData.products || []).map((product) => (
                <div key={product.id} className="ui-owner-record-card flex items-center justify-between rounded-lg p-2">
                  <div className="flex-1 overflow-hidden">
                    <span className="block truncate text-sm text-foreground">{product.name}</span>
                  </div>

                  <span className="text-green-400 text-xs font-bold mr-3">
                    R$ {product.price.toFixed(2)}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemoveProduct(product.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {(formData.products || []).length === 0 && (
                <p className="text-center text-xs italic text-muted-foreground">Nenhum produto cadastrado.</p>
              )}
            </div>

            <div className="flex gap-2 mt-2">
              <input
                id="settings-product-name"
                name="productName"
                type="text"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Nome"
                className="ui-input w-full flex-[2] text-sm"
              />

              <div className="flex-1 flex gap-1">
                <input
                  id="settings-product-price"
                  name="productPrice"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  placeholder="$$"
                  className="ui-input w-full text-sm"
                />
              </div>

              <button
                type="button"
                onClick={handleAddProduct}
                className="ui-button ui-button-primary shrink-0"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Local barber management for development/demo fallback. Supabase tenants use OwnerCatalogManager. */}
          {!manageCatalogRemotely && (
            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-900/10 space-y-3">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Users size={18} />
                <h3 className="font-bold text-sm">Equipe</h3>
              </div>

              <div className="space-y-2">
                {(formData.barbers || []).map((barber) => (
                  <div
                    key={barber.id}
                    className="ui-owner-record-card flex items-center justify-between rounded-lg p-2"
                  >
                    <span className="text-sm text-foreground">{barber.name}</span>

                    <button
                      type="button"
                      onClick={() => handleRemoveBarber(barber.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {(formData.barbers?.length || 0) < 4 ? (
                <div className="flex gap-2 mt-2">
                  <input
                    id="settings-new-barber-name"
                    name="newBarberName"
                    type="text"
                    value={newBarberName}
                    onChange={(e) => setNewBarberName(e.target.value)}
                    placeholder="Nome do Barbeiro"
                    className="ui-input flex-1 text-sm"
                  />

                  <button
                    type="button"
                    onClick={handleAddBarber}
                    className="ui-button ui-button-primary"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground">Limite de 4 barbeiros atingido.</p>
              )}
            </div>
          )}

          {!manageCatalogRemotely && (
          <div className="mt-2">
            <div>
              <label htmlFor="settings-commission-rate" className="ui-label mb-1 block">
                Comissão Serviços (%)
              </label>
              <input
                id="settings-commission-rate"
                name="commissionRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.commissionRate}
                onChange={(e) => handleChange('commissionRate', e.target.value)}
                className="ui-input w-full"
              />
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              A comissão se aplica estritamente a serviços. Produtos não geram comissão.
            </p>
          </div>
          )}

          {/* Backup & Security Section */}
          <div className="mt-6 border-t border-border pt-6">
            <div className="mb-3 flex items-center gap-2 text-foreground">
              <ShieldCheck size={18} className="text-gold-500" />
              <h3 className="font-bold text-sm">Segurança de Dados</h3>
            </div>

            <p className="mb-4 text-xs text-muted-foreground">
              Faça backups regulares para garantir que nunca perca seus dados, mesmo trocando de dispositivo.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleBackup}
                className="ui-button ui-button-secondary flex flex-col gap-2 p-3"
              >
                <Download size={20} className="text-blue-400" />
                <span className="text-xs font-bold text-foreground">Baixar Backup</span>
              </button>

              <label className="ui-button ui-button-secondary flex cursor-pointer flex-col gap-2 p-3">
                <Upload size={20} className="text-green-400" />
                <span className="text-xs font-bold text-foreground">Restaurar Dados</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleRestore}
                />
              </label>
            </div>
          </div>

          <div className="pt-4 mt-2">
            <button
              type="submit"
              className="ui-button ui-button-secondary w-full"
            >
              <Save size={20} />
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
