-- Restrict private RLS helpers to the authenticated application role.
revoke all on function private.current_user_barber_id() from public, anon, authenticated, service_role;
revoke all on function private.current_user_barbershop_id() from public, anon, authenticated, service_role;
revoke all on function private.current_user_role() from public, anon, authenticated, service_role;

grant execute on function private.current_user_barber_id() to authenticated;
grant execute on function private.current_user_barbershop_id() to authenticated;
grant execute on function private.current_user_role() to authenticated;

revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
