
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
  readOnly?: boolean;
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
  createId,
  readOnly = false
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
    if (readOnly) {
      return;
    }

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
    <div className="ui-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-slide-in">
      <div className="ui-modal rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="ui-modal-header flex justify-between items-center p-6">
          <h2 className="text-xl font-bold font-display">
            {readOnly ? 'Detalhes do agendamento' : initialData ? 'Editar agendamento' : 'Novo agendamento'}
          </h2>

          <button type="button" onClick={onClose} className="ui-modal-close">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {readOnly && (
            <p className="ui-owner-status-info rounded-lg p-3 text-sm">
              Este atendimento ja foi concluido. Os dados ficam somente para consulta para preservar o lancamento financeiro.
            </p>
          )}
          <div>
            <label htmlFor="appointment-client-name" className="ui-label block mb-1.5">
              Cliente
            </label>
            <input
              id="appointment-client-name"
              name="clientName"
              required
              disabled={readOnly}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="ui-input"
            />
          </div>

          <div>
            <label htmlFor="appointment-client-phone" className="ui-label block mb-1.5">
              Telefone WhatsApp
            </label>
            <input
              id="appointment-client-phone"
              name="clientPhone"
              type="tel"
              disabled={readOnly}
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="DDD + numero"
              className="ui-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="appointment-date" className="ui-label block mb-1.5">
                Data
              </label>
              <input
                id="appointment-date"
                name="date"
                type="date"
                required
                disabled={readOnly}
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="ui-input"
              />
            </div>

            <div>
              <label htmlFor="appointment-time" className="ui-label block mb-1.5">
                Hora
              </label>
              <input
                id="appointment-time"
                name="time"
                type="time"
                required
                disabled={readOnly}
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                className="ui-input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="appointment-barber" className="ui-label block mb-1.5">
              Barbeiro
            </label>
            <select
              id="appointment-barber"
              name="barberName"
              required
              disabled={readOnly}
              value={barberName}
              onChange={(e) => setBarberName(e.target.value)}
              className="ui-input"
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
              <label htmlFor="appointment-service" className="ui-label block mb-1.5">
                Servico
              </label>
              <select
                id="appointment-service"
                name="serviceName"
                required
                disabled={readOnly}
                value={serviceName}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="ui-input"
              >
                {settings.services.map((service) => (
                  <option key={service.id} value={service.name}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="appointment-duration" className="ui-label block mb-1.5">
                Min
              </label>
              <input
                id="appointment-duration"
                name="durationMinutes"
                type="number"
                min="1"
                required
                disabled={readOnly}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="ui-input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="appointment-service-value" className="ui-label block mb-1.5">
              Valor
            </label>
            <input
              id="appointment-service-value"
              name="serviceValue"
              type="number"
              min="0"
              step="0.01"
              required
              disabled={readOnly}
              value={serviceValue}
              onChange={(e) => setServiceValue(e.target.value)}
              className="ui-input"
            />
          </div>

          <div>
            <label htmlFor="appointment-notes" className="ui-label block mb-1.5">
              Observacoes
            </label>
            <textarea
              id="appointment-notes"
              name="notes"
              disabled={readOnly}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="ui-textarea"
            />
          </div>

          {readOnly ? (
            <button type="button" onClick={onClose} className="ui-button ui-button-secondary w-full">
              Fechar
            </button>
          ) : (
            <button
              type="submit"
              className="ui-button ui-button-primary w-full"
            >
              <Save size={20} />
              Salvar agendamento
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
