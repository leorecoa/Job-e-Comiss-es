
import React, { useState, useEffect } from 'react';
import { X, DollarSign, ChevronDown } from 'lucide-react';
import { AppSettings, ValeFormData } from '../types';

interface AddValeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (valeData: ValeFormData) => void;
  settings?: AppSettings;
}

export const AddValeModal: React.FC<AddValeModalProps> = ({ isOpen, onClose, onAdd, settings }) => {
  const [barber, setBarber] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      setBarber(settings?.barbers && settings.barbers.length > 0 ? settings.barbers[0] : '');
      setValue('');
      setDescription('');
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      barberName: barber,
      value: Number(value),
      description: description || 'Adiantamento'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white font-display">Registrar Vale</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Barbeiro</label>
             {settings?.barbers && settings.barbers.length > 0 ? (
                 <div className="relative">
                    <select
                        required
                        value={barber}
                        onChange={(e) => setBarber(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 outline-none appearance-none"
                    >
                        {settings.barbers.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                 </div>
            ) : (
                <input
                required
                type="text"
                value={barber}
                onChange={(e) => setBarber(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="Quem está retirando?"
                />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Valor (R$)</label>
            <input
              required
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Descricao (Opcional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="Ex: Almoço, Adiantamento"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              <DollarSign size={20} />
              Confirmar Retirada
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
