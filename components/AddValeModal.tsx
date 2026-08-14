
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
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setBarber(settings?.barbers && settings.barbers.length > 0 ? settings.barbers[0].name : '');
      setValue('');
      setDescription('');
      setFormError('');
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setFormError('Informe um valor de vale maior que zero.');
      return;
    }

    onAdd({
      barberName: barber,
      value: numericValue,
      description: description || 'Adiantamento'
    });
    onClose();
  };

  return (
    <div className="ui-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="ui-modal rounded-2xl w-full max-w-md">
        <div className="ui-modal-header flex justify-between items-center p-6">
          <h2 className="text-xl font-bold font-display">Registrar Vale</h2>
          <button onClick={onClose} className="ui-modal-close">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="ui-label block mb-1">Barbeiro</label>
             {settings?.barbers && settings.barbers.length > 0 ? (
                 <div className="relative">
                    <select
                        required
                        value={barber}
                        onChange={(e) => setBarber(e.target.value)}
                        className="ui-input appearance-none"
                    >
                       {settings.barbers.map((barberOption) => (
  <option key={barberOption.id} value={barberOption.name}>
    {barberOption.name}
  </option>
))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                 </div>
            ) : (
                <input
                required
                type="text"
                value={barber}
                onChange={(e) => setBarber(e.target.value)}
                className="ui-input"
                placeholder="Quem está retirando?"
                />
            )}
          </div>

          <div>
            <label className="ui-label block mb-1">Valor (R$)</label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="ui-input"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="ui-label block mb-1">Descricao (Opcional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="ui-input"
              placeholder="Ex: Almoço, Adiantamento"
            />
          </div>

          <div className="pt-4">
            {formError && (
              <p className="text-red-400 text-xs font-medium mb-3 text-center">
                {formError}
              </p>
            )}
            <button
              type="submit"
              className="ui-button ui-button-destructive w-full"
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
