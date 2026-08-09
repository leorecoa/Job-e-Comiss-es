-- Keep direct profile access limited to operations used by authenticated flows.
revoke all on table public.profiles from public, anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
