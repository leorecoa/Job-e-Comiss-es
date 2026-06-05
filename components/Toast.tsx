import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 3000); // Auto dismiss after 3 seconds

    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle size={20} className="text-green-400" />;
      case 'error': return <AlertCircle size={20} className="text-red-400" />;
      default: return <Info size={20} className="text-blue-400" />;
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case 'success': return 'border-green-400/30 bg-green-950/65 text-white shadow-green-900/25';
      case 'error': return 'border-red-400/30 bg-red-950/65 text-white shadow-red-900/25';
      default: return 'border-sky-400/30 bg-sky-950/65 text-white shadow-sky-900/25';
    }
  };

  return (
    <div className={`
      pointer-events-auto flex items-center gap-3 min-w-[300px] max-w-[calc(100vw-2rem)] p-4 rounded-xl border shadow-xl backdrop-blur-xl
      transform transition-all duration-300 animate-slide-in
      ${getStyles()}
    `}>
      {getIcon()}
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} className="text-white/50 hover:text-white transition-colors">
        <X size={16} />
      </button>
    </div>
  );
};
