
import React, { useEffect, useState } from 'react';
import { AppSettings, UserProfile, ProductItem, Client, Vale, Appointment } from '../types';
import { X, Save, Crown, Users, Trash2, Plus, Package, DollarSign, Percent, Download, Upload, ShieldCheck, AlertTriangle } from 'lucide-react';
import { generateId } from '../utils';
import { APPOINTMENT_STORAGE_KEY } from '../scheduling';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  userProfile: UserProfile;
  onSubscribe: () => void;
  clients: Client[];
  vales: Vale[];
  appointments: Appointment[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onSave,
  userProfile,
  onSubscribe,
  clients,
  vales,
  appointments
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

  const isVip = userProfile.planType === 'vip_monthly' || userProfile.planType === 'admin_life';

  const planLabel = userProfile.planType === 'admin_life'
    ? 'Admin Vitalício'
    : isVip
      ? 'VIP Multi-Barbeiros (Ativo)'
      : userProfile.isPro
        ? 'Assinatura PRO Standard'
        : 'Versão de Teste';

  const handleChange = (field: keyof AppSettings, value: string | number) => {
    if (typeof formData[field] === 'number') {
      const numericValue = Number(value);
      const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
      const normalizedValue = field === 'commissionRate'
        ? Math.min(100, Math.max(0, safeValue))
        : Math.max(0, safeValue);

      setFormData(prev => ({
        ...prev,
        [field]: normalizedValue
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddBarber = () => {
    const trimmedName = newBarberName.trim();
    const alreadyExists = (formData.barbers || []).some(
      barber => barber.toLowerCase() === trimmedName.toLowerCase()
    );

    if (trimmedName && !alreadyExists && (formData.barbers?.length || 0) < 4) {
        setFormData(prev => ({
            ...prev,
            barbers: [...(prev.barbers || []), trimmedName]
        }));
        setNewBarberName('');
    }
  };

  const handleRemoveBarber = (index: number) => {
    setFormData(prev => ({
        ...prev,
        barbers: prev.barbers?.filter((_, i) => i !== index) || []
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
        setFormData(prev => ({
            ...prev,
            products: [...(prev.products || []), newItem]
        }));
        setNewProductName('');
        setNewProductPrice('');
    }
  };

  const handleRemoveProduct = (id: string) => {
    setFormData(prev => ({
        ...prev,
        products: prev.products?.filter(p => p.id !== id) || []
    }));
  };

  const handleServiceChange = (id: string, field: 'price' | 'durationMinutes', value: string) => {
    const numericValue = Math.max(field === 'durationMinutes' ? 1 : 0, Number(value) || 0);
    setFormData(prev => ({
      ...prev,
      services: (prev.services || []).map(service => (
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
          version: "1.0"
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

      if (!window.confirm("ATENÇÃO: Isso irá substituir TODOS os dados atuais pelos do arquivo de backup. Tem certeza?")) {
          return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result as string;
              const data = JSON.parse(content);

              if (!hasValidBackupShape(data)) {
                  alert("Arquivo de backup invalido ou incompleto.");
                  return;
              }

              localStorage.setItem('barbearia_clients', JSON.stringify(data.clients));
              localStorage.setItem('barbearia_vales', JSON.stringify(data.vales));
              localStorage.setItem(APPOINTMENT_STORAGE_KEY, JSON.stringify(data.appointments || []));
              localStorage.setItem('barbearia_settings', JSON.stringify(data.settings));
              // Optional: Restore profile if needed, but risky if moving between users
              // localStorage.setItem('barbearia_profile', JSON.stringify(data.profile));

              alert("Backup restaurado com sucesso! O sistema será reiniciado.");
              window.location.reload();
          } catch (error) {
              alert("Erro ao ler arquivo de backup. Verifique se é um arquivo válido.");
              console.error(error);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-slide-in">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white font-display">Configurações</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Plan Status Section */}
          <div className={`p-4 rounded-xl border ${userProfile.isPro ? 'bg-gold-500/10 border-gold-500/20' : 'bg-gray-900 border-gray-700'}`}>
             <div className="flex justify-between items-center">
                <div>
                   <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Seu Plano</p>
                   <p className={`font-bold text-sm ${userProfile.isPro ? 'text-gold-500' : 'text-white'}`}>
                      {planLabel}
                   </p>
                </div>
                {userProfile.isPro ? (
                    <Crown className="text-gold-500" />
                ) : (
                    <button 
                        type="button"
                        onClick={() => { onClose(); onSubscribe(); }}
                        className="bg-gold-500 hover:bg-gold-600 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-lg shadow-gold-500/20 animate-pulse"
                    >
                        ASSINAR AGORA
                    </button>
                )}
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Nome da Barbearia</label>
            <input
              type="text"
              value={formData.shopName}
              onChange={(e) => handleChange('shopName', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-gold-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Corte (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.priceCut}
                onChange={(e) => handleChange('priceCut', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none text-sm"
              />
            </div>
             <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Barba (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.priceBeard || 0}
                onChange={(e) => handleChange('priceBeard', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Combo (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.priceCombo}
                onChange={(e) => handleChange('priceCombo', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none text-sm"
              />
            </div>
             <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Produto (Valor Base)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.priceProduct || 0}
                onChange={(e) => handleChange('priceProduct', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none text-sm"
              />
             </div>
          </div>

          <div className="p-4 rounded-xl border border-gold-500/20 bg-gold-500/5 space-y-3">
              <div className="flex items-center gap-2 text-gold-400 mb-2">
                  <DollarSign size={18} />
                  <h3 className="font-bold text-sm">Servicos da Agenda</h3>
              </div>
              <div className="space-y-2">
                {(formData.services || []).map(service => (
                  <div key={service.id} className="grid grid-cols-[1fr_90px_80px] gap-2 items-end bg-gray-900 p-2 rounded-lg border border-gray-700">
                    <div className="min-w-0">
                      <span className="block text-white text-sm font-medium truncate">{service.name}</span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Agenda</span>
                    </div>
                    <label className="text-xs text-gray-400">
                      Valor
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={service.price}
                        onChange={(e) => handleServiceChange(service.id, 'price', e.target.value)}
                        className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:ring-1 focus:ring-gold-500 outline-none"
                      />
                    </label>
                    <label className="text-xs text-gray-400">
                      Min
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={service.durationMinutes}
                        onChange={(e) => handleServiceChange(service.id, 'durationMinutes', e.target.value)}
                        className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:ring-1 focus:ring-gold-500 outline-none"
                      />
                    </label>
                  </div>
                ))}
              </div>
          </div>

           {/* Products List Section */}
           <div className="p-4 rounded-xl border border-gray-700 bg-gray-900/30 space-y-3">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                    <Package size={18} />
                    <h3 className="font-bold text-sm">Catálogo de Produtos</h3>
                </div>
                
                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                    {(formData.products || []).map((product) => (
                        <div key={product.id} className="flex justify-between items-center bg-gray-900 p-2 rounded-lg border border-gray-700">
                            <div className="flex-1 overflow-hidden">
                                <span className="text-white text-sm block truncate">{product.name}</span>
                            </div>
                            <span className="text-green-400 text-xs font-bold mr-3">R$ {product.price.toFixed(2)}</span>
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
                        <p className="text-xs text-gray-500 text-center italic">Nenhum produto cadastrado.</p>
                    )}
                </div>

                <div className="flex gap-2 mt-2">
                    <input 
                        type="text"
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        placeholder="Nome"
                        className="flex-[2] bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-green-500 outline-none w-full"
                    />
                    <div className="flex-1 flex gap-1">
                        <input 
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={newProductPrice}
                            onChange={(e) => setNewProductPrice(e.target.value)}
                            placeholder="$$"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white focus:ring-2 focus:ring-green-500 outline-none"
                        />
                    </div>
                    <button 
                        type="button"
                        onClick={handleAddProduct}
                        className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-lg shrink-0"
                    >
                        <Plus size={18} />
                    </button>
                </div>
          </div>

          {/* VIP Barber Management Section */}
          {isVip && (
            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-900/10 space-y-3">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <Users size={18} />
                    <h3 className="font-bold text-sm">Equipe (VIP)</h3>
                </div>
                
                <div className="space-y-2">
                    {(formData.barbers || []).map((barber, index) => (
                        <div key={index} className="flex justify-between items-center bg-gray-900 p-2 rounded-lg border border-gray-700">
                            <span className="text-white text-sm">{barber}</span>
                            <button 
                                type="button"
                                onClick={() => handleRemoveBarber(index)}
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
                            type="text"
                            value={newBarberName}
                            onChange={(e) => setNewBarberName(e.target.value)}
                            placeholder="Nome do Barbeiro"
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button 
                            type="button"
                            onClick={handleAddBarber}
                            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                ) : (
                    <p className="text-xs text-gray-500 text-center">Limite de 4 barbeiros atingido.</p>
                )}
            </div>
          )}

          <div className="mt-2">
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Comissão Serviços (%)</label>
                <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.commissionRate}
                onChange={(e) => handleChange('commissionRate', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none"
                />
            </div>
            <p className="text-xs text-gray-500 mt-1">A comissão se aplica estritamente a serviços. Produtos não geram comissão.</p>
          </div>

          {/* Backup & Security Section */}
          <div className="mt-6 border-t border-gray-700 pt-6">
              <div className="flex items-center gap-2 mb-3 text-white">
                  <ShieldCheck size={18} className="text-gold-500" />
                  <h3 className="font-bold text-sm">Segurança de Dados</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                  Faça backups regulares para garantir que nunca perca seus dados, mesmo trocando de dispositivo.
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleBackup}
                    className="flex flex-col items-center justify-center gap-2 p-3 bg-gray-900 border border-gray-600 rounded-xl hover:bg-gray-700 transition-colors"
                  >
                      <Download size={20} className="text-blue-400" />
                      <span className="text-xs font-bold text-white">Baixar Backup</span>
                  </button>
                  
                  <label className="flex flex-col items-center justify-center gap-2 p-3 bg-gray-900 border border-gray-600 rounded-xl hover:bg-gray-700 transition-colors cursor-pointer">
                      <Upload size={20} className="text-green-400" />
                      <span className="text-xs font-bold text-white">Restaurar Dados</span>
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
              className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors"
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
