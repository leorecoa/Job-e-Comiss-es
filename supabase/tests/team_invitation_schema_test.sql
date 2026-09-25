-- Synthetic fixtures only; no issuance/acceptance API is implemented here.
begin;
create extension if not exists pgtap with schema extensions;
select plan(67);
create function pg_temp.invite_id(n integer) returns uuid language sql immutable as $$
  select ('eeee0032-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
insert into public.barbershops(id,name,slug) values
(pg_temp.invite_id(1),'Invitation A','invitation-schema-a'),
(pg_temp.invite_id(2),'Invitation B','invitation-schema-b');
insert into public.barbers(id,name,barbershop_id) values
(pg_temp.invite_id(3),'Target A',pg_temp.invite_id(1)),
(pg_temp.invite_id(4),'Target B',pg_temp.invite_id(2));
insert into auth.users(id,aud,role,email,raw_user_meta_data)
select pg_temp.invite_id(n),'authenticated','authenticated','invitation-'||n||'@example.test',
 jsonb_build_object('role',case when n in (101,104) then 'owner' else 'barber' end)
from generate_series(101,104) n;
update public.profiles set barbershop_id=pg_temp.invite_id(1) where id=pg_temp.invite_id(101);
update public.profiles set barbershop_id=pg_temp.invite_id(2) where id=pg_temp.invite_id(104);

-- Privileged data factory to exercise only declarative constraints.
create function pg_temp.insert_invitation(
  p_hash bytea default decode(repeat('b',64),'hex'),
  p_tenant uuid default pg_temp.invite_id(1),
  p_barber uuid default pg_temp.invite_id(3),
  p_email text default 'recipient@example.test',
  p_creator uuid default pg_temp.invite_id(101),
  p_created timestamptz default '2030-01-01T00:00Z',
  p_expires timestamptz default '2030-01-03T00:00Z',
  p_accepted timestamptz default null,
  p_acceptor uuid default null,
  p_revoked timestamptz default null
) returns uuid language sql security invoker as $$
  insert into public.team_invitations(
    barbershop_id,barber_id,recipient_email,token_hash,created_by,
    created_at,expires_at,accepted_at,accepted_by,revoked_at
  ) values (
    p_tenant,p_barber,p_email,p_hash,p_creator,p_created,p_expires,
    p_accepted,p_acceptor,p_revoked
  ) returning id
$$;

select has_table('public','team_invitations','invitation table exists');
select ok((select relrowsecurity from pg_class where oid='public.team_invitations'::regclass),'RLS enabled');
select is((select count(*) from pg_policies where schemaname='public' and tablename='team_invitations'),0::bigint,'no permissive invitation policies');
select ok(not exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid='public.team_invitations'::regclass and a.grantee=0),'PUBLIC has no table privileges');
select ok(not exists(select 1 from pg_attribute a cross join lateral aclexplode(a.attacl) x where a.attrelid='public.team_invitations'::regclass and x.grantee=0),'PUBLIC has no column privileges');
select is((select data_type from information_schema.columns where table_schema='public' and table_name='team_invitations' and column_name='token_hash'),'bytea','hash stored as binary digest');
select ok(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='team_invitations' and column_name in ('token','raw_token','role')),'no raw token or client-selected role column');
select lives_ok($$select pg_temp.insert_invitation(p_hash=>decode(repeat('a',64),'hex'))$$,'valid pending fixture');
select is((select expires_at-created_at from public.team_invitations),interval '48 hours','expiration is exactly 48 elapsed hours');

