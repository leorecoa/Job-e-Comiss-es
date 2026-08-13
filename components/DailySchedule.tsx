import React from 'react';
import { CheckCircle, Clock, Edit3, MessageCircle, UserCheck, UserX, XCircle } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../types';
import { buildWhatsAppLink } from '../scheduling';
import { formatCurrency } from '../utils';
import { Badge, Button, EmptyState, Input, Label, Surface } from './ui';

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

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluido',
  cancelled: 'Cancelado',
  no_show: 'Nao veio'
};

const formatAppointmentTime = (iso: string) => (
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
);

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
    <section className="ui-schedule" aria-labelledby="daily-schedule-title">
      <Surface className="ui-schedule-toolbar">
        <div className="ui-schedule-toolbar-copy">
          <span>Operacao do dia</span>
          <h2 id="daily-schedule-title">Agenda do dia</h2>
          <p>Organize horarios futuros sem misturar com o financeiro.</p>
        </div>

        <div className="ui-schedule-controls">
          <div className="ui-field">
            <Label htmlFor="schedule-date">Data da agenda</Label>
            <Input id="schedule-date" type="date" value={selectedDate} onChange={(event) => onDateChange(event.target.value)} />
          </div>
          <div className="ui-field">
            <Label htmlFor="schedule-barber">Barbeiro</Label>
            <select id="schedule-barber" value={selectedBarber} onChange={(event) => onBarberChange(event.target.value)} className="ui-input">
              {barberOptions.map((barber) => <option key={barber} value={barber}>{barber}</option>)}
            </select>
          </div>
          <Button type="button" onClick={onNew} className="ui-schedule-primary-action">Agendar</Button>
        </div>
      </Surface>

      <div className="ui-schedule-list" aria-live="polite">
        {orderedAppointments.length === 0 ? (
          <Surface>
            <EmptyState
              title="Nenhum agendamento nesta data."
              description={selectedBarber === 'TODOS'
                ? 'Quando clientes agendarem pelo booking publico ou voce criar um agendamento manual, eles aparecerao aqui.'
                : `Quando ${selectedBarber} tiver agendamentos nesta data, eles aparecerao aqui.`}
              action={<Button type="button" className="mt-5" onClick={onNew}>Criar agendamento</Button>}
            />
          </Surface>
        ) : orderedAppointments.map((appointment) => {
          const whatsappLink = buildWhatsAppLink(appointment);
          const isDone = appointment.status === 'completed' || appointment.status === 'cancelled' || appointment.status === 'no_show';

          return (
            <article key={appointment.id} className="ui-appointment" aria-labelledby={`appointment-client-${appointment.id}`}>
              <div className="ui-appointment-time">
                <Clock size={16} aria-hidden="true" />
                <span>{formatAppointmentTime(appointment.startAt)}</span>
                <small>ate {formatAppointmentTime(appointment.endAt)}</small>
              </div>

              <div className="ui-appointment-details">
                <div className="ui-appointment-heading">
                  <h3 id={`appointment-client-${appointment.id}`} title={appointment.clientName}>{appointment.clientName}</h3>
                  <Badge className={`ui-appointment-status ui-appointment-status-${appointment.status}`}>
                    {appointmentStatusLabels[appointment.status]}
                  </Badge>
                </div>
                <p>{appointment.serviceType} <span aria-hidden="true">&middot;</span> {formatCurrency(appointment.serviceValue)}</p>
                <p className="ui-appointment-barber">Profissional: {appointment.barberName}</p>
                {appointment.notes && <p className="ui-appointment-notes">{appointment.notes}</p>}
              </div>

              <div className="ui-appointment-actions" aria-label={`Acoes do agendamento de ${appointment.clientName}`}>
                {whatsappLink && (
                  <a href={whatsappLink} target="_blank" rel="noreferrer" className="ui-appointment-action ui-appointment-action-success">
                    <MessageCircle size={15} aria-hidden="true" /> WhatsApp
                  </a>
                )}
                <Button variant="secondary" type="button" onClick={() => onEdit(appointment)}>
                  <Edit3 size={15} aria-hidden="true" /> Editar
                </Button>
                {appointment.status === 'scheduled' && (
                  <Button variant="secondary" type="button" onClick={() => onStatusChange(appointment, 'confirmed')}>
                    <UserCheck size={15} aria-hidden="true" /> Confirmar
                  </Button>
                )}
                {!isDone && (
                  <>
                    <Button type="button" onClick={() => onStatusChange(appointment, 'completed')}>
                      <CheckCircle size={15} aria-hidden="true" /> Concluir
                    </Button>
                    <Button variant="ghost" type="button" onClick={() => onStatusChange(appointment, 'no_show')}>
                      <UserX size={15} aria-hidden="true" /> Nao veio
                    </Button>
                    <Button variant="destructive" type="button" onClick={() => onCancel(appointment)}>
                      <XCircle size={15} aria-hidden="true" /> Cancelar
                    </Button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
