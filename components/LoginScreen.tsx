
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (profile: UserProfile) => void;
}

// Emails de Admin ofuscados (Base64) para não ficarem explícitos no código
// leandro@admin -> bGVhbmRyb0BhZG1pbg==
// gabriel@admin -> Z2FicmllbEBhZG1pbg==
const ADMIN_HASHES = [
  "bGVhbmRyb0BhZG1pbg==",
  "Z2FicmllbEBhZG1pbg=="
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName || !ownerName) return;

    // Verifica se o email digitado corresponde a um dos hashes de admin
    const emailHash = btoa(email.toLowerCase().trim());
    const isAdmin = ADMIN_HASHES.includes(emailHash);

    const newProfile: UserProfile = {
      shopName,
      ownerName,
      email,
      startDate: Date.now(),
      isPro: isAdmin, // Se a hash bater, entra como PRO (Vitalício)
      planType: isAdmin ? 'admin_life' : 'trial'
    };
    
    onLogin(newProfile);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-md overflow-hidden animate-slide-in">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-8 text-center border-b border-gray-700 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent"></div>
          
          <div className="bg-gray-900/50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gold-500 border border-gold-500/20 shadow-lg shadow-gold-500/10">
             {/* Logo Hexagonal SVG */}
             <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="7.5 12 10 14.5 16.5 8"></polyline>
             </svg>
          </div>
          
          <h1 className="text-2xl font-display font-bold text-white mb-1">Gestao Maxima</h1>
          <p className="text-gold-500 font-bold text-[10px] uppercase tracking-widest mb-2">Sistema Profissional</p>
          <p className="text-gray-400 text-sm">Configure seu sistema para comecar</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Nome do Negocio</label>
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
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Seu Nome (Dono/BarbeiroLider/Gerente)</label>
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
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email (para recuperacao)</label>
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
              Comecar Agora <ArrowRight size={20} />
            </button>
            <p className="text-center text-xs text-gray-500 mt-4">
              Ao continuar, voce inicia seu teste gratuito de 7 dias.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
