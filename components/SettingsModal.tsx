import React, { useState } from 'react';
import { AppSettings } from '../types';
import { X, Save, Crown } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  isPro: boolean;
  onSubscribe: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onSave,
  isPro,
  onSubscribe
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);

  if (!isOpen) return null;

  const handleChange = (field: keyof AppSettings, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: typeof prev[field] === 'number' ? Number(value) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white font-display">Configurações</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Plan Status Section */}
          <div className={`p-4 rounded-xl border ${isPro ? 'bg-gold-500/10 border-gold-500/20' : 'bg-gray-900 border-gray-700'}`}>
             <div className="flex justify-between items-center">
                <div>
                   <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Status do Plano</p>
                   <p className={`font-bold ${isPro ? 'text-gold-500' : 'text-white'}`}>
                      {isPro ? 'Vitalício PRO' : 'Versão de Teste'}
                   </p>
                </div>
                {isPro ? (
                    <Crown className="text-gold-500" />
                ) : (
                    <button 
                        type="button"
                        onClick={() => { onClose(); onSubscribe(); }}
                        className="bg-gold-500 hover:bg-gold-600 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-lg shadow-gold-500/20 animate-pulse"
                    >
                        ATIVAR AGORA
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

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">URL do Logo (Opcional)</label>
            <input
              type="text"
              value={formData.logoUrl}
              onChange={(e) => handleChange('logoUrl', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-gold-500 focus:border-transparent outline-none"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Preço Corte (R$)</label>
              <input
                type="number"
                value={formData.priceCut}
                onChange={(e) => handleChange('priceCut', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Preço Combo (R$)</label>
              <input
                type="number"
                value={formData.priceCombo}
                onChange={(e) => handleChange('priceCombo', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Taxa de Comissão (%)</label>
            <input
              type="number"
              value={formData.commissionRate}
              onChange={(e) => handleChange('commissionRate', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Porcentagem paga ao barbeiro.</p>
          </div>

          <div className="pt-4">
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