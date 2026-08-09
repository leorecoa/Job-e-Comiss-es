alter table public.appointments
  add constraint appointments_id_barbershop_id_key unique (id, barbershop_id);

create table public.financial_records (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null,
  barbershop_id uuid not null,
  barber_id uuid,
  service_id uuid,
  service_type text not null,
  service_value numeric(10,2) not null,
  commission_rate numeric(5,2) not null,
  commission_value numeric(10,2) not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint financial_records_appointment_key unique (appointment_id),
  constraint financial_records_appointment_tenant_fkey
    foreign key (appointment_id, barbershop_id)
    references public.appointments (id, barbershop_id)
    on delete restrict,
  constraint financial_records_barber_tenant_fkey
    foreign key (barber_id, barbershop_id)
    references public.barbers (id, barbershop_id)
    on delete restrict,
  constraint financial_records_service_tenant_fkey
    foreign key (service_id, barbershop_id)
    references public.services (id, barbershop_id)
    on delete restrict,
  constraint financial_records_service_value_non_negative check (service_value >= 0),
  constraint financial_records_commission_rate_valid check (commission_rate >= 0 and commission_rate <= 100),
  constraint financial_records_commission_value_non_negative check (commission_value >= 0),
  constraint financial_records_commission_value_coherent check (
    commission_value = case
      when lower(service_type) = 'produto' then 0::numeric
      else round(service_value * commission_rate / 100, 2)
    end
  )
);

create index financial_records_barbershop_completed_at_idx
  on public.financial_records (barbershop_id, completed_at desc);
create index financial_records_barbershop_barber_completed_at_idx
  on public.financial_records (barbershop_id, barber_id, completed_at desc);

alter table public.financial_records enable row level security;

create policy financial_records_owner_read_own_tenant
  on public.financial_records for select to authenticated
  using (
    private.current_user_role() = 'owner'
    and barbershop_id = private.current_user_barbershop_id()
  );

create policy financial_records_barber_read_own
  on public.financial_records for select to authenticated
  using (
    private.current_user_role() = 'barber'
    and barbershop_id = private.current_user_barbershop_id()
    and barber_id = private.current_user_barber_id()
  );

revoke all on table public.financial_records from public, anon, authenticated, service_role;
grant all on table public.financial_records to postgres, service_role;
grant select on table public.financial_records to authenticated;

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
  where p.id = auth.uid()
    and p.active = true;

  if not found or v_profile.role not in ('owner', 'barber') then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_COMPLETION_FORBIDDEN';
  end if;

  select a.*
    into v_appointment
  from public.appointments as a
  where a.id = p_appointment_id
  for update;

  if not found
    or v_appointment.barbershop_id is distinct from v_profile.barbershop_id
    or (v_profile.role = 'barber' and v_appointment.barber_id is distinct from v_profile.barber_id)
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
