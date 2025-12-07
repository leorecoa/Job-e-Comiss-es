
import React, { useState } from 'react';
import { X, Download, Calendar } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (startDate: string, endDate: string) => void;
  initialDate: string; // YYYY-MM-DD
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, onDownload, initialDate }) => {
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDownload(startDate, endDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-slide-in">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white font-display">Baixar Relatório</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-400">Selecione o período que deseja incluir no PDF.</p>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Data Inicial</label>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                  <Calendar size={16} />
                </div>
                <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Data Final</label>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                  <Calendar size={16} />
                </div>
                <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-black font-bold py-3 rounded-xl transition-colors shadow-lg shadow-gold-500/20"
            >
              <Download size={20} />
              Gerar PDF
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
