drop policy if exists appointments_barber_update_own on public.appointments;

drop policy if exists appointments_barber_insert_own on public.appointments;
create policy appointments_barber_insert_own
  on public.appointments for insert to authenticated
  with check (
    status = 'scheduled'
    and financial_record_id is null
    and exists (
      select 1
      from public.profiles as p
      join public.barbers as b
        on b.id = p.barber_id
       and b.barbershop_id = p.barbershop_id
      join public.services as s
        on s.id = appointments.service_id
       and s.barbershop_id = p.barbershop_id
      where p.id = auth.uid()
        and p.role = 'barber'
        and p.active is true
        and p.barbershop_id = appointments.barbershop_id
        and p.barber_id = appointments.barber_id
        and b.active is true
        and s.active is true
    )
  );

create or replace function public.complete_appointment_with_financial_record(p_appointment_id uuid)
returns table (appointment_id uuid, financial_record_id uuid)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_profile public.profiles%rowtype;
  v_appointment public.appointments%rowtype;
  v_financial_record_id uuid;
  v_commission_rate numeric(5,2);
  v_commission_value numeric(10,2);
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_COMPLETION_UNAUTHENTICATED';
  end if;

  select p.*
    into v_profile
  from public.profiles as p
  where p.id = auth.uid();

  if not found
    or v_profile.role is distinct from 'owner'
    or v_profile.active is distinct from true
    or v_profile.barbershop_id is null
  then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_COMPLETION_FORBIDDEN';
  end if;

  select a.*
    into v_appointment
  from public.appointments as a
  where a.id = p_appointment_id
  for update;

  if not found
    or v_appointment.barbershop_id is distinct from v_profile.barbershop_id
  then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_COMPLETION_APPOINTMENT_NOT_FOUND';
  end if;

  if v_appointment.status in ('cancelled', 'no_show') then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_COMPLETION_INVALID_STATUS';
  end if;

  select fr.id
    into v_financial_record_id
  from public.financial_records as fr
  where fr.appointment_id = v_appointment.id;

  if v_financial_record_id is not null then
    if v_appointment.status <> 'completed'
      or v_appointment.financial_record_id is distinct from v_financial_record_id::text
    then
      update public.appointments as a
      set status = 'completed', financial_record_id = v_financial_record_id::text
      where a.id = v_appointment.id;
    end if;

    return query select v_appointment.id, v_financial_record_id;
    return;
  end if;

  if v_appointment.status not in ('scheduled', 'confirmed', 'completed') then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_COMPLETION_INVALID_STATUS';
  end if;

  v_commission_rate := coalesce(
    v_appointment.commission_rate,
    (select s.commission_rate from public.services as s where s.id = v_appointment.service_id),
    0
  );
  v_commission_value := case
    when lower(v_appointment.service_type) = 'produto' then 0
    else round(v_appointment.service_value * v_commission_rate / 100, 2)
  end;

  insert into public.financial_records (
    appointment_id, barbershop_id, barber_id, service_id, service_type,
    service_value, commission_rate, commission_value, completed_at
  ) values (
    v_appointment.id, v_appointment.barbershop_id, v_appointment.barber_id,
    v_appointment.service_id, v_appointment.service_type, v_appointment.service_value,
    v_commission_rate, v_commission_value, now()
  )
  returning id into v_financial_record_id;

  update public.appointments as a
  set status = 'completed', financial_record_id = v_financial_record_id::text
  where a.id = v_appointment.id;

  return query select v_appointment.id, v_financial_record_id;
end;
$$;

revoke all on function public.complete_appointment_with_financial_record(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_appointment_with_financial_record(uuid)
  to authenticated;
