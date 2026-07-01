
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

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
      isPro: true,
      planType: 'trial'
    };
    
    onLogin(newProfile);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-md overflow-hidden"
      >
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-8 text-center border-b border-gray-700 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent"></div>
          
          <motion.div
            initial={{ opacity: 0, rotate: -8, scale: 0.88 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="bg-gray-900/50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gold-500 border border-gold-500/20 shadow-lg shadow-gold-500/10"
          >
             <img src="/brand-mark.svg" alt="Job e Comissoes" className="w-14 h-14" />
          </motion.div>
          
          <h1 className="text-2xl font-display font-bold text-white mb-1">Job e Comissoes</h1>
          <p className="text-gold-500 font-bold text-[10px] uppercase tracking-widest mb-2">Sistema operacional</p>
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
            <motion.button
              type="submit"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gold-500 hover:bg-gold-600 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 hover:translate-y-[-2px] shadow-lg shadow-gold-500/20"
            >
              Comecar Agora <ArrowRight size={20} />
            </motion.button>
            <p className="text-center text-xs text-gray-500 mt-4">
              Modo local para desenvolvimento e demonstracao. Em producao, use Supabase configurado.
            </p>
            <p className="text-center text-xs text-gray-500 mt-3">
              <a href="/book" className="text-gold-400 hover:text-gold-300 font-bold">Abrir agendamento publico</a>
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
