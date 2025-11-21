
import React, { useState, useEffect } from 'react';
import { ServiceType, AppSettings, ClientType, Client } from '../types';
import { X, Check, UserPlus, UserCheck, Clock, ChevronDown, Scissors } from 'lucide-react';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (clientData: any) => void;
  initialData?: Client | null;
}

export const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, settings, onSave, initialData }) => {
  const [name, setName] = useState('');
  const [barber, setBarber] = useState('');
  const [service, setService] = useState<ServiceType>(ServiceType.CUT);
  const [clientType, setClientType] = useState<ClientType>(ClientType.RETURNING);
  const [extraValue, setExtraValue] = useState<string>('0');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [time, setTime] = useState('');

  // Reset or populate form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setBarber(initialData.barberName);
        setService(initialData.serviceType);
        setClientType(initialData.clientType || ClientType.RETURNING);
        setExtraValue(initialData.extraValue.toString());

        if (initialData.serviceType === ServiceType.OTHER) {
          setCustomPrice(initialData.serviceValue.toString());
        } else {
          setCustomPrice('');
        }

        // Set time from timestamp
        const d = new Date(initialData.timestamp);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        setTime(`${hours}:${minutes}`);

      } else {
        setName('');
        // Pre-select first barber if available in list
        setBarber(settings.barbers && settings.barbers.length > 0 ? settings.barbers[0] : '');
        setService(ServiceType.CUT);
        setClientType(ClientType.RETURNING);
        setExtraValue('0');
        setCustomPrice('');

        // Set current time
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setTime(`${hours}:${minutes}`);
      }
    }
  }, [isOpen, initialData, settings.barbers]);

  if (!isOpen) return null;

  const getBasePrice = () => {
    if (service === ServiceType.CUT) return settings.priceCut;
    if (service === ServiceType.COMBO) return settings.priceCombo;
    return Number(customPrice) || 0;
  };

  const getTotal = () => {
    return getBasePrice() + (Number(extraValue) || 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      barberName: barber,
      serviceType: service,
      clientType: clientType,
      serviceValue: getBasePrice(),
      extraValue: Number(extraValue),
      totalValue: getTotal(),
      timeStr: time // Send the time string back to App
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="glass-card rounded-2xl shadow-2xl w-full max-w-md border border-white/10 animate-scale-in overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="bg-gold-500/10 p-2 rounded-lg border border-gold-500/20">
              <Scissors size={20} className="text-gold-500" />
            </div>
            <h2 className="text-xl font-bold text-white font-display">
              {initialData ? 'Editar Atendimento' : 'Novo Atendimento'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Top Row: Client Type & Time */}
          <div className="grid grid-cols-2 gap-3">
            {/* Client Type Toggle */}
            <div className="flex bg-black/40 rounded-xl p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setClientType(ClientType.NEW)}
                className={`flex-1 flex items-center justify-center rounded-lg text-xs font-bold transition-all py-2.5 ${clientType === ClientType.NEW
                    ? 'bg-green-500/20 text-green-400 shadow-sm border border-green-500/30'
                    : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                <UserPlus size={14} className="mr-1.5" /> Novo
              </button>
              <button
                type="button"
                onClick={() => setClientType(ClientType.RETURNING)}
                className={`flex-1 flex items-center justify-center rounded-lg text-xs font-bold transition-all py-2.5 ${clientType === ClientType.RETURNING
                    ? 'bg-gold-500/20 text-gold-500 shadow-sm border border-gold-500/30'
                    : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                <UserCheck size={14} className="mr-1.5" /> Casa
              </button>
            </div>

            {/* Time Input */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <Clock size={16} />
              </div>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-white focus:ring-2 focus:ring-gold-500/50 outline-none [color-scheme:dark] font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Nome do Cliente</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500/50 outline-none placeholder:text-gray-600 transition-all"
              placeholder="Ex: João Silva"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Barbeiro</label>
            {settings.barbers && settings.barbers.length > 0 ? (
              <div className="relative">
                <select
                  required
                  value={barber}
                  onChange={(e) => setBarber(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500/50 outline-none appearance-none transition-all"
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
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500/50 outline-none placeholder:text-gray-600 transition-all"
                placeholder="Quem atendeu?"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Tipo de Serviço</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(ServiceType).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setService(type)}
                  className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border ${service === type
                      ? 'bg-gold-500 text-black border-gold-500 shadow-glow'
                      : 'bg-black/40 text-gray-400 border-white/10 hover:bg-white/5'
                    }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {service === ServiceType.OTHER && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Valor do Serviço (R$)</label>
              <input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500/50 outline-none transition-all"
                placeholder="0.00"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Adicionais (R$)</label>
            <input
              type="number"
              value={extraValue}
              onChange={(e) => setExtraValue(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500/50 outline-none transition-all"
              placeholder="0.00"
            />
            <p className="text-[10px] text-gray-500 ml-1">Sobrancelha, Pezinho, produtos, etc.</p>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Total Final</p>
              <p className="text-3xl font-bold text-gold-500 font-display">R$ {getTotal().toFixed(2)}</p>
            </div>
            <button
              type="submit"
              className="bg-white hover:bg-gray-200 text-black font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2 shadow-lg transform hover:-translate-y-0.5"
            >
              <Check size={20} />
              {initialData ? 'Salvar' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
