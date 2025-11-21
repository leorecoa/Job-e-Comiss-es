
import React, { useState } from 'react';
import { CheckCircle, Lock, Copy, Check, Users, Crown, Star } from 'lucide-react';

interface PaywallScreenProps {
  onSubscribe: (code: string) => boolean; // Agora retorna boleano se deu certo
  daysUsed: number;
}

export const PaywallScreen: React.FC<PaywallScreenProps> = ({ onSubscribe, daysUsed }) => {
  const [activationCode, setActivationCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const pixKey = "05359566493";

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlock = () => {
    const success = onSubscribe(activationCode);
    if (!success) {
      setError('Código inválido. Verifique qual plano você adquiriu.');
    } else {
      setError('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-gold-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="glass-card rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-scale-in relative z-10 flex flex-col md:flex-row">

        {/* Left Side - Info */}
        <div className="w-full md:w-1/2 p-8 md:p-10 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-black/90 z-0"></div>
          <div className="relative z-10">
            <div className="bg-gradient-to-br from-gray-800 to-black w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-gold-500/30 shadow-glow">
              <Lock size={28} className="text-gold-500" />
            </div>

            <h2 className="text-3xl font-display font-bold text-white mb-3">Período de Teste Encerrado</h2>
            <p className="text-gray-400 mb-8 leading-relaxed">
              Sua barbearia atingiu o limite do período gratuito. Para continuar gerenciando seus clientes, comissões e equipe com excelência, escolha um de nossos planos premium.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-gray-300">
                <div className="p-2 bg-gold-500/10 rounded-lg text-gold-500"><Star size={18} /></div>
                <span className="text-sm">Gestão financeira completa</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <div className="p-2 bg-gold-500/10 rounded-lg text-gold-500"><Users size={18} /></div>
                <span className="text-sm">Controle de comissões automático</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <div className="p-2 bg-gold-500/10 rounded-lg text-gold-500"><Crown size={18} /></div>
                <span className="text-sm">Suporte prioritário</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Plans & Payment */}
        <div className="w-full md:w-1/2 bg-black/40 p-8 md:p-10 border-l border-white/5">
          <div className="space-y-4 mb-8">
            {/* Plano PRO */}
            <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 hover:border-gold-500/50 hover:bg-white/10 transition-all cursor-pointer">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white group-hover:text-gold-400 transition-colors">PRO Individual</h3>
                  <p className="text-xs text-gray-400">Para barbeiros autônomos</p>
                </div>
                <div className="text-right">
                  <p className="text-gold-500 font-bold text-xl">R$ 29,90</p>
                  <p className="text-[10px] text-gray-500">/mês</p>
                </div>
              </div>
            </div>

            {/* Plano VIP */}
            <div className="group relative overflow-hidden rounded-xl border border-blue-500/30 bg-blue-900/10 p-4 hover:border-blue-400 hover:bg-blue-900/20 transition-all cursor-pointer">
              <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">RECOMENDADO</div>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">VIP Equipe</h3>
                  <p className="text-xs text-gray-400">Para barbearias com equipe</p>
                </div>
                <div className="text-right">
                  <p className="text-blue-400 font-bold text-xl">R$ 59,90</p>
                  <p className="text-[10px] text-gray-500">/mês</p>
                </div>
              </div>
            </div>
          </div>

          {/* Área do PIX */}
          <div className="mb-8">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Pagamento via PIX</p>
            <div className="bg-black/50 rounded-xl p-4 border border-white/10 flex items-center justify-between gap-3 group hover:border-gold-500/30 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-500 mb-1">Chave CPF - Leandro Jesse</p>
                <code className="text-gold-500 font-mono font-bold text-sm truncate block">{pixKey}</code>
              </div>
              <button
                onClick={handleCopyPix}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all active:scale-95"
                title="Copiar"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 text-center">
              Após o pagamento, envie o comprovante para receber seu código.
            </p>
          </div>

          {/* Área de Desbloqueio */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
              Já tem o código?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                placeholder="DIGITE SEU CÓDIGO"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50 outline-none uppercase tracking-widest font-mono text-center placeholder:text-gray-700 transition-all"
              />
            </div>
            {error && <p className="text-red-400 text-xs text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">{error}</p>}

            <button
              onClick={handleUnlock}
              className="w-full bg-gradient-to-r from-gold-400 to-gold-600 hover:from-gold-300 hover:to-gold-500 text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-glow hover:shadow-glow-lg transform hover:-translate-y-0.5"
            >
              <CheckCircle size={20} />
              Liberar Acesso
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
