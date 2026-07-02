import React, { useMemo, useState } from 'react';
import { Appointment, AppSettings } from '../types';
import { AuthSession } from '../services/authRepository';
import {
  calculateEstimatedCommission,
  formatCurrency,
  formatTime,
  generateId
} from '../utils';
import { buildWhatsAppLink, getAppointmentDateInput } from '../scheduling';
import {
  Calendar,
  Clock,
  DollarSign,
  MessageCircle,
  Plus,
  LogOut,
  TrendingUp,
  XCircle,
  CheckCircle,
  Pencil,
  Trash2,
  Scissors
} from 'lucide-react';
import { AppointmentModal } from './AppointmentModal';

type BarberDashboardProps = {
  authSession: AuthSession;
  appointments: Appointment[];
  settings: AppSettings;
  onCreateAppointment: (appointment: Appointment) => Promise<void> | void;
  onUpdateAppointment: (id: string, patch: Partial<Appointment>) => Promise<void> | void;
  onCancelAppointment: (appointment: Appointment) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onLogout: () => void;
};

export const BARBER_PROFILE_INCOMPLETE_MESSAGE = 'Seu perfil de barbeiro ainda nao esta vinculado a um profissional. Peca ao owner para revisar o vinculo da sua conta.';

const getTodayString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getCurrentMonthString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
};

export const buildBarberOwnedAppointment = ({
  appointment,
  authSession,
  currentBarberName
}: {
  appointment: Appointment;
  authSession: AuthSession;
  currentBarberName?: string | null;
}): Appointment => {
  if (authSession.role !== 'barber') {
    throw new Error(BARBER_PROFILE_INCOMPLETE_MESSAGE);
  }

  const barbershopId = authSession.barbershopId?.trim();
  const barberId = authSession.barberId?.trim();
  const barberName = currentBarberName?.trim();

  if (!barbershopId || !barberId || !barberName) {
    throw new Error(BARBER_PROFILE_INCOMPLETE_MESSAGE);
  }

  return {
    ...appointment,
    barbershopId,
    barberId,
    barberName
  };
};

