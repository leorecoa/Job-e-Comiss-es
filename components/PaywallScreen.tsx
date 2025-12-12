
import React, { useState } from 'react';
import { CheckCircle, Lock, Copy, Check, Users } from 'lucide-react';

interface PaywallScreenProps {
  onSubscribe: (code: string) => boolean; // Agora retorna boleano se deu certo
  daysUsed: number;
  expirationDate: number; // Novo prop para data de expiração
}

export const PaywallScreen: React.FC<PaywallScreenProps> = ({ onSubscribe, daysUsed, expirationDate }) => {
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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-gold-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="bg-gray-900 rounded-3xl shadow-2xl border border-gray-800 w-full max-w-3xl overflow-hidden animate-slide-in relative z-10">
        <div className="bg-gold-500 p-1 h-2 w-full"></div>
        
        <div className="p-8 text-center">
          <div className="bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-gold-500 shadow-xl shadow-gold-500/20">
            <Lock size={24} className="text-gold-500" />
          </div>
          
          <h2 className="text-2xl font-display font-bold text-white mb-2">Periodo de Teste Encerrado</h2>
          <p className="text-gray-400 text-sm mb-1">
             Seu teste de 7 dias encerrou em <span className="text-gold-500 font-bold">{formatDate(expirationDate)}</span>.
          </p>
          <p className="text-gray-500 text-xs mb-8">
            Escolha o plano ideal para continuar gerenciando sua barbearia profissionalmente.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
             {/* Plano PRO */}
             <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-gold-500/50 transition-colors">
                <h3 className="text-lg font-bold text-white mb-1">PRO Individual</h3>
                <p className="text-gold-500 font-bold text-xl mb-3">R$ 29,90 <span className="text-xs font-normal text-gray-500">/mes</span></p>
                <p className="text-xs text-gray-400 mb-4">Para barbeiros autonomos.</p>
                <ul className="text-left text-xs text-gray-300 space-y-2">
                    <li className="flex gap-2"><Check size={12} className="text-gold-500"/> 1 Usuario</li>
                    <li className="flex gap-2"><Check size={12} className="text-gold-500"/> Gestao Completa</li>
                </ul>
             </div>

             {/* Plano VIP */}
             <div className="bg-blue-900/10 border border-blue-500/30 rounded-xl p-5 hover:bg-blue-900/20 transition-colors relative">
                <div className="absolute top-3 right-3">
                    <Users size={16} className="text-blue-400"/>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">VIP Equipe</h3>
                <p className="text-blue-400 font-bold text-xl mb-3">R$ 59,90 <span className="text-xs font-normal text-gray-500">/mes</span></p>
                <p className="text-xs text-gray-400 mb-4">Para barbearias com equipe.</p>
                <ul className="text-left text-xs text-gray-300 space-y-2">
                    <li className="flex gap-2"><Check size={12} className="text-blue-400"/> Ate 4 Barbeiros</li>
                    <li className="flex gap-2"><Check size={12} className="text-blue-400"/> Selecao Rapida</li>
                </ul>
             </div>
          </div>

          {/* Área do PIX */}
          <div className="bg-gray-800/80 rounded-xl p-5 mb-6 border border-gray-700 text-left relative overflow-hidden">
            <div className="flex justify-between items-start">
                <div className="space-y-2 mb-2 w-full">
                    <div>
                        <p className="text-xs text-gray-400">Chave PIX (CPF) - Leandro Jesse da Silva:</p>
                        <div className="flex items-center gap-2 mt-1">
                            <code className="bg-gray-900 px-2 py-1 rounded text-gold-500 font-mono font-bold text-sm">{pixKey}</code>
                            <button onClick={handleCopyPix} className="text-gray-400 hover:text-white transition-colors" title="Copiar">
                                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <p className="text-[10px] text-gray-500 italic mt-2 border-t border-gray-700 pt-2">Faca o PIX do valor correspondente ao plano escolhido.</p>
          </div>

          {/* Área de Desbloqueio */}
          <div className="space-y-3 max-w-md mx-auto">
            <label className="block text-left text-sm font-medium text-gray-300">
              Digite o codigo recebido:
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                placeholder="SEU CÓDIGO DE ATIVAÇÃO"
                className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none uppercase tracking-widest font-mono text-center"
              />
            </div>
             {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            
            <button
              onClick={handleUnlock}
              className="w-full bg-gold-500 hover:bg-gold-600 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold-500/20"
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
