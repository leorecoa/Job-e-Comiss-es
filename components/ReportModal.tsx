
import React, { useState, useEffect } from 'react';
import { X, FileText, FileSpreadsheet, Clock, Filter } from 'lucide-react';
import { financialPreset } from '../utils/financialTimezone';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (startDate: string, endDate: string, format: 'pdf' | 'csv') => void;
  initialDate: string; // YYYY-MM-DD
  financialTimezone?: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, onDownload, initialDate, financialTimezone }) => {
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
      const { start, end } = financialPreset(type, financialTimezone);
      setStartDate(start);
      setEndDate(end);
  };

  return (
    <div className="ui-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center p-4 animate-slide-in">
      <div className="ui-modal rounded-2xl w-full max-w-sm">
        <div className="ui-modal-header flex justify-between items-center p-6 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold font-display">Relatórios</h2>
            <p className="ui-owner-help text-xs">Escolha o período desejado</p>
          </div>
          <button onClick={onClose} className="ui-modal-close">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Quick Filters */}
          <div>
              <label className="ui-label text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Clock size={12} /> Períodos Rápidos
              </label>
              <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setPreset('today')}
                    className="ui-button ui-button-secondary text-xs"
                  >
                      Hoje
                  </button>
                  <button 
                    onClick={() => setPreset('yesterday')}
                    className="ui-button ui-button-secondary text-xs"
                  >
                      Ontem
                  </button>
                  <button 
                    onClick={() => setPreset('week')}
                    className="ui-button ui-button-secondary text-xs"
                  >
                      Últimos 7 Dias
                  </button>
                  <button 
                    onClick={() => setPreset('month')}
                    className="ui-button ui-button-secondary text-xs"
                  >
                      Este Mês
                  </button>
              </div>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <label className="ui-label text-xs uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Filter size={12} /> Intervalo Personalizado
            </label>
            
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="ui-label block text-[10px] mb-1">De:</label>
                    <div className="relative">
                        <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="ui-input text-xs"
                        />
                    </div>
                </div>

                <div>
                    <label className="ui-label block text-[10px] mb-1">Até:</label>
                    <div className="relative">
                        <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="ui-input text-xs"
                        />
                    </div>
                </div>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => handleDownload('pdf')}
              className="ui-button ui-button-secondary flex-1 flex-col"
            >
              <FileText size={20} className="text-red-600" />
              <span className="text-xs">Gerar PDF</span>
            </button>
            <button
              onClick={() => handleDownload('csv')}
              className="ui-button ui-button-primary flex-1 flex-col"
            >
              <FileSpreadsheet size={20} />
              <span className="text-xs">Gerar Excel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
