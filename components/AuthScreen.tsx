import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppRole } from '../services/authRepository';

interface AuthScreenProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, displayName: string, role: AppRole) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSignIn, onSignUp, loading = false, error }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<AppRole>('owner');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'signin') {
      await onSignIn(email.trim(), password);
      return;
    }

    await onSignUp(email.trim(), password, displayName.trim(), role);
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
          <div className="bg-gray-900/50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gold-500 border border-gold-500/20 shadow-lg shadow-gold-500/10">
            <Lock size={34} />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-1">Painel interno</h1>
          <p className="text-gray-400 text-sm">Entre com Supabase Auth para acessar a agenda.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="grid grid-cols-2 gap-2 bg-gray-900/50 p-1 rounded-xl border border-gray-700">
            <button type="button" onClick={() => setMode('signin')} className={`py-2 rounded-lg text-sm font-bold ${mode === 'signin' ? 'bg-gold-500 text-black' : 'text-gray-400'}`}>Entrar</button>
            <button type="button" onClick={() => setMode('signup')} className={`py-2 rounded-lg text-sm font-bold ${mode === 'signup' ? 'bg-gold-500 text-black' : 'text-gray-400'}`}>Criar acesso</button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-xl p-3">
              {error}
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Nome</label>
              <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Senha</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none" />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Perfil</label>
              <select value={role} onChange={(e) => setRole(e.target.value as AppRole)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none">
                <option value="owner">Dono</option>
                <option value="barber">Barbeiro</option>
              </select>
            </div>
          )}

          <button disabled={loading} type="submit" className="w-full bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold-500/20">
            {loading ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : 'Criar acesso'}
            <ArrowRight size={20} />
          </button>

          <p className="text-center text-xs text-gray-500">
            <a href="/book" className="text-gold-400 hover:text-gold-300 font-bold">Abrir agendamento publico</a>
          </p>
        </form>
      </motion.div>
    </div>
  );
};
