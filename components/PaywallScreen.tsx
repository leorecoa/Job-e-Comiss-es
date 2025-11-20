import React, { useState } from 'react';
import { CheckCircle, Lock, Copy, Check } from 'lucide-react';

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
      setError('Código inválido. Verifique com o administrador.');
    } else {
      setError('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-gold-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="bg-gray-900 rounded-3xl shadow-2xl border border-gray-800 w-full max-w-lg overflow-hidden animate-slide-in relative z-10">
        <div className="bg-gold-500 p-1 h-2 w-full"></div>
        
        <div className="p-8 text-center">
          <div className="bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-gold-500 shadow-xl shadow-gold-500/20">
            <Lock size={24} className="text-gold-500" />
          </div>
          
          <h2 className="text-2xl font-display font-bold text-white mb-2">Período de Teste Encerrado</h2>
          <p className="text-gray-400 text-sm mb-6">
            Sua avaliação de 7 dias acabou. Para continuar usando o sistema profissionalmente, assine o plano mensal.
          </p>

          {/* Área do PIX */}
          <div className="bg-gray-800/80 rounded-xl p-5 mb-6 border border-gray-700 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gold-500 text-black text-[10px] font-bold px-2 py-1 rounded-bl-lg">
              PIX
            </div>
            <p className="text-xs text-gray-500 uppercase font-bold mb-3 tracking-wider">Dados para Pagamento</p>
            
            <div className="space-y-2 mb-4">
              <div>
                <p className="text-xs text-gray-400">Chave PIX (CPF):</p>
                <div className="flex items-center gap-2">
                   <code className="text-gold-500 font-mono font-bold text-lg">{pixKey}</code>
                   <button onClick={handleCopyPix} className="text-gray-400 hover:text-white transition-colors" title="Copiar">
                     {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                   </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400">Nome:</p>
                <p className="text-white font-medium">Leandro Jesse da Silva</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Banco:</p>
                <p className="text-white font-medium">Banco Pan</p>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-3">
              <p className="text-xs text-gray-300 text-center">
                Valor: <span className="text-white font-bold">R$ 29,90</span> <span className="text-gray-500">/ mês</span>
              </p>
            </div>
          </div>

          {/* Área de Desbloqueio */}
          <div className="space-y-3">
            <label className="block text-left text-sm font-medium text-gray-300">
              Já fez o PIX? Digite o código de liberação mensal:
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                placeholder="CÓDIGO MENSAL"
                className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none uppercase tracking-widest font-mono text-center"
              />
            </div>
             {error && <p className="text-red-400 text-xs text-left">{error}</p>}
            
            <button
              onClick={handleUnlock}
              className="w-full bg-gold-500 hover:bg-gold-600 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold-500/20"
            >
              <CheckCircle size={20} />
              Validar e Liberar Acesso
            </button>
          </div>

          <p className="text-[10px] text-gray-600 mt-6">
            Após o pagamento, envie o comprovante para receber seu código mensal.
          </p>
        </div>
      </div>
    </div>
  );
};