export const BarberDashboard: React.FC<BarberDashboardProps> = ({
  authSession,
  appointments,
  settings,
  onCreateAppointment,
  onUpdateAppointment,
  onCancelAppointment,
  addToast,
  onLogout
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [isAppointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const barberId = authSession.barberId;
  const hasBarbershopLink = Boolean(authSession.barbershopId?.trim());

  const currentBarber = useMemo(
    () => settings.barbers?.find((item) => item.id === barberId),
    [barberId, settings.barbers]
  );

  const barberName = useMemo(() => currentBarber?.name || 'Barbeiro', [currentBarber]);

  const barberAppointments = useMemo(() => {
    if (!barberId) return [];

    return appointments.filter((appointment) => appointment.barberId === barberId);
  }, [appointments, barberId]);

  const todayAppointments = useMemo(() => (
    barberAppointments
      .filter((appointment) => getAppointmentDateInput(appointment) === selectedDate)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  ), [barberAppointments, selectedDate]);

  const upcomingAppointments = useMemo(() => {
    const now = new Date();

    return barberAppointments
      .filter((appointment) => (
        appointment.status !== 'cancelled'
        && new Date(appointment.startAt) > now
        && getAppointmentDateInput(appointment) !== selectedDate
      ))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [barberAppointments, selectedDate]);

  const dailyCommission = useMemo(() => (
    todayAppointments
      .filter((appointment) => appointment.status === 'completed')
      .reduce((sum, appointment) => sum + calculateEstimatedCommission(appointment, settings), 0)
  ), [todayAppointments, settings]);

  const monthlyCommission = useMemo(() => {
    const currentMonth = getCurrentMonthString();

    return barberAppointments
      .filter((appointment) => (
        appointment.status === 'completed'
        && getAppointmentDateInput(appointment).startsWith(currentMonth)
      ))
      .reduce((sum, appointment) => sum + calculateEstimatedCommission(appointment, settings), 0);
  }, [barberAppointments, settings]);

  const barberScopedSettings = useMemo(() => ({
    ...settings,
    barbers: currentBarber ? [currentBarber] : []
  }), [currentBarber, settings]);

  const handleOpenNewAppointment = () => {
    setEditingAppointment(null);
    setAppointmentModalOpen(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setAppointmentModalOpen(true);
  };

  const handleSaveAppointment = async (appointment: Appointment) => {
    let appointmentForBarber: Appointment;

    try {
      appointmentForBarber = buildBarberOwnedAppointment({
        appointment,
        authSession,
        currentBarberName: barberName
      });
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : BARBER_PROFILE_INCOMPLETE_MESSAGE,
        'error'
      );
      return;
    }

    if (editingAppointment) {
      await onUpdateAppointment(editingAppointment.id, {
        ...appointmentForBarber,
        updatedAt: new Date().toISOString()
      });

      addToast('Agendamento atualizado!', 'success');
    } else {
      await onCreateAppointment(appointmentForBarber);
      addToast('Agendamento criado!', 'success');
    }

    setAppointmentModalOpen(false);
    setEditingAppointment(null);
  };

  const handleMarkAsCompleted = async (appointment: Appointment) => {
    await onUpdateAppointment(appointment.id, {
      status: 'completed',
      updatedAt: new Date().toISOString()
    });

    addToast('Agendamento marcado como concluido!', 'success');
  };

  const changeDate = (days: number) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const d = new Date(year, month - 1, day);

    d.setDate(d.getDate() + days);

    const newYear = d.getFullYear();
    const newMonth = String(d.getMonth() + 1).padStart(2, '0');
    const newDay = String(d.getDate()).padStart(2, '0');

    setSelectedDate(`${newYear}-${newMonth}-${newDay}`);
  };

  if (!barberId || !hasBarbershopLink || !currentBarber) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4 font-sans">
        <div className="glass-card w-full max-w-lg rounded-2xl p-7 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10 text-amber-200">
            <Scissors size={28} />
          </div>
          <h1 className="text-white font-display text-2xl font-bold mb-3">
            Vinculo pendente
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Sua conta existe, mas ainda nao esta vinculada a um profissional ativo desta barbearia.
          </p>
          <p className="mt-3 text-sm text-gray-300 leading-relaxed">
            Envie ao owner o e-mail usado neste login. Ele deve selecionar o profissional correspondente no painel e vincular a sua conta.
          </p>
          <p className="mt-3 rounded-2xl border border-gray-700 bg-gray-900/60 p-3 text-xs leading-relaxed text-gray-400">
            Se o owner acabou de concluir o vinculo, saia e entre novamente para atualizar a sessao.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-24 font-sans selection:bg-gold-500/30">
      <header className="border-b border-gray-800 sticky top-0 z-40 backdrop-blur-md bg-gray-900/90">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img src="/brand-mark.svg" alt="Marca da barbearia" className="w-12 h-12 shrink-0" />

            <div className="min-w-0">
              <h1 className="text-white font-bold truncate">{barberName}</h1>
              <span className="text-[10px] uppercase font-bold text-blue-400">
                Barbeiro
              </span>
              <p className="mt-0.5 text-[11px] text-gray-400">
                Conta vinculada ao profissional {barberName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 relative z-20">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={handleOpenNewAppointment}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-black px-4 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-gold-500/20 active:scale-95"
            >
              <Plus size={18} />
              Novo Agendamento
            </button>
          </div>

          <div className="flex items-center bg-gray-900 rounded-xl border border-gray-700 p-0.5 flex-1 justify-between md:flex-none min-w-[140px]">
            <button
              type="button"
              onClick={() => changeDate(-1)}
              className="p-2 text-gray-400 hover:text-white"
            >
              <XCircle size={20} />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-white text-sm text-center w-full md:w-32 focus:ring-0"
            />

            <button
              type="button"
              onClick={() => changeDate(1)}
              className="p-2 text-gray-400 hover:text-white"
            >
              <CheckCircle size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="glass-card p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Comissao do Dia</p>
              <p className="text-2xl font-bold text-gold-500">
                {formatCurrency(dailyCommission)}
              </p>
            </div>

            <DollarSign size={32} className="text-gold-500" />
          </div>

          <div className="glass-card p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Comissao do Mes</p>
              <p className="text-2xl font-bold text-blue-400">
                {formatCurrency(monthlyCommission)}
              </p>
            </div>

            <TrendingUp size={32} className="text-blue-400" />
          </div>
        </div>

        <section className="glass-card p-6 rounded-2xl mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Calendar size={20} />
            Agendamentos de Hoje
          </h2>

          {todayAppointments.length === 0 ? (
            <div className="rounded-2xl border border-gray-700 bg-gray-900/50 p-5 text-sm text-gray-400">
              <p className="font-bold text-white">Nenhum agendamento para hoje.</p>
              <p className="mt-1">Quando clientes reservarem pelo booking publico ou voce criar um agendamento manual, eles aparecerao nesta lista.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {todayAppointments.map((appointment) => {
                const whatsappLink = buildWhatsAppLink(appointment);

                return (
                  <div
                    key={appointment.id}
                    className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                  >
                    <div>
                      <p className="text-white font-bold">{appointment.clientName}</p>
                      <p className="text-sm text-gray-300">
                        {appointment.serviceType} · {formatCurrency(appointment.serviceValue)}
                      </p>
                      <p className="text-xs text-gold-400 font-mono">
                        {formatTime(new Date(appointment.startAt).getTime())}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {appointment.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsCompleted(appointment)}
                          className="p-2 rounded-full bg-green-500/10 text-green-400 hover:bg-green-500/20"
                          title="Marcar como Concluido"
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}

                      {whatsappLink && (
                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                          title="Chamar no WhatsApp"
                        >
                          <MessageCircle size={18} />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleEditAppointment(appointment)}
                        className="p-2 rounded-full bg-gray-700/50 text-gray-300 hover:bg-gray-700"
                        title="Editar Agendamento"
                      >
                        <Pencil size={18} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onCancelAppointment(appointment)}
                        className="p-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        title="Cancelar Agendamento"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass-card p-6 rounded-2xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Clock size={20} />
            Proximos Agendamentos
          </h2>

          {upcomingAppointments.length === 0 ? (
            <div className="rounded-2xl border border-gray-700 bg-gray-900/50 p-5 text-sm text-gray-400">
              <p className="font-bold text-white">Nenhum agendamento futuro.</p>
              <p className="mt-1">Proximas reservas feitas pelos clientes ou criadas manualmente aparecerao aqui.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingAppointments.map((appointment) => {
                const whatsappLink = buildWhatsAppLink(appointment);

                return (
                  <div
                    key={appointment.id}
                    className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                  >
                    <div>
                      <p className="text-white font-bold">{appointment.clientName}</p>
                      <p className="text-sm text-gray-300">
                        {appointment.serviceType} · {formatCurrency(appointment.serviceValue)}
                      </p>
                      <p className="text-xs text-gold-400 font-mono">
                        {new Date(appointment.startAt).toLocaleDateString('pt-BR')} as{' '}
                        {formatTime(new Date(appointment.startAt).getTime())}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {whatsappLink && (
                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                          title="Chamar no WhatsApp"
                        >
                          <MessageCircle size={18} />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleEditAppointment(appointment)}
                        className="p-2 rounded-full bg-gray-700/50 text-gray-300 hover:bg-gray-700"
                        title="Editar Agendamento"
                      >
                        <Pencil size={18} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onCancelAppointment(appointment)}
                        className="p-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        title="Cancelar Agendamento"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => {
          setAppointmentModalOpen(false);
          setEditingAppointment(null);
        }}
        onSave={handleSaveAppointment}
        settings={barberScopedSettings}
        selectedDate={selectedDate}
        selectedBarber={barberName}
        initialData={editingAppointment}
        createId={generateId}
      />
    </div>
  );
};
