
import React, { useState } from 'react';
import { X, CheckCircle, Copy, Check, Crown, Users } from 'lucide-react';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: (code: string) => boolean;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose, onSubscribe }) => {
  const [activationCode, setActivationCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const pixKey = "05359566493";

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlock = () => {
    const success = onSubscribe(activationCode);
    if (!success) {
      setError('Código inválido. Verifique se digitou o código correto do plano escolhido.');
      setSuccessMsg('');
    } else {
      setError('');
      setSuccessMsg('Assinatura Liberada com Sucesso!');
      setTimeout(() => {
        onClose();
        setSuccessMsg('');
        setActivationCode('');
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-gold-500/30 relative overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-gold-600 to-gold-400 p-4 text-center relative">
          <button 
            onClick={onClose} 
            className="absolute top-3 right-3 text-black/50 hover:text-black transition-colors"
          >
            <X size={24} />
          </button>
          <h2 className="text-xl font-bold text-black font-display">Escolha seu Plano</h2>
          <p className="text-black/80 text-xs font-medium">Desbloqueie todo o potencial do sistema</p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Coluna PRO */}
            <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-4 flex flex-col relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-700 text-gray-300 text-[10px] px-2 py-0.5 rounded-full border border-gray-600">
                    POPULAR
                </div>
                <div className="text-center mb-4 mt-2">
                    <h3 className="font-bold text-white text-lg">PRO Individual</h3>
                    <div className="flex items-center justify-center gap-1 text-gold-500 font-bold text-2xl mt-1">
                        <span className="text-sm">R$</span>29,90<span className="text-sm text-gray-500">/mês</span>
                    </div>
                </div>
                <ul className="text-xs text-gray-400 space-y-2 mb-4 flex-1">
                    <li className="flex gap-2"><Check size={14} className="text-gold-500"/> Controle total de caixa</li>
                    <li className="flex gap-2"><Check size={14} className="text-gold-500"/> Relatórios mensais</li>
                    <li className="flex gap-2"><Check size={14} className="text-gold-500"/> 1 Usuário/Barbeiro</li>
                </ul>
                <div className="bg-gray-800 p-2 rounded border border-dashed border-gray-600 text-center">
                     <p className="text-[10px] text-gray-500">Código começa com:</p>
                     <code className="text-gold-500 font-mono font-bold">PRO... / MENSAL...</code>
                </div>
            </div>

            {/* Coluna VIP */}
            <div className="bg-blue-900/10 rounded-xl border border-blue-500/30 p-4 flex flex-col relative">
                 <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full border border-blue-400 shadow-lg shadow-blue-500/20">
                    EQUIPE
                </div>
                <div className="text-center mb-4 mt-2">
                    <h3 className="font-bold text-white text-lg flex items-center justify-center gap-2">
                        VIP Multi <Users size={16} className="text-blue-400"/>
                    </h3>
                    <div className="flex items-center justify-center gap-1 text-blue-400 font-bold text-2xl mt-1">
                        <span className="text-sm">R$</span>59,90<span className="text-sm text-gray-500">/mês</span>
                    </div>
                </div>
                <ul className="text-xs text-gray-400 space-y-2 mb-4 flex-1">
                    <li className="flex gap-2"><Check size={14} className="text-blue-400"/> Tudo do plano PRO</li>
                    <li className="flex gap-2"><Check size={14} className="text-blue-400"/> <strong className="text-white">Até 4 Barbeiros</strong></li>
                    <li className="flex gap-2"><Check size={14} className="text-blue-400"/> Seleção rápida de equipe</li>
                </ul>
                 <div className="bg-gray-800 p-2 rounded border border-dashed border-gray-600 text-center">
                     <p className="text-[10px] text-gray-500">Código começa com:</p>
                     <code className="text-blue-400 font-mono font-bold">VIP... / EQUIPE...</code>
                </div>
            </div>

        </div>

        {/* Área de Pagamento Comum */}
        <div className="px-6 pb-6">
             <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400 uppercase">Chave PIX (CPF)</span>
                    <button onClick={handleCopyPix} className="text-gold-500 flex items-center gap-1 text-xs hover:text-white transition-colors">
                        {copied ? "Copiado!" : "Copiar Chave"} {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </div>
                <code className="block w-full bg-gray-800 p-2 rounded text-center text-white font-mono text-sm mb-2 select-all">
                    {pixKey}
                </code>
                <div className="flex justify-between text-[10px] text-gray-500 px-1">
                    <span>Leandro Jesse da Silva</span>
                    <span>Banco Pan</span>
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-400 text-center">
                Insira seu Código de Ativação
                </label>
                <input 
                    type="text" 
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                    placeholder="DIGITE O CÓDIGO AQUI"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none uppercase text-center tracking-widest font-mono"
                />
                {error && <p className="text-red-400 text-xs text-center font-medium">{error}</p>}
                {successMsg && <p className="text-green-400 text-xs text-center font-medium">{successMsg}</p>}
            </div>

            <button
                onClick={handleUnlock}
                className="w-full mt-4 bg-gold-500 hover:bg-gold-600 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold-500/20"
            >
                <CheckCircle size={20} />
                Validar e Liberar
            </button>
        </div>
      </div>
    </div>
  );
};
