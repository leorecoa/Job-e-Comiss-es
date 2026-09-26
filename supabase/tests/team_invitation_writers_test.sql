begin;
select no_plan();
create function pg_temp.i(n integer) returns uuid language sql immutable as $$
  select ('eeee0033-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
insert into public.barbershops(id,name,slug) values
  (pg_temp.i(1),'Writers A','writers-033-a'),(pg_temp.i(2),'Writers B','writers-033-b');
insert into public.barbers(id,name,barbershop_id,active)
  select pg_temp.i(n),'Writer fixture '||n,pg_temp.i(case when n=20 then 2 else 1 end),n<>19
  from generate_series(10,20) n;
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data)
  select pg_temp.i(n),'authenticated','authenticated','writer-'||n||'@example.test',
    case when n=105 then null else now() end,
    jsonb_build_object('role',case when n in (101,102,103) then 'owner' else 'barber' end)
  from generate_series(101,110) n;
update public.profiles set barbershop_id=pg_temp.i(case when id=pg_temp.i(102) then 2 else 1 end)
  where id in (pg_temp.i(101),pg_temp.i(102),pg_temp.i(103));
update public.profiles set active=false where id in (pg_temp.i(103),pg_temp.i(106));
update public.profiles set barbershop_id=pg_temp.i(2),barber_id=pg_temp.i(20) where id=pg_temp.i(107);

