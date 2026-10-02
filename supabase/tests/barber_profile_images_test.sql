begin;
create extension if not exists pgtap with schema extensions;
select plan(25);
create function pg_temp.photo_id(n integer) returns uuid language sql immutable as $$
  select ('eeee0036-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.photo_path(tenant integer, barber integer) returns text language sql immutable as $$
  select pg_temp.photo_id(tenant)::text || '/barbers/' || pg_temp.photo_id(barber)::text || '/fixture.png'
$$;
insert into public.barbershops(id,name,slug) values
(pg_temp.photo_id(1),'Photo A','photo-fixture-a'),(pg_temp.photo_id(2),'Photo B','photo-fixture-b');
insert into public.barbers(id,barbershop_id,name) values
(pg_temp.photo_id(3),pg_temp.photo_id(1),'Same name'),(pg_temp.photo_id(4),pg_temp.photo_id(2),'Same name');
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
(pg_temp.photo_id(101),'authenticated','authenticated','photo-owner@example.test','{"role":"owner"}'),
(pg_temp.photo_id(102),'authenticated','authenticated','photo-barber@example.test','{"role":"barber"}');
update public.profiles set barbershop_id=pg_temp.photo_id(1) where id=pg_temp.photo_id(101);
update public.profiles set barbershop_id=pg_temp.photo_id(1),barber_id=pg_temp.photo_id(3) where id=pg_temp.photo_id(102);

select col_is_null('public','barbers','photo_path','photo_path is nullable');
select ok((select photo_path is null from public.barbers where id=pg_temp.photo_id(3)),'existing no-photo behavior stays null');
select ok(has_column_privilege('anon','public.barbers','photo_path','SELECT'),'existing public SELECT includes the photo reference');
select ok(not has_table_privilege('anon','public.barbers','INSERT,UPDATE,DELETE'),'anon has no mutations');
select ok(not has_any_column_privilege('anon','public.barbers','INSERT,UPDATE'),'anon has no column mutation privileges');
select ok((select relrowsecurity from pg_class where oid='public.barbers'::regclass),'barber RLS remains enabled');
select ok((select public from storage.buckets where id='barbershop-branding'),'existing bucket remains public');
select is((select file_size_limit from storage.buckets where id='barbershop-branding'),5242880::bigint,'bucket limit remains 5 MB');
select is((select allowed_mime_types from storage.buckets where id='barbershop-branding'),array['image/png','image/jpeg','image/webp'],'only existing image MIME types allowed');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.photo_id(101),'role','authenticated')::text,true);
set local role authenticated;
select lives_ok($$update public.barbers set photo_path=pg_temp.photo_path(1,3) where id=pg_temp.photo_id(3)$$,'owner can save own photo');
select is((select photo_path from public.barbers where id=pg_temp.photo_id(3)),pg_temp.photo_path(1,3),'path persists on the correct barber');
select throws_ok($$update public.barbers set photo_path=pg_temp.photo_path(2,3) where id=pg_temp.photo_id(3)$$,'23514',null,'foreign tenant path rejected');
select throws_ok($$update public.barbers set photo_path=pg_temp.photo_path(1,4) where id=pg_temp.photo_id(3)$$,'23514',null,'foreign barber path rejected');
select throws_ok($$update public.barbers set photo_path=pg_temp.photo_id(1)||'/logo.png' where id=pg_temp.photo_id(3)$$,'23514',null,'branding namespace rejected');
select throws_ok($$update public.barbers set photo_path=pg_temp.photo_id(1)||'/barbers/'||pg_temp.photo_id(3)||'/../photo.png' where id=pg_temp.photo_id(3)$$,'23514',null,'traversal rejected');
select throws_ok($$update public.barbers set photo_path='https://example.test/photo.png' where id=pg_temp.photo_id(3)$$,'23514',null,'external URL rejected');
select is_empty($$update public.barbers set photo_path=pg_temp.photo_path(2,4) where id=pg_temp.photo_id(4) returning id$$,'owner cannot change another tenant');
select lives_ok($$insert into storage.objects(bucket_id,name) values('barbershop-branding',pg_temp.photo_path(1,3))$$,'owner uploads in own tenant namespace');
select throws_ok($$insert into storage.objects(bucket_id,name) values('barbershop-branding',pg_temp.photo_path(2,4))$$,'42501',null,'cross-tenant storage write rejected');
select is_empty($$select name from storage.objects where bucket_id='barbershop-branding'$$,'owner cannot list bucket');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.photo_id(102),'role','authenticated')::text,true);
set local role authenticated;
select is_empty($$update public.barbers set photo_path=null where id=pg_temp.photo_id(3) returning id$$,'barber cannot change own photo');
reset role;
set local role anon;
select throws_ok($$update public.barbers set photo_path=null where id=pg_temp.photo_id(3)$$,'42501',null,'anon cannot update photo');
select is((select photo_path from public.barbers where id=pg_temp.photo_id(3)),pg_temp.photo_path(1,3),'public reads only the saved path');
select is_empty($$select name from storage.objects where bucket_id='barbershop-branding'$$,'anon cannot list bucket');
reset role;
select is((select photo_path from public.barbers where id=pg_temp.photo_id(4)),null::text,'other tenant remains unchanged');
select * from finish();
rollback;
