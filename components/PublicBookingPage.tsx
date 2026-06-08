import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle, Clock, MessageCircle, Scissors } from 'lucide-react';
import { Appointment, AppSettings, BarberOption, Service, UserProfile } from '../types';
import {
  buildWhatsAppLink,
  createPublicAppointment,
  getAvailableTimeSlots,
  PublicBookingInput,
  TimeSlot,
  validatePublicBookingInput
} from '../scheduling';
import { formatCurrency, generateId } from '../utils';

interface PublicBookingPageProps {
  settings: AppSettings;
  appointments: Appointment[];
  userProfile: UserProfile | null;
  onCreateAppointment: (appointment: Appointment) => Promise<void> | void;
}

type PublicBarberOption = {
  value: string;
  id?: string;
  name: string;
};

const getTodayString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const isBarberOption = (barber: unknown): barber is BarberOption => {
  return (
    typeof barber === 'object' &&
    barber !== null &&
    'id' in barber &&
    'name' in barber
  );
};

const normalizeBarberOptions = (
  barbers: Array<BarberOption | string> = [],
  ownerName?: string
): PublicBarberOption[] => {
  const byValue = new Map<string, PublicBarberOption>();

  barbers.forEach((barber) => {
    if (typeof barber === 'string') {
      const name = barber.trim();
      if (!name) return;

      byValue.set(`name:${name}`, {
        value: `name:${name}`,
        name
      });

      return;
    }

    if (isBarberOption(barber)) {
      const id = barber.id?.trim();
      const name = barber.name?.trim();

      if (!name) return;

      byValue.set(id ? `id:${id}` : `name:${name}`, {
        value: id ? `id:${id}` : `name:${name}`,
        id: id || undefined,
        name
      });
    }
  });

  const owner = ownerName?.trim();

  if (owner && byValue.size === 0) {
    byValue.set(`name:${owner}`, {
      value: `name:${owner}`,
      name: owner
    });
  }

  return Array.from(byValue.values());
};

export const PublicBookingPage: React.FC<PublicBookingPageProps> = ({
  settings,
  appointments,
  userProfile,
  onCreateAppointment
}) => {
  const barberOptions = useMemo(
    () => normalizeBarberOptions(settings.barbers || [], userProfile?.ownerName),
    [settings.barbers, userProfile?.ownerName]
  );

  const services = settings.services || [];

  const [selectedBarberValue, setSelectedBarberValue] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(getTodayString());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setSubmitting] = useState(false);
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    if (!selectedBarberValue && barberOptions[0]) {
      setSelectedBarberValue(barberOptions[0].value);
    }
  }, [barberOptions, selectedBarberValue]);

  useEffect(() => {
    if (!serviceId && services[0]) {
      setServiceId(services[0].id);
    }
  }, [services, serviceId]);

  const selectedBarber = useMemo(
    () => barberOptions.find((barber) => barber.value === selectedBarberValue) || null,
    [barberOptions, selectedBarberValue]
  );

  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId),
    [services, serviceId]
  );

  const availableSlots = useMemo(() => {
    if (!selectedBarber || !selectedService || !date) return [];

    return getAvailableTimeSlots({
      date,
      barberName: selectedBarber.name,
      serviceDurationMinutes: selectedService.durationMinutes,
      appointments
    }).filter((slot) => slot.available);
  }, [appointments, date, selectedBarber, selectedService]);

  const handleBarberChange = (value: string) => {
    setSelectedBarberValue(value);
    setSelectedSlot(null);
  };

  const handleServiceChange = (id: string) => {
    setServiceId(id);
    setSelectedSlot(null);
  };

