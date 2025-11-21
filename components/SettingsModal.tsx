
import React, { useState } from 'react';
import { AppSettings, UserProfile } from '../types';
import { X, Save, Crown, Users, Trash2, Plus, Settings, Store } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  userProfile: UserProfile;
  onSubscribe: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  userProfile,
  onSubscribe
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [newBarberName, setNewBarberName] = useState('');

  if (!isOpen) return null;

  const isVip = userProfile.planType === 'vip_monthly' || userProfile.planType === 'admin_life';

  const handleChange = (field: keyof AppSettings, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: typeof prev[field] === 'number' ? Number(value) : value
    }));
  };

  const handleAddBarber = () => {
    if (newBarberName.trim() && (formData.barbers?.length || 0) < 4) {
      setFormData(prev => ({
        ...prev,
        barbers: [...(prev.barbers || []), newBarberName.trim()]
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="glass-card rounded-2xl shadow-2xl w-full max-w-md border border-white/10 max-h-[90vh] overflow-y-auto animate-scale-in custom-scrollbar">
        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-white/5 sticky top-0 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="bg-gold-500/10 p-2 rounded-lg border border-gold-500/20">
              <Settings size={20} className="text-gold-500" />
            </div>
            <h2 className="text-xl font-bold text-white font-display">Configurações</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Plan Status Section */}
          <div className={`p-5 rounded-xl border relative overflow-hidden group ${userProfile.isPro ? 'bg-gradient-to-br from-gold-500/10 to-black border-gold-500/30' : 'bg-gray-900 border-gray-700'}`}>
            {userProfile.isPro && <div className="absolute -right-4 -top-4 w-20 h-20 bg-gold-500/20 rounded-full blur-2xl group-hover:bg-gold-500/30 transition-all"></div>}

            <div className="flex justify-between items-center relative z-10">
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Seu Plano Atual</p>
                <p className={`font-bold text-sm ${userProfile.isPro ? 'text-gold-500' : 'text-white'}`}>
                  {userProfile.isPro
                    ? (isVip ? 'VIP Multi-Barbeiros (Ativo)' : 'Assinatura PRO Standard')
                    : 'Versão de Teste'}
                </p>
              </div>
              {userProfile.isPro ? (
                <div className="bg-gold-500/20 p-2 rounded-full border border-gold-500/30">
                  <Crown className="text-gold-500" size={20} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { onClose(); onSubscribe(); }}
                  className="bg-gold-500 hover:bg-gold-600 text-black text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-gold-500/20 animate-pulse"
                >
                  ASSINAR AGORA
                </button>
              )}
            </div>
          </div>

          {/* VIP Barber Management Section */}
          {isVip && (
            <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-900/10 space-y-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Users size={18} />
                <h3 className="font-bold text-sm uppercase tracking-wider">Equipe (VIP)</h3>
              </div>

              <div className="space-y-2">
                {(formData.barbers || []).map((barber, index) => (
                  <div key={index} className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                    <span className="text-white text-sm font-medium">{barber}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveBarber(index)}
                      className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {(formData.barbers?.length || 0) < 4 ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBarberName}
                    onChange={(e) => setNewBarberName(e.target.value)}
                    placeholder="Nome do Barbeiro"
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddBarber}
                    className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-lg transition-colors shadow-lg shadow-blue-600/20"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center bg-black/20 py-2 rounded-lg">Limite de 4 barbeiros atingido.</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Nome da Barbearia</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                <Store size={16} />
              </div>
              <input
                type="text"
                value={formData.shopName}
                onChange={(e) => handleChange('shopName', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-gold-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">URL do Logo (Opcional)</label>
            <input
              type="text"
              value={formData.logoUrl}
              onChange={(e) => handleChange('logoUrl', e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500/50 outline-none transition-all placeholder:text-gray-700"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Preço Corte (R$)</label>
              <input
                type="number"
                value={formData.priceCut}
                onChange={(e) => handleChange('priceCut', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500/50 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Preço Combo (R$)</label>
              <input
                type="number"
                value={formData.priceCombo}
                onChange={(e) => handleChange('priceCombo', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Taxa de Comissão (%)</label>
            <input
              type="number"
              value={formData.commissionRate}
              onChange={(e) => handleChange('commissionRate', e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500/50 outline-none transition-all"
            />
            <p className="text-[10px] text-gray-500 ml-1">Porcentagem paga ao barbeiro.</p>
          </div>

          <div className="pt-4 border-t border-white/10">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-200 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg transform hover:-translate-y-0.5"
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
