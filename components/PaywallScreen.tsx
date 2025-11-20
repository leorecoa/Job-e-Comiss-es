
import React from 'react';
import { CheckCircle, Star, Lock } from 'lucide-react';

interface PaywallScreenProps {
  onSubscribe: () => void;
  daysUsed: number;
}

export const PaywallScreen: React.FC<PaywallScreenProps> = ({ onSubscribe, daysUsed }) => {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-gold-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="bg-gray-900 rounded-3xl shadow-2xl border border-gray-800 w-full max-w-lg overflow-hidden animate-slide-in relative z-10">
        <div className="bg-gold-500 p-1 h-2 w-full"></div>
        
        <div className="p-8 md:p-12 text-center">
          <div className="bg-gray-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-gold-500 shadow-xl shadow-gold-500/20">
            <Lock size={32} className="text-gold-500" />
          </div>
          
          <h2 className="text-3xl font-display font-bold text-white mb-2">Seu período de teste acabou</h2>
          <p className="text-gray-400 mb-8">
            Você utilizou a Barbearia Pro por {Math.floor(daysUsed)} dias. Para continuar gerenciando seus clientes e faturamento com profissionalismo, ative sua assinatura.
          </p>

          <div className="bg-gray-800/50 rounded-2xl p-6 mb-8 border border-gray-700 text-left">
            <div className="flex items-baseline justify-center mb-6 border-b border-gray-700 pb-6">
              <span className="text-4xl font-bold text-white">R$ 29,90</span>
              <span className="text-gray-500 ml-2">/ mês</span>
            </div>
            
            <div className="space-y-3">
              {[
                'Acesso ilimitado ao sistema',
                'Relatórios financeiros detalhados',
                'Suporte prioritário',
                'Backup dos dados no navegador',
                'Sem anúncios'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onSubscribe}
            className="w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold-500/25 transform hover:scale-[1.02]"
          >
            <Star size={20} fill="black" />
            Assinar e Liberar Acesso
          </button>
          
          <p className="text-xs text-gray-600 mt-4">
            Pagamento seguro. Cancele quando quiser.
          </p>
        </div>
      </div>
    </div>
  );
};