const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();

  const input: PublicBookingInput = {
    clientName,
    clientPhone,
    barberName: selectedBarber?.name || '',
    service: selectedService,
    selectedSlot,
    notes
  };

  const validation = validatePublicBookingInput(input, appointments);

  if (!validation.valid) {
    setErrors(validation.errors);
    return;
  }

  const appointment = createPublicAppointment(input, generateId());

  if (selectedBarber) {
    appointment.barberName = selectedBarber.name;

    if (selectedBarber.id) {
      appointment.barberId = selectedBarber.id;
    }
  }

  if (selectedService) {
    appointment.serviceId = selectedService.id;
    appointment.serviceType = selectedService.name;
    appointment.serviceValue = selectedService.price;
  }

  setSubmitting(true);

  try {
    await onCreateAppointment(appointment);
    setCreatedAppointment(appointment);
    setErrors([]);
  } catch {
    setErrors(['Nao foi possivel confirmar este horario. Tente novamente.']);
  } finally {
    setSubmitting(false);
  }
};

  const handleNewBooking = () => {
    setCreatedAppointment(null);
    setSelectedSlot(null);
    setClientName('');
    setClientPhone('');
    setNotes('');
  };

  if (createdAppointment) {
    const whatsappLink = buildWhatsAppLink(createdAppointment);
    const when = new Date(createdAppointment.startAt);

    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4 font-sans">
        <div className="glass-card w-full max-w-lg rounded-2xl p-7 text-center animate-slide-in">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-green-500/10 border border-green-400/20 flex items-center justify-center text-green-300 mb-5">
            <CheckCircle size={42} />
          </div>
          <h1 className="font-display text-2xl font-bold text-white mb-2">Horario solicitado</h1>
          <p className="text-gray-400 text-sm mb-6">Seu agendamento foi enviado para a agenda da barbearia.</p>

          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-left space-y-2 mb-6">
            <p className="text-white font-bold">{createdAppointment.clientName}</p>
            <p className="text-sm text-gray-300">{createdAppointment.serviceType} · {formatCurrency(createdAppointment.serviceValue)}</p>
            <p className="text-sm text-gray-300">{createdAppointment.barberName}</p>
            <p className="text-sm text-gold-400 font-mono">
              {when.toLocaleDateString('pt-BR')} as {when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="flex flex-col xs:flex-row gap-3">
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 text-green-300 font-bold py-3 rounded-xl">
                <MessageCircle size={18} />
                WhatsApp
              </a>
            )}
            <button onClick={handleNewBooking} className="flex-1 bg-gold-500 hover:bg-gold-600 text-black font-bold py-3 rounded-xl">
              Agendar outro
            </button>
          </div>
          <a href="/" className="inline-block text-xs text-gray-500 hover:text-white mt-5">Ir para o painel interno</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <img src="/brand-mark.svg" alt="Gestao Maxima" className="w-12 h-12" />
            <div>
              <h1 className="text-white font-display font-bold text-xl">{settings.shopName || 'Gestao Maxima'}</h1>
              <p className="text-gold-400 text-[10px] uppercase tracking-widest font-bold">Agendamento online</p>
            </div>
          </div>
          <a href="/" className="hidden xs:inline-flex bg-gray-800 border border-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-bold">
            Painel
          </a>
        </header>

        <main className="grid lg:grid-cols-[0.9fr_1.1fr] gap-5">
          <section className="glass-card rounded-2xl p-6 md:p-7">
            <div className="flex items-center gap-2 text-gold-400 mb-3">
              <CalendarCheck size={22} />
              <span className="text-xs font-bold uppercase tracking-widest">Escolha seu horario</span>
            </div>
            <h2 className="font-display text-3xl font-bold text-white mb-3">Agende sem espera</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Selecione barbeiro, servico, data e um horario disponivel. A barbearia recebe sua solicitacao direto na agenda interna.
            </p>

            <div className="grid xs:grid-cols-2 gap-3">
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                <Clock className="text-blue-300 mb-2" size={20} />
                <p className="text-white font-bold text-sm">09:00 - 18:00</p>
                <p className="text-gray-500 text-xs">Expediente padrao</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                <Scissors className="text-gold-400 mb-2" size={20} />
                <p className="text-white font-bold text-sm">{services.length} servicos</p>
                <p className="text-gray-500 text-xs">Duracao por servico</p>
              </div>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 md:p-7 space-y-5">
            {barberOptions.length === 0 && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl p-3">
                A barbearia ainda precisa cadastrar pelo menos um barbeiro no painel interno.
              </div>
            )}

            {errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-xl p-3 space-y-1">
                {errors.map(error => <p key={error}>{error}</p>)}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Barbeiro</label>
                <select
  id="public-booking-barber"
  name="barberId"
  required
  value={selectedBarber?.value || ''}
  onChange={(e) => handleBarberChange(e.target.value)}
  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500"
>
  <option value="" disabled>
    Selecione um barbeiro
  </option>

  {barberOptions.map((barber) => (
    <option key={barber.value} value={barber.value}>
      {barber.name}
    </option>
  ))}
</select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Servico</label>
                <select required
                  value={selectedService?.id || ''}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500">
                  {services.map((service: Service) => (
                    <option key={service.id} value={service.id}>{service.name} · {formatCurrency(service.price)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Data</label>
              <input type="date" required min={getTodayString()} value={date} onChange={(e) => { setDate(e.target.value); setSelectedSlot(null); }} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Horarios disponiveis</label>
              {availableSlots.length === 0 ? (
                <p className="text-sm text-gray-500 bg-gray-900/50 border border-gray-700 rounded-xl p-4">Nenhum horario disponivel para esta combinacao.</p>
              ) : (
                <div className="grid grid-cols-3 xs:grid-cols-4 md:grid-cols-5 gap-2">
                  {availableSlots.map(slot => (
                    <button
                      key={slot.startAt}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                        selectedSlot?.startAt === slot.startAt
                          ? 'bg-gold-500 text-black border-gold-400'
                          : 'bg-gray-900/70 text-gray-300 border-gray-700 hover:border-gold-500/40'
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Seu nome</label>
                <input required value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">WhatsApp</label>
                <input required value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="DDD + numero" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Observacoes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-gold-500" />
            </div>

            <button type="submit" disabled={!selectedBarber || !selectedService || !selectedSlot || isSubmitting} className="w-full bg-gold-500 hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl shadow-lg shadow-gold-500/20">
              {isSubmitting ? 'Confirmando...' : 'Agendar horario'}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
};