-- Execute actual RPCs as authenticated; catch errors only to assert their public contract.
create function pg_temp.call_as(n integer, q text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.i(n),'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  execute q into r;
  reset role;
  return jsonb_build_object('ok',true,'result',r);
exception when others then
  return jsonb_build_object('error',SQLERRM,'code',SQLSTATE);
end;
$$;
create function pg_temp.issue(n integer,b integer,email text) returns jsonb language sql as $$
  select pg_temp.call_as(n,format('select to_jsonb(x) from public.issue_team_invitation(%L,%L) x',pg_temp.i(b),email))
$$;
create function pg_temp.accept(n integer,token text) returns jsonb language sql as $$
  select pg_temp.call_as(n,format('select to_jsonb(public.accept_team_invitation(%L))',token))
$$;
create function pg_temp.revoke(n integer,id uuid) returns jsonb language sql as $$
  select pg_temp.call_as(n,format('select to_jsonb(public.revoke_team_invitation(%L))',id))
$$;
create temp table issued(label text primary key,result jsonb);
insert into issued values ('first',pg_temp.issue(101,10,'  WRITER-104@EXAMPLE.TEST  '));
select is((select result->>'ok' from issued where label='first'),'true','owner issues');
select is((select recipient_email from public.team_invitations where barber_id=pg_temp.i(10)),
  'writer-104@example.test','email normalized');
select ok((select (result#>>'{result,token}') ~ '^[0-9a-f]{64}$' from issued where label='first'),'token has 256-bit hex format');
select ok((select expires_at-created_at=interval '48 hours' and created_by=pg_temp.i(101)
  and accepted_at is null and revoked_at is null from public.team_invitations where barber_id=pg_temp.i(10)), 'server lifetime and creator');
select ok((select octet_length(token_hash)=32 and token_hash=extensions.digest(
  (select result#>>'{result,token}' from issued where label='first'),'sha256')
  from public.team_invitations where barber_id=pg_temp.i(10)),'only matching digest persisted');
select ok(not exists(select 1 from public.team_invitations i,issued x
  where to_jsonb(i)::text like '%'||(x.result#>>'{result,token}')||'%'),'raw token absent from persisted row');
select is(pg_temp.issue(104,11,'nobody@example.test')->>'error','TEAM_INVITATION_FORBIDDEN','barber cannot issue');
select is(pg_temp.issue(103,11,'nobody@example.test')->>'error','TEAM_INVITATION_FORBIDDEN','inactive owner cannot issue');
select is(pg_temp.issue(101,20,'nobody@example.test')->>'error','TEAM_INVITATION_UNAVAILABLE','foreign barber denied');
select is(pg_temp.issue(101,19,'nobody@example.test')->>'error','TEAM_INVITATION_UNAVAILABLE','inactive barber denied');
select is(pg_temp.issue(101,11,'bad')->>'error','TEAM_INVITATION_INPUT_INVALID','invalid email denied');
insert into issued values ('unknown-account',pg_temp.issue(101,11,'unregistered@example.test'));
select is((select result->>'ok' from issued where label='unknown-account'),'true','no account required or enumerated');
insert into issued values ('second',pg_temp.issue(101,10,'writer-104@example.test'));
select ok((select revoked_at is not null from public.team_invitations where id=
  (select (result#>>'{result,invitation_id}')::uuid from issued where label='first')),'reissue revokes prior');
select is((select count(distinct result#>>'{result,token}') from issued),3::bigint,'unique random tokens');
select is((select count(distinct token_hash) from public.team_invitations where barbershop_id=pg_temp.i(1)),3::bigint,'unique hashes');
select is(pg_temp.accept(104,(select result#>>'{result,token}' from issued where label='first'))->>'error',
  'TEAM_INVITATION_UNAVAILABLE','revoked token denied');
select is(pg_temp.accept(104,'bad')->>'error','TEAM_INVITATION_UNAVAILABLE','invalid format denied');
select is(pg_temp.accept(104,repeat('a',64))->>'error','TEAM_INVITATION_UNAVAILABLE','unknown token denied');
select is(pg_temp.accept(108,(select result#>>'{result,token}' from issued where label='second'))->>'error',
  'TEAM_INVITATION_UNAVAILABLE','wrong recipient denied');
select is(pg_temp.accept(101,(select result#>>'{result,token}' from issued where label='second'))->>'error',
  'TEAM_INVITATION_UNAVAILABLE','owner never repurposed');
select ok((select barber_id is null from public.profiles where id=pg_temp.i(108))
  and (select accepted_at is null from public.team_invitations where id=
    (select (result#>>'{result,invitation_id}')::uuid from issued where label='second')),'failed acceptance leaves both records unchanged');
select is(pg_temp.accept(104,(select result#>>'{result,token}' from issued where label='second'))->>'ok','true','confirmed recipient accepts');
select ok((select barbershop_id=pg_temp.i(1) and barber_id=pg_temp.i(10) and role='barber'
  from public.profiles where id=pg_temp.i(104)),'identity derived from invitation');
select ok((select accepted_by=pg_temp.i(104) and accepted_at is not null from public.team_invitations
  where id=(select (result#>>'{result,invitation_id}')::uuid from issued where label='second')),'acceptor recorded');
select is(pg_temp.accept(104,(select result#>>'{result,token}' from issued where label='second'))->>'error',
  'TEAM_INVITATION_UNAVAILABLE','replay denied');
select is(pg_temp.issue(101,10,'new@example.test')->>'error','TEAM_INVITATION_UNAVAILABLE','occupied barber denied');
select is(pg_temp.revoke(101,(select (result#>>'{result,invitation_id}')::uuid from issued where label='second'))->>'error',
  'TEAM_INVITATION_UNAVAILABLE','accepted invitation cannot be revoked');
insert into issued values
  ('unconfirmed',pg_temp.issue(101,12,'writer-105@example.test')),
  ('inactive',pg_temp.issue(101,13,'writer-106@example.test')),
  ('foreign-profile',pg_temp.issue(101,14,'writer-107@example.test')),
  ('expired',pg_temp.issue(101,15,'writer-108@example.test')),
  ('occupied',pg_temp.issue(101,16,'writer-109@example.test'));
update public.team_invitations set created_at=now()-interval '49 hours',expires_at=now()-interval '1 hour'
  where barber_id=pg_temp.i(15);
update public.profiles set barbershop_id=pg_temp.i(1),barber_id=pg_temp.i(16) where id=pg_temp.i(110);
select is(pg_temp.accept(n,(select result#>>'{result,token}' from issued where label=l))->>'error',
  'TEAM_INVITATION_UNAVAILABLE',l||' acceptance rejected')
from (values (105,'unconfirmed'),(106,'inactive'),(107,'foreign-profile'),(108,'expired'),(109,'occupied')) cases(n,l);
select is(pg_temp.revoke(102,(select (result#>>'{result,invitation_id}')::uuid from issued where label='unknown-account'))->>'error',
  'TEAM_INVITATION_UNAVAILABLE','foreign owner cannot revoke');
select is(pg_temp.revoke(104,(select (result#>>'{result,invitation_id}')::uuid from issued where label='unknown-account'))->>'error',
  'TEAM_INVITATION_FORBIDDEN','barber cannot revoke');
select is(pg_temp.revoke(101,(select (result#>>'{result,invitation_id}')::uuid from issued where label='unknown-account'))->>'ok',
  'true','owner revokes pending');
create temp table revoked_snapshot as select revoked_at from public.team_invitations where barber_id=pg_temp.i(11);
select is(pg_temp.revoke(101,(select (result#>>'{result,invitation_id}')::uuid from issued where label='unknown-account'))->>'ok',
  'true','revoke idempotent');
select is((select revoked_at from public.team_invitations where barber_id=pg_temp.i(11)),
  (select revoked_at from revoked_snapshot),'repeat preserves timestamp');
select ok((select accepted_at is not null and revoked_at is null from public.team_invitations where id=
  (select (result#>>'{result,invitation_id}')::uuid from issued where label='second')),'accepted history preserved');

insert into issued values ('owner-recipient',pg_temp.issue(101,17,'writer-101@example.test'));
select is(pg_temp.accept(101,(select result#>>'{result,token}' from issued where label='owner-recipient'))->>'error',
  'TEAM_INVITATION_UNAVAILABLE','matching recipient owner still rejected');
insert into issued values ('rollback',pg_temp.issue(101,17,'writer-109@example.test'));
-- Inject a late storage failure only within this rolled-back test transaction.
create function pg_temp.fail_acceptance() returns trigger language plpgsql as $$
begin
  if new.barber_id=pg_temp.i(17) and new.accepted_at is not null then
    raise check_violation using message='synthetic internal detail';
  end if;
  return new;
end;
$$;
create trigger test_invitation_late_failure before update on public.team_invitations
  for each row execute function pg_temp.fail_acceptance();
select is(pg_temp.accept(109,(select result#>>'{result,token}' from issued where label='rollback'))->>'error',
  'TEAM_INVITATION_UNAVAILABLE','late constraint failure sanitized');
select ok((select barber_id is null and barbershop_id is null from public.profiles where id=pg_temp.i(109))
  and (select accepted_at is null and accepted_by is null from public.team_invitations where id=
    (select (result#>>'{result,invitation_id}')::uuid from issued where label='rollback')),'profile write rolled back after late invitation failure');
drop trigger test_invitation_late_failure on public.team_invitations;
update public.barbers set active=false where id=pg_temp.i(17);
select is(pg_temp.accept(109,(select result#>>'{result,token}' from issued where label='rollback'))->>'error',
  'TEAM_INVITATION_UNAVAILABLE','barber deactivated after issuance denied');
update public.barbers set active=true where id=pg_temp.i(17);
delete from public.profiles where id=pg_temp.i(109);
select is(pg_temp.accept(109,(select result#>>'{result,token}' from issued where label='rollback'))->>'error',
  'TEAM_INVITATION_UNAVAILABLE','missing profile denied without provisioning');
update auth.users set email_confirmed_at=now() where id=pg_temp.i(105);
update public.profiles set barbershop_id=pg_temp.i(1),barber_id=pg_temp.i(12) where id=pg_temp.i(105);
select is(pg_temp.accept(105,(select result#>>'{result,token}' from issued where label='unconfirmed'))->>'ok',
  'true','exact existing binding may consume without reassignment');
select is(pg_temp.revoke(103,(select (result#>>'{result,invitation_id}')::uuid from issued where label='rollback'))->>'error',
  'TEAM_INVITATION_FORBIDDEN','inactive owner cannot revoke');
select is(pg_temp.revoke(101,pg_temp.i(999))->>'error','TEAM_INVITATION_UNAVAILABLE','unknown invitation not disclosed');
select is(pg_temp.issue(999,18,'unknown@example.test')->>'error','TEAM_INVITATION_FORBIDDEN','missing owner profile denied');
select is(pg_temp.issue(101,18,repeat('a',255)||'@example.test')->>'error','TEAM_INVITATION_INPUT_INVALID','oversized email denied');
select is(pg_temp.accept(108,upper(repeat('a',64)))->>'error','TEAM_INVITATION_UNAVAILABLE','noncanonical token denied');
select is(pg_temp.call_as(null,'select to_jsonb(public.accept_team_invitation(null))')->>'error','AUTH_REQUIRED','accept requires auth uid');
select is(pg_temp.call_as(null,'select to_jsonb(x) from public.issue_team_invitation(null,null) x')->>'error','AUTH_REQUIRED','issue requires auth uid');
select is(pg_temp.call_as(null,'select to_jsonb(public.revoke_team_invitation(null))')->>'error','AUTH_REQUIRED','revoke requires auth uid');

select ok(has_function_privilege('authenticated',f,'EXECUTE'),'authenticated executes '||f)
from unnest(array['public.issue_team_invitation(uuid,text)','public.accept_team_invitation(text)','public.revoke_team_invitation(uuid)']) f;
select ok(not has_function_privilege(r,f,'EXECUTE'),r||' cannot execute '||f)
from unnest(array['anon','service_role']) r cross join
unnest(array['public.issue_team_invitation(uuid,text)','public.accept_team_invitation(text)','public.revoke_team_invitation(uuid)']) f;
select ok(p.prosecdef and p.provolatile='v' and p.proconfig @> array['search_path=pg_catalog']
  and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where a.grantee=0 and a.privilege_type='EXECUTE'),'definer/volatile/path/PUBLIC ACL: '||p.proname)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('issue_team_invitation','accept_team_invitation','revoke_team_invitation');
select ok(not has_table_privilege(r,'public.team_invitations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  and not has_any_column_privilege(r,'public.team_invitations','SELECT,INSERT,UPDATE,REFERENCES'),r||' has no direct table access')
from unnest(array['anon','authenticated','service_role']) r;
select * from finish();
rollback;
