-- Catalog identity only. Pilot activation remains an explicit administrative act.
do $$
declare
  v_name text;
begin
  insert into public.commercial_plans (code, name)
  values ('founding_partner', 'Parceiro Fundador')
  on conflict (code) do nothing;

  -- Serialize identity verification with competing changes to this plan.
  select name into v_name
  from public.commercial_plans
  where code = 'founding_partner'
  for update;

  if v_name is distinct from 'Parceiro Fundador' then
    raise exception using errcode = 'P0001', message = 'FOUNDING_PARTNER_PLAN_CONFLICT';
  end if;
end;
$$;