select ok(not has_table_privilege('anon','public.team_invitations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'anon has no effective table access');
select ok(not has_any_column_privilege('anon','public.team_invitations','SELECT,INSERT,UPDATE,REFERENCES'),'anon has no effective column access');
set local role anon;
select throws_ok($$select token_hash from public.team_invitations$$,'42501',null,'anon cannot read token hash');
select throws_ok($$insert into public.team_invitations default values$$,'42501',null,'anon cannot insert');
select throws_ok($$update public.team_invitations set recipient_email='changed@example.test'$$,'42501',null,'anon cannot update');
select throws_ok($$delete from public.team_invitations$$,'42501',null,'anon cannot delete');
reset role;
select ok(not has_table_privilege('authenticated','public.team_invitations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'authenticated has no effective table access');
select ok(not has_any_column_privilege('authenticated','public.team_invitations','SELECT,INSERT,UPDATE,REFERENCES'),'authenticated has no effective column access');
set local role authenticated;
select throws_ok($$select token_hash from public.team_invitations$$,'42501',null,'authenticated cannot read token hash');
select throws_ok($$insert into public.team_invitations default values$$,'42501',null,'authenticated cannot insert');
select throws_ok($$update public.team_invitations set recipient_email='changed@example.test'$$,'42501',null,'authenticated cannot update');
select throws_ok($$delete from public.team_invitations$$,'42501',null,'authenticated cannot delete');
reset role;
select ok(not has_table_privilege('service_role','public.team_invitations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'service_role has no effective table access');
select ok(not has_any_column_privilege('service_role','public.team_invitations','SELECT,INSERT,UPDATE,REFERENCES'),'service_role has no effective column access');
set local role service_role;
select throws_ok($$select token_hash from public.team_invitations$$,'42501',null,'service_role cannot read token hash');
select throws_ok($$insert into public.team_invitations default values$$,'42501',null,'service_role cannot insert');
select throws_ok($$update public.team_invitations set recipient_email='changed@example.test'$$,'42501',null,'service_role cannot update');
select throws_ok($$delete from public.team_invitations$$,'42501',null,'service_role cannot delete');
reset role;
select throws_ok($$select pg_temp.insert_invitation(p_tenant=>pg_temp.invite_id(999))$$,'23503',null,'tenant must exist');
select throws_ok($$select pg_temp.insert_invitation(p_barber=>pg_temp.invite_id(4))$$,'23503',null,'cross-tenant barber rejected');
select throws_ok($$select pg_temp.insert_invitation(p_barber=>pg_temp.invite_id(999))$$,'23503',null,'barber must exist');
select throws_ok($$select pg_temp.insert_invitation(p_creator=>pg_temp.invite_id(999))$$,'23503',null,'creator must have a profile backed by Auth');
select throws_ok($$select pg_temp.insert_invitation(p_accepted=>'2030-01-02T00:00Z',p_acceptor=>pg_temp.invite_id(999))$$,'23503',null,'acceptor must have a profile backed by Auth');
select throws_ok($$select pg_temp.insert_invitation(p_hash=>decode(repeat('a',64),'hex'))$$,'23505',null,'duplicate hash rejected');
select throws_ok($$select pg_temp.insert_invitation(p_hash=>decode('abcd','hex'))$$,'23514',null,'non SHA-256 digest length rejected');
select throws_ok($$select pg_temp.insert_invitation(p_hash=>null)$$,'23502',null,'hash required');
select throws_ok($$select pg_temp.insert_invitation(p_email=>' Recipient@Example.test ')$$,'23514',null,'email must already be normalized');
select throws_ok($$select pg_temp.insert_invitation(p_email=>'not-an-email')$$,'23514',null,'invalid email rejected');
select throws_ok($$select pg_temp.insert_invitation(p_email=>'')$$,'23514',null,'empty email rejected');
select throws_ok($$select pg_temp.insert_invitation(p_email=>null)$$,'23502',null,'recipient required');
select throws_ok($$select pg_temp.insert_invitation(p_expires=>'2030-01-01T00:00Z')$$,'23514',null,'nonpositive expiry rejected');
select throws_ok($$select pg_temp.insert_invitation(p_expires=>'2030-01-04T00:00Z')$$,'23514',null,'expiry beyond 48 hours rejected');
select throws_ok($$select pg_temp.insert_invitation(p_expires=>'2030-01-02T00:00Z')$$,'23514',null,'expiry shorter than contractual 48 hours rejected');
select throws_ok($$select pg_temp.insert_invitation(p_expires=>'infinity')$$,'23514',null,'infinite expiry rejected');
select throws_ok($$select pg_temp.insert_invitation(p_created=>'-infinity')$$,'23514',null,'infinite creation rejected');
select throws_ok($$select pg_temp.insert_invitation(p_accepted=>'2030-01-02T00:00Z')$$,'23514',null,'accepted timestamp needs acceptor');
select throws_ok($$select pg_temp.insert_invitation(p_acceptor=>pg_temp.invite_id(102))$$,'23514',null,'acceptor needs accepted timestamp');
select throws_ok($$select pg_temp.insert_invitation(p_accepted=>'2029-12-31T00:00Z',p_acceptor=>pg_temp.invite_id(102))$$,'23514',null,'acceptance cannot precede creation');
select throws_ok($$select pg_temp.insert_invitation(p_accepted=>'2030-01-03T00:00Z',p_acceptor=>pg_temp.invite_id(102))$$,'23514',null,'acceptance at expiry rejected');
select throws_ok($$select pg_temp.insert_invitation(p_revoked=>'2029-12-31T00:00Z')$$,'23514',null,'revocation cannot precede creation');
select throws_ok($$select pg_temp.insert_invitation(p_revoked=>'infinity')$$,'23514',null,'infinite revocation rejected');
select throws_ok($$select pg_temp.insert_invitation(p_accepted=>'2030-01-02T00:00Z',p_acceptor=>pg_temp.invite_id(102),p_revoked=>'2030-01-02T01:00Z')$$,'23514',null,'accepted and revoked are mutually exclusive');

select lives_ok($$select pg_temp.insert_invitation(p_accepted=>'2030-01-02T00:00Z',p_acceptor=>pg_temp.invite_id(102))$$,'accepted fixture has coherent terminal state');
select throws_ok($$select pg_temp.insert_invitation()$$,'23505',null,'consumed token hash cannot be inserted as another invitation');
select lives_ok($$select pg_temp.insert_invitation(p_hash=>decode(repeat('c',64),'hex'),p_revoked=>'2030-01-02T00:00Z')$$,'revoked fixture has coherent terminal state');
select lives_ok($$insert into public.team_invitations(barbershop_id,barber_id,recipient_email,token_hash,created_by)
values(pg_temp.invite_id(1),pg_temp.invite_id(3),'recipient@example.test',decode(repeat('d',64),'hex'),pg_temp.invite_id(101))$$,'default creation and expiry valid');
select ok((select created_at=now() and expires_at=created_at+interval '48 hours' from public.team_invitations where token_hash=decode(repeat('d',64),'hex')),'default expiry is 48 hours');

select is((select count(*) from public.profiles where id in (pg_temp.invite_id(102),pg_temp.invite_id(103)) and barber_id is null and barbershop_id is null),2::bigint,'multiple pending barber profiles with NULL remain valid');
select throws_ok($$update public.profiles set barber_id=pg_temp.invite_id(3) where id=pg_temp.invite_id(101)$$,'23514',null,'owner cannot have barber link');
select throws_ok($$update public.profiles set barbershop_id=pg_temp.invite_id(1),barber_id=pg_temp.invite_id(4) where id=pg_temp.invite_id(102)$$,'23503',null,'profile cross-tenant link still denied');

-- Temporary compatibility bridge: cutover must revoke it once invites work.
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.invite_id(101)::text,true);
select lives_ok($$select * from public.link_barber_profile_by_email('invitation-102@example.test',pg_temp.invite_id(3))$$,'legacy owner link still works temporarily');
select lives_ok($$select * from public.link_barber_profile_by_email('invitation-102@example.test',pg_temp.invite_id(3))$$,'legacy same-user relink stays idempotent');
select throws_ok($$select * from public.link_barber_profile_by_email('invitation-103@example.test',pg_temp.invite_id(3))$$,'23505',null,'legacy bridge cannot assign a second profile');
reset role;
select is((select count(*) from public.profiles where barber_id=pg_temp.invite_id(3)),1::bigint,'exactly one profile represents target');
select ok((select barber_id is null and barbershop_id is null from public.profiles where id=pg_temp.invite_id(103)),'failed relink leaves pending profile unchanged');
update public.profiles set active=false where id=pg_temp.invite_id(103);
select throws_ok($$update public.profiles set barbershop_id=pg_temp.invite_id(1),barber_id=pg_temp.invite_id(3) where id=pg_temp.invite_id(103)$$,'23505',null,'inactive profile cannot duplicate active link');
update public.profiles set active=false where id=pg_temp.invite_id(102);
select throws_ok($$update public.profiles set barbershop_id=pg_temp.invite_id(1),barber_id=pg_temp.invite_id(3) where id=pg_temp.invite_id(103)$$,'23505',null,'inactive link still occupies barber identity');

select is((select md5(string_agg(row_to_json(x)::text,',' order by x.name)) from (
 select c.relname as name,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity,
 (select json_agg(p order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname)::text as policies
 from pg_class c where c.oid in ('public.appointments'::regclass,'public.financial_records'::regclass)
 union all select 'legacy_link',p.proacl::text,p.prosecdef,false,pg_get_functiondef(p.oid)
 from pg_proc p where p.oid='public.link_barber_profile_by_email(text,uuid)'::regprocedure
) x),'8ba6dd0a25566ed0d2cdc009f6381ecb','appointments/financial ACLs and policies and legacy RPC definition/ACL unchanged from 031');
select * from finish();
rollback;
