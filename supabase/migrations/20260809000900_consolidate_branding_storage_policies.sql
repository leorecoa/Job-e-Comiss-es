-- Remove only the policies that exactly duplicate the canonical owner policies.
drop policy if exists storage_branding_owner_delete on storage.objects;
drop policy if exists storage_branding_owner_insert on storage.objects;
drop policy if exists storage_branding_owner_update on storage.objects;
