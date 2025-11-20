import React, { useState } from 'react';
import { X, CheckCircle, Copy, Check, Crown } from 'lucide-react';

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
      setError('Código inválido.');
      setSuccessMsg('');
    } else {
      setError('');
      setSuccessMsg('Acesso Vitalício Liberado com Sucesso!');
      setTimeout(() => {
        onClose();
        setSuccessMsg('');
        setActivationCode('');
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gold-500/30 relative overflow-hidden animate-slide-in">
        {/* Header Decorativo */}
        <div className="bg-gradient-to-r from-gold-600 to-gold-400 p-4 text-center relative">
          <button 
            onClick={onClose} 
            className="absolute top-3 right-3 text-black/50 hover:text-black transition-colors"
          >
            <X size={24} />
          </button>
          <div className="bg-white/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 backdrop-blur-sm">
            <Crown size={24} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-black font-display">Seja PRO Vitalício</h2>
          <p className="text-black/80 text-xs font-medium">Liberte todo o potencial do seu negócio</p>
        </div>

        <div className="p-6 space-y-5">
          
          <div className="text-center space-y-1">
            <p className="text-gray-300 text-sm">Faça o pagamento único e nunca mais se preocupe com mensalidades.</p>
          </div>

          {/* Área do PIX */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 relative">
            <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-gold-500 font-bold uppercase tracking-wider">Dados do PIX</span>
                <span className="text-white font-bold text-lg">R$ 29,90</span>
            </div>
            
            <div className="space-y-2 bg-gray-800 p-3 rounded-lg border border-gray-700/50">
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Chave (CPF)</p>
                <div className="flex items-center justify-between gap-2">
                   <code className="text-white font-mono text-sm truncate">{pixKey}</code>
                   <button onClick={handleCopyPix} className="text-gold-500 hover:text-white transition-colors">
                     {copied ? <Check size={16} /> : <Copy size={16} />}
                   </button>
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Nome:</span>
                <span className="text-gray-200">Leandro Jesse da Silva</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Banco:</span>
                <span className="text-gray-200">Banco Pan</span>
              </div>
            </div>
          </div>

          {/* Área de Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-400">
              Código de Liberação
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                placeholder="DIGITE O CÓDIGO"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none uppercase text-center tracking-widest font-mono"
              />
            </div>
             {error && <p className="text-red-400 text-xs text-center font-medium">{error}</p>}
             {successMsg && <p className="text-green-400 text-xs text-center font-medium">{successMsg}</p>}
          </div>

          <button
            onClick={handleUnlock}
            className="w-full bg-gold-500 hover:bg-gold-600 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold-500/20"
          >
            <CheckCircle size={20} />
            Validar Pagamento
          </button>
          
          <p className="text-[10px] text-gray-500 text-center px-4">
            Envie o comprovante para o suporte para receber seu código imediatamente.
          </p>
        </div>
      </div>
    </div>
  );
};