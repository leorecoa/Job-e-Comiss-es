
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

    // Lógica de "Backdoor" para o Administrador (Você)
    // Se o email for leandro@admin, já entra como PRO (Vitalício)
    const isAdmin = email.toLowerCase().trim() === 'leandro@admin';

    const newProfile: UserProfile = {
      shopName,
      ownerName,
      email,
      startDate: Date.now(),
      isPro: isAdmin, // Se for admin, já começa pago/vitalício
      planType: isAdmin ? 'admin_life' : 'trial'
    };

    onLogin(newProfile);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-gold-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="glass-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in relative z-10">
        <div className="bg-gradient-to-b from-white/5 to-transparent p-8 text-center border-b border-white/5 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent"></div>
          <div className="bg-gradient-to-br from-gray-800 to-black w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gold-500 border border-gold-500/30 shadow-glow transform rotate-3 hover:rotate-0 transition-all duration-500">
            <Scissors size={36} />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2 tracking-tight">Barbearia Pro</h1>
          <p className="text-gray-400 text-sm">Gestão profissional para o seu negócio</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gold-500 uppercase tracking-wider ml-1">Nome da Barbearia</label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50 outline-none transition-all placeholder:text-gray-600"
              placeholder="Ex: Barbearia do Silva"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gold-500 uppercase tracking-wider ml-1">Seu Nome</label>
            <input
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50 outline-none transition-all placeholder:text-gray-600"
              placeholder="Ex: Carlos"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gold-500 uppercase tracking-wider ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50 outline-none transition-all placeholder:text-gray-600"
              placeholder="seu@email.com"
            />
            <p className="text-[10px] text-gray-500 mt-1 ml-1">Para recuperação de conta e novidades.</p>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-gold-400 to-gold-600 hover:from-gold-300 hover:to-gold-500 text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 hover:translate-y-[-2px] shadow-glow hover:shadow-glow-lg"
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
