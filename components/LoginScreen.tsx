
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Scissors, ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (profile: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName || !ownerName) return;

    const newProfile: UserProfile = {
      shopName,
      ownerName,
      email,
      startDate: Date.now(),
      isPro: false
    };
    
    onLogin(newProfile);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-md overflow-hidden animate-slide-in">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-8 text-center border-b border-gray-700 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent"></div>
          <div className="bg-gold-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gold-500 border border-gold-500/20">
            <Scissors size={32} />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-2">Barbearia Pro</h1>
          <p className="text-gray-400 text-sm">Configure seu sistema para começar</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Nome da Barbearia</label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none transition-all"
              placeholder="Ex: Barbearia do Silva"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Seu Nome (Dono/Gerente)</label>
            <input
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none transition-all"
              placeholder="Ex: Carlos"
            />
          </div>

           <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email (para recuperação)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none transition-all"
              placeholder="seu@email.com"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-gold-500 hover:bg-gold-600 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 hover:translate-y-[-2px] shadow-lg shadow-gold-500/20"
            >
              Começar Agora <ArrowRight size={20} />
            </button>
            <p className="text-center text-xs text-gray-500 mt-4">
              Ao continuar, você inicia seu teste gratuito de 7 dias.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
