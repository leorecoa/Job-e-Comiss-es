
import React, { useEffect, useMemo, useState } from 'react';
import { X, Save } from 'lucide-react';
import { Appointment, AppSettings, BarberOption } from '../types';
import {
  addMinutesIso,
  buildLocalDateTimeIso,
  toLocalDateInputValue,
  toLocalTimeInputValue
} from '../scheduling';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appointment: Appointment) => void;
  settings: AppSettings;
  selectedDate: string;
  selectedBarber: string;
  initialData?: Appointment | null;
  createId: () => string;
}

const normalizeBarberOptions = (
  barbers: BarberOption[] = [],
  selectedBarber?: string
): BarberOption[] => {
  const validBarbers = barbers.filter(
    (barber) => barber.id?.trim() && barber.name?.trim()
  );

  if (validBarbers.length > 0) {
    return validBarbers;
  }

  if (selectedBarber?.trim()) {
    return [
      {
        id: `fallback:${selectedBarber.trim()}`,
        name: selectedBarber.trim()
      }
    ];
  }

  return [];
};

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  settings,
  selectedDate,
  selectedBarber,
  initialData,
  createId
}) => {
  const fallbackService = settings.services[0];

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [barberName, setBarberName] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceValue, setServiceValue] = useState('');
  const [dateInput, setDateInput] = useState(selectedDate);
  const [timeInput, setTimeInput] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [notes, setNotes] = useState('');

  const barberOptions = useMemo(
    () => normalizeBarberOptions(settings.barbers || [], selectedBarber),
    [settings.barbers, selectedBarber]
  );

  const selectedBarberOption = useMemo(
    () => barberOptions.find((barber) => barber.name === barberName),
    [barberOptions, barberName]
  );

  const selectedService = useMemo(
    () => settings.services.find((service) => service.name === serviceName),
    [settings.services, serviceName]
  );

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      const start = new Date(initialData.startAt);
      const end = new Date(initialData.endAt);

      setClientName(initialData.clientName);
      setClientPhone(initialData.clientPhone || '');
      setBarberName(initialData.barberName);
      setServiceName(initialData.serviceType);
      setServiceValue(String(initialData.serviceValue));
      setDateInput(toLocalDateInputValue(start));
      setTimeInput(toLocalTimeInputValue(start));
      setDurationMinutes(String(Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))));
      setNotes(initialData.notes || '');
      return;
    }

    setClientName('');
    setClientPhone('');
    setBarberName(selectedBarber || barberOptions[0]?.name || '');
    setServiceName(fallbackService?.name || 'Corte');
    setServiceValue(String(fallbackService?.price ?? 0));
    setDateInput(selectedDate);
    setTimeInput('09:00');
    setDurationMinutes(String(fallbackService?.durationMinutes ?? 30));
    setNotes('');
  }, [
    isOpen,
    initialData,
    selectedDate,
    selectedBarber,
    barberOptions,
    fallbackService
  ]);

  const handleServiceChange = (name: string) => {
    setServiceName(name);

    const service = settings.services.find((item) => item.name === name);

    if (service) {
      setServiceValue(String(service.price));
      setDurationMinutes(String(service.durationMinutes));
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const now = new Date().toISOString();
    const startAt = buildLocalDateTimeIso(dateInput, timeInput);
    const endAt = addMinutesIso(startAt, Math.max(1, Number(durationMinutes) || 30));

    const barberId =
      selectedBarberOption?.id && !selectedBarberOption.id.startsWith('fallback:')
        ? selectedBarberOption.id
        : undefined;

    const isServiceChanged = !initialData || initialData.serviceType !== serviceName;
    const commissionRate = isServiceChanged
      ? selectedService?.commissionRate
      : (initialData?.commissionRate ?? selectedService?.commissionRate);

    onSave({
      id: initialData?.id || createId(),
      barberId,
      serviceId: selectedService?.id,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || undefined,
      barberName,
      serviceType: serviceName,
      serviceValue: Math.max(0, Number(serviceValue) || 0),
      commissionRate,
      startAt,
      endAt,
      status: initialData?.status || 'scheduled',
      notes: notes.trim() || undefined,
      createdAt: initialData?.createdAt || now,
      updatedAt: now
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-slide-in">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white font-display">
            {initialData ? 'Editar agendamento' : 'Novo agendamento'}
          </h2>

          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="appointment-client-name" className="block text-sm font-medium text-gray-400 mb-1.5">
              Cliente
            </label>
            <input
              id="appointment-client-name"
              name="clientName"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>

          <div>
            <label htmlFor="appointment-client-phone" className="block text-sm font-medium text-gray-400 mb-1.5">
              Telefone WhatsApp
            </label>
            <input
              id="appointment-client-phone"
              name="clientPhone"
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="DDD + numero"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="appointment-date" className="block text-sm font-medium text-gray-400 mb-1.5">
                Data
              </label>
              <input
                id="appointment-date"
                name="date"
                type="date"
                required
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>

            <div>
              <label htmlFor="appointment-time" className="block text-sm font-medium text-gray-400 mb-1.5">
                Hora
              </label>
              <input
                id="appointment-time"
                name="time"
                type="time"
                required
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="appointment-barber" className="block text-sm font-medium text-gray-400 mb-1.5">
              Barbeiro
            </label>
            <select
              id="appointment-barber"
              name="barberName"
              required
              value={barberName}
              onChange={(e) => setBarberName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
            >
              {barberOptions.map((barber) => (
                <option key={barber.id} value={barber.name}>
                  {barber.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="appointment-service" className="block text-sm font-medium text-gray-400 mb-1.5">
                Servico
              </label>
              <select
                id="appointment-service"
                name="serviceName"
                required
                value={serviceName}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
              >
                {settings.services.map((service) => (
                  <option key={service.id} value={service.name}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="appointment-duration" className="block text-sm font-medium text-gray-400 mb-1.5">
                Min
              </label>
              <input
                id="appointment-duration"
                name="durationMinutes"
                type="number"
                min="1"
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="appointment-service-value" className="block text-sm font-medium text-gray-400 mb-1.5">
              Valor
            </label>
            <input
              id="appointment-service-value"
              name="serviceValue"
              type="number"
              min="0"
              step="0.01"
              required
              value={serviceValue}
              onChange={(e) => setServiceValue(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>

          <div>
            <label htmlFor="appointment-notes" className="block text-sm font-medium text-gray-400 mb-1.5">
              Observacoes
            </label>
            <textarea
              id="appointment-notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-gold-500/20"
          >
            <Save size={20} />
            Salvar agendamento
          </button>
        </form>
      </div>
    </div>
  );
};
