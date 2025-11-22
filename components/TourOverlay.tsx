
import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, X, Check } from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourOverlayProps {
  steps: TourStep[];
  isOpen: boolean;
  onComplete: () => void;
}

export const TourOverlay: React.FC<TourOverlayProps> = ({ steps, isOpen, onComplete }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  
  // Hook para recalcular posição quando a janela muda de tamanho ou o passo muda
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const step = steps[currentStepIndex];
      const element = document.getElementById(step.targetId);
      
      if (element) {
        // Scroll suave até o elemento
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        
        // Pequeno delay para garantir que o scroll terminou antes de pegar o retângulo
        setTimeout(() => {
            const rect = element.getBoundingClientRect();
            setTargetRect(rect);
        }, 100);
      } else {
        // Se o elemento não existe (ex: hidden no mobile), pular para próximo ou finalizar
        // Por segurança, apenas não mostramos o highlight mas mantemos o texto centralizado
        setTargetRect(null);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    
    return () => window.removeEventListener('resize', updatePosition);
  }, [currentStepIndex, isOpen, steps]);

  if (!isOpen) return null;

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => Math.max(0, prev - 1));
  };

  // Cálculo de estilo para o tooltip
  const getTooltipStyle = () => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const gap = 15;
    const position = currentStep.position || 'bottom';
    
    let top = 0;
    let left = 0;
    let transform = '';

    // Lógica simplificada de posicionamento
    // Se estiver em mobile (tela pequena), forçar posicionamento mais seguro
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
        // No mobile, geralmente bottom ou top é melhor
        // Se o elemento está muito em baixo, joga o tooltip pra cima
        if (targetRect.bottom > window.innerHeight - 200) {
             top = targetRect.top - gap;
             left = window.innerWidth / 2;
             transform = 'translate(-50%, -100%)';
        } else {
             top = targetRect.bottom + gap;
             left = window.innerWidth / 2;
             transform = 'translate(-50%, 0)';
        }
    } else {
        switch (position) {
            case 'top':
                top = targetRect.top - gap;
                left = targetRect.left + (targetRect.width / 2);
                transform = 'translate(-50%, -100%)';
                break;
            case 'bottom':
                top = targetRect.bottom + gap;
                left = targetRect.left + (targetRect.width / 2);
                transform = 'translate(-50%, 0)';
                break;
            case 'left':
                top = targetRect.top + (targetRect.height / 2);
                left = targetRect.left - gap;
                transform = 'translate(-100%, -50%)';
                break;
            case 'right':
                top = targetRect.top + (targetRect.height / 2);
                left = targetRect.right + gap;
                transform = 'translate(0, -50%)';
                break;
        }
    }

    return { top, left, transform };
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Camada Escura com Recorte (usando mix-blend-mode ou box-shadow trick) */}
      {/* Método Box-Shadow Gigante é mais robusto para highlights redondos/retangulares */}
      {targetRect && (
        <div 
            className="absolute transition-all duration-300 ease-in-out rounded-xl pointer-events-none border-2 border-gold-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.85)]"
            style={{
                top: targetRect.top - 4, // Pequena margem
                left: targetRect.left - 4,
                width: targetRect.width + 8,
                height: targetRect.height + 8,
            }}
        />
      )}
      
      {/* Se não achou o elemento, só escurece tudo */}
      {!targetRect && <div className="absolute inset-0 bg-black/80" />}

      {/* Tooltip */}
      <div 
        className="absolute w-[300px] bg-gray-800 text-white p-5 rounded-2xl border border-gray-700 shadow-2xl flex flex-col gap-3 transition-all duration-300 animate-slide-in"
        style={getTooltipStyle()}
      >
        <div className="flex justify-between items-start">
            <h3 className="font-display font-bold text-lg text-gold-500">{currentStep.title}</h3>
            <button onClick={onComplete} className="text-gray-500 hover:text-white">
                <X size={16} />
            </button>
        </div>
        
        <p className="text-sm text-gray-300 leading-relaxed">
            {currentStep.content}
        </p>

        <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-700">
            <span className="text-xs text-gray-500 font-mono">
                {currentStepIndex + 1} / {steps.length}
            </span>
            <div className="flex gap-2">
                {currentStepIndex > 0 && (
                    <button 
                        onClick={handlePrev}
                        className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                )}
                <button 
                    onClick={handleNext}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-600 text-black font-bold text-sm transition-colors"
                >
                    {isLastStep ? 'Concluir' : 'Próximo'}
                    {isLastStep ? <Check size={16} /> : <ChevronRight size={16} />}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
