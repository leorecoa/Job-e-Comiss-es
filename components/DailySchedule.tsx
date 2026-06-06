import React from 'react';
import { CalendarCheck, CheckCircle, Clock, Edit3, MessageCircle, UserCheck, UserX, XCircle } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../types';
import { buildWhatsAppLink } from '../scheduling';
import { formatCurrency } from '../utils';

interface DailyScheduleProps {
  appointments: Appointment[];
  selectedDate: string;
  selectedBarber: string;
  barberOptions: string[];
  onDateChange: (date: string) => void;
  onBarberChange: (barber: string) => void;
  onNew: () => void;
  onEdit: (appointment: Appointment) => void;
  onStatusChange: (appointment: Appointment, status: AppointmentStatus) => void;
  onCancel: (appointment: Appointment) => void;
}

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluido',
  cancelled: 'Cancelado',
  no_show: 'Nao veio'
};

const statusClasses: Record<AppointmentStatus, string> = {
  scheduled: 'bg-blue-500/10 text-blue-300 border-blue-400/20',
  confirmed: 'bg-green-500/10 text-green-300 border-green-400/20',
  completed: 'bg-gold-500/10 text-gold-400 border-gold-400/20',
  cancelled: 'bg-red-500/10 text-red-300 border-red-400/20',
  no_show: 'bg-gray-500/10 text-gray-300 border-gray-400/20'
};

const formatAppointmentTime = (iso: string) => {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const DailySchedule: React.FC<DailyScheduleProps> = ({
  appointments,
  selectedDate,
  selectedBarber,
  barberOptions,
  onDateChange,
  onBarberChange,
  onNew,
  onEdit,
  onStatusChange,
  onCancel
}) => {
  const orderedAppointments = [...appointments].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="p-4 md:p-5 border-b border-gray-700 bg-gray-900/50 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div>
          <h2 className="text-white font-display font-bold text-xl flex items-center gap-2">
            <CalendarCheck size={22} className="text-gold-500" />
            Agenda do dia
          </h2>
          <p className="text-xs text-gray-400 mt-1">Organize horarios futuros sem misturar com o financeiro.</p>
        </div>

        <div className="flex flex-col xs:flex-row gap-2">
          <input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="bg-gray-900 border border-gray-700 text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-gold-500" />
          <select value={selectedBarber} onChange={(e) => onBarberChange(e.target.value)} className="bg-gray-900 border border-gray-700 text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-gold-500">
            {barberOptions.map(barber => <option key={barber} value={barber}>{barber}</option>)}
          </select>
          <button onClick={onNew} className="bg-gold-500 hover:bg-gold-600 text-black px-4 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-gold-500/20">
            Agendar
          </button>
        </div>
      </div>

      <div className="p-4 md:p-5 bg-gray-900/30 min-h-[260px]">
        {orderedAppointments.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Clock size={32} className="mx-auto mb-3 text-gray-600" />
            Nenhum horario para {selectedBarber} nesta data.
          </div>
        ) : (
          <div className="space-y-3">
            {orderedAppointments.map(appointment => {
              const whatsappLink = buildWhatsAppLink(appointment);
              const isDone = appointment.status === 'completed' || appointment.status === 'cancelled' || appointment.status === 'no_show';

              return (
                <div key={appointment.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gray-600">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="bg-gray-900 text-gray-300 text-xs font-mono px-2 py-1 rounded flex items-center gap-1 border border-gray-700">
                          <Clock size={12} />
                          {formatAppointmentTime(appointment.startAt)} - {formatAppointmentTime(appointment.endAt)}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded border ${statusClasses[appointment.status]}`}>
                          {statusLabels[appointment.status]}
                        </span>
                      </div>

                      <h3 className="text-white font-bold text-lg truncate">{appointment.clientName}</h3>
                      <p className="text-sm text-gray-300 mt-1">{appointment.serviceType} · {formatCurrency(appointment.serviceValue)}</p>
                      {appointment.notes && <p className="text-xs text-gray-500 mt-2 italic">{appointment.notes}</p>}
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {whatsappLink && (
                        <a href={whatsappLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 bg-green-500/10 text-green-300 border border-green-500/20 px-3 py-2 rounded-lg text-xs font-bold">
                          <MessageCircle size={15} />
                          WhatsApp
                        </a>
                      )}
                      <button onClick={() => onEdit(appointment)} className="flex items-center gap-1.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 px-3 py-2 rounded-lg text-xs font-bold">
                        <Edit3 size={15} />
                        Editar
                      </button>
                      {appointment.status === 'scheduled' && (
                        <button onClick={() => onStatusChange(appointment, 'confirmed')} className="flex items-center gap-1.5 bg-green-500/10 text-green-300 border border-green-500/20 px-3 py-2 rounded-lg text-xs font-bold">
                          <UserCheck size={15} />
                          Confirmar
                        </button>
                      )}
                      {!isDone && (
                        <>
                          <button onClick={() => onStatusChange(appointment, 'completed')} className="flex items-center gap-1.5 bg-gold-500/10 text-gold-400 border border-gold-500/20 px-3 py-2 rounded-lg text-xs font-bold">
                            <CheckCircle size={15} />
                            Concluir
                          </button>
                          <button onClick={() => onStatusChange(appointment, 'no_show')} className="flex items-center gap-1.5 bg-gray-500/10 text-gray-300 border border-gray-500/20 px-3 py-2 rounded-lg text-xs font-bold">
                            <UserX size={15} />
                            Nao veio
                          </button>
                          <button onClick={() => onCancel(appointment)} className="flex items-center gap-1.5 bg-red-500/10 text-red-300 border border-red-500/20 px-3 py-2 rounded-lg text-xs font-bold">
                            <XCircle size={15} />
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
