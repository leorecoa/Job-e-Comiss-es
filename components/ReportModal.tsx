
import React, { useState, useEffect } from 'react';
import { X, Calendar, FileText, FileSpreadsheet, Clock, Filter } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (startDate: string, endDate: string, format: 'pdf' | 'csv') => void;
  initialDate: string; // YYYY-MM-DD
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, onDownload, initialDate }) => {
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);

  // Resetar datas quando o modal abre
  useEffect(() => {
    if (isOpen) {
        setStartDate(initialDate);
        setEndDate(initialDate);
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const handleDownload = (format: 'pdf' | 'csv') => {
    onDownload(startDate, endDate, format);
    onClose();
  };

  const setPreset = (type: 'today' | 'yesterday' | 'week' | 'month') => {
      const end = new Date();
      const start = new Date();

      if (type === 'today') {
          // Start and End are today
      } else if (type === 'yesterday') {
          start.setDate(end.getDate() - 1);
          end.setDate(end.getDate() - 1);
      } else if (type === 'week') {
          start.setDate(end.getDate() - 6); // Last 7 days including today
      } else if (type === 'month') {
          start.setDate(1); // 1st of current month
      }

      // Format YYYY-MM-DD safe for local time
      const formatDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
      };

      setStartDate(formatDate(start));
      setEndDate(formatDate(end));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-slide-in">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700">
        <div className="flex justify-between items-center p-6 border-b border-gray-700 bg-gray-900/50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white font-display">Relatórios</h2>
            <p className="text-xs text-gray-400">Escolha o período desejado</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Quick Filters */}
          <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Clock size={12} /> Períodos Rápidos
              </label>
              <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setPreset('today')}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium py-2 rounded-lg border border-gray-600 transition-colors"
                  >
                      Hoje
                  </button>
                  <button 
                    onClick={() => setPreset('yesterday')}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium py-2 rounded-lg border border-gray-600 transition-colors"
                  >
                      Ontem
                  </button>
                  <button 
                    onClick={() => setPreset('week')}
                    className="bg-gray-700 hover:bg-gray-600 text-gold-500 text-xs font-medium py-2 rounded-lg border border-gray-600 transition-colors"
                  >
                      Últimos 7 Dias
                  </button>
                  <button 
                    onClick={() => setPreset('month')}
                    className="bg-gray-700 hover:bg-gray-600 text-blue-400 text-xs font-medium py-2 rounded-lg border border-gray-600 transition-colors"
                  >
                      Este Mês
                  </button>
              </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Filter size={12} /> Intervalo Personalizado
            </label>
            
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] text-gray-400 mb-1">De:</label>
                    <div className="relative">
                        <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white text-xs focus:ring-1 focus:ring-gold-500 outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Até:</label>
                    <div className="relative">
                        <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white text-xs focus:ring-1 focus:ring-gold-500 outline-none"
                        />
                    </div>
                </div>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => handleDownload('pdf')}
              className="flex-1 flex flex-col items-center justify-center gap-1 bg-white hover:bg-gray-100 text-black font-bold py-3 px-2 rounded-xl transition-all shadow-lg active:scale-95"
            >
              <FileText size={20} className="text-red-600" />
              <span className="text-xs">Gerar PDF</span>
            </button>
            <button
              onClick={() => handleDownload('csv')}
              className="flex-1 flex flex-col items-center justify-center gap-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-2 rounded-xl transition-all shadow-lg active:scale-95 border border-green-500"
            >
              <FileSpreadsheet size={20} className="text-white" />
              <span className="text-xs">Gerar Excel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
