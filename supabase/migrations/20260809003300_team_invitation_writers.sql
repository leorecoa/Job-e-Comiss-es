-- Review-only remote rollout. Existing linking remains a temporary compatibility bridge.
-- Never log request/response bodies for these RPCs: the token is a bearer secret.
create function public.issue_team_invitation(p_barber_id uuid, p_recipient_email text)
returns table(invitation_id uuid, token text, expires_at timestamptz)
language plpgsql volatile security definer set search_path = pg_catalog
as $$
declare
  v_owner public.profiles%rowtype;
  v_email text;
  v_token text;
  v_id uuid;
  v_now timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select p.* into v_owner from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'owner' for update;
  if not found or v_owner.barbershop_id is null then
    raise exception 'TEAM_INVITATION_FORBIDDEN';
  end if;
  v_email := pg_catalog.lower(pg_catalog.btrim(p_recipient_email));
  if p_barber_id is null or v_email is null
    or pg_catalog.char_length(v_email) not between 3 and 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'TEAM_INVITATION_INPUT_INVALID';
  end if;
  perform 1 from public.barbers b where b.id = p_barber_id
    and b.barbershop_id = v_owner.barbershop_id and b.active for update;
  if not found then raise exception 'TEAM_INVITATION_UNAVAILABLE'; end if;
  if exists (select 1 from public.profiles p where p.barber_id = p_barber_id) then
    raise exception 'TEAM_INVITATION_UNAVAILABLE';
  end if;
  v_now := pg_catalog.clock_timestamp();
  update public.team_invitations i set revoked_at = v_now
    where i.barber_id = p_barber_id and i.barbershop_id = v_owner.barbershop_id
      and i.accepted_at is null and i.revoked_at is null;
  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.team_invitations
    (barbershop_id, barber_id, recipient_email, token_hash, created_by, created_at, expires_at)
  values (v_owner.barbershop_id, p_barber_id, v_email,
    extensions.digest(v_token, 'sha256'), v_owner.id, v_now, v_now + interval '48 hours')
  returning id into v_id;
  return query select v_id, v_token, v_now + interval '48 hours';
exception when integrity_constraint_violation then
  raise exception 'TEAM_INVITATION_UNAVAILABLE';
end;
$$;

create function public.accept_team_invitation(p_token text)
returns void
language plpgsql volatile security definer set search_path = pg_catalog
as $$
declare
  v_initial public.team_invitations%rowtype;
  v_invite public.team_invitations%rowtype;
  v_profile public.profiles%rowtype;
  v_email text;
  v_confirmed timestamptz;
  v_now timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_token is null or pg_catalog.length(p_token) <> 64 or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'TEAM_INVITATION_UNAVAILABLE';
  end if;
  -- Reject owners before locking a barber: owner writers lock their profile first.
  perform 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'barber';
  if not found then raise exception 'TEAM_INVITATION_UNAVAILABLE'; end if;
  select i.* into v_initial from public.team_invitations i
    where i.token_hash = extensions.digest(p_token, 'sha256');
  if not found then raise exception 'TEAM_INVITATION_UNAVAILABLE'; end if;
  -- Discover the lock key only. All decisions are repeated after acquiring locks.
  perform 1 from public.barbers b where b.id = v_initial.barber_id
    and b.barbershop_id = v_initial.barbershop_id and b.active for update;
  if not found then raise exception 'TEAM_INVITATION_UNAVAILABLE'; end if;
  -- Same order as the compatibility bridge: barber -> Auth user -> profile.
  select pg_catalog.lower(pg_catalog.btrim(u.email)), u.email_confirmed_at
    into v_email, v_confirmed from auth.users u where u.id = auth.uid() for update;
  if not found then raise exception 'TEAM_INVITATION_UNAVAILABLE'; end if;
  select p.* into v_profile from public.profiles p where p.id = auth.uid() for update;
  if not found then raise exception 'TEAM_INVITATION_UNAVAILABLE'; end if;
  select i.* into v_invite from public.team_invitations i
    where i.id = v_initial.id and i.barber_id = v_initial.barber_id
      and i.barbershop_id = v_initial.barbershop_id
      and i.token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found then raise exception 'TEAM_INVITATION_UNAVAILABLE'; end if;
  v_now := pg_catalog.clock_timestamp();
  if v_invite.accepted_at is not null or v_invite.revoked_at is not null
    or v_invite.expires_at <= v_now or v_invite.created_at > v_now
    or v_confirmed is null or v_email is distinct from v_invite.recipient_email
    or v_profile.active is distinct from true or v_profile.role is distinct from 'barber'
    or ((v_profile.barbershop_id is null and v_profile.barber_id is null)
      or (v_profile.barbershop_id = v_invite.barbershop_id and v_profile.barber_id = v_invite.barber_id)) is distinct from true then
    raise exception 'TEAM_INVITATION_UNAVAILABLE';
  end if;
  if exists (select 1 from public.profiles p
    where p.barber_id = v_invite.barber_id and p.id <> auth.uid()) then
    raise exception 'TEAM_INVITATION_UNAVAILABLE';
  end if;
  update public.profiles set barbershop_id = v_invite.barbershop_id,
    barber_id = v_invite.barber_id, role = 'barber', updated_at = v_now where id = auth.uid();
  update public.team_invitations set accepted_at = v_now, accepted_by = auth.uid()
    where id = v_invite.id;
exception when integrity_constraint_violation then
  raise exception 'TEAM_INVITATION_UNAVAILABLE';
end;
$$;

create function public.revoke_team_invitation(p_invitation_id uuid)
returns void
language plpgsql volatile security definer set search_path = pg_catalog
as $$
declare
  v_owner public.profiles%rowtype;
  v_initial public.team_invitations%rowtype;
  v_invite public.team_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select p.* into v_owner from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'owner' for update;
  if not found or v_owner.barbershop_id is null then
    raise exception 'TEAM_INVITATION_FORBIDDEN';
  end if;
  select i.* into v_initial from public.team_invitations i
    where i.id = p_invitation_id and i.barbershop_id = v_owner.barbershop_id;
  if not found then raise exception 'TEAM_INVITATION_UNAVAILABLE'; end if;
  perform 1 from public.barbers b where b.id = v_initial.barber_id
    and b.barbershop_id = v_owner.barbershop_id for update;
  if not found then raise exception 'TEAM_INVITATION_UNAVAILABLE'; end if;
  select i.* into v_invite from public.team_invitations i
    where i.id = p_invitation_id and i.barbershop_id = v_owner.barbershop_id
      and i.barber_id = v_initial.barber_id for update;
  if not found or v_invite.accepted_at is not null then
    raise exception 'TEAM_INVITATION_UNAVAILABLE';
  end if;
  if v_invite.revoked_at is null then
    update public.team_invitations set revoked_at = pg_catalog.clock_timestamp()
      where id = v_invite.id;
  end if;
exception when integrity_constraint_violation then
  raise exception 'TEAM_INVITATION_UNAVAILABLE';
end;
$$;

revoke all on function public.issue_team_invitation(uuid, text),
  public.accept_team_invitation(text), public.revoke_team_invitation(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.issue_team_invitation(uuid, text),
  public.accept_team_invitation(text), public.revoke_team_invitation(uuid) to authenticated;
