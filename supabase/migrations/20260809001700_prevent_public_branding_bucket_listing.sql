drop policy if exists "Public read barbershop branding"
  on storage.objects;

-- Public buckets serve object URLs without SELECT. This operation-aware policy
-- preserves owner upserts while preventing clients from listing bucket rows.
create policy "Owner select own barbershop branding for upsert"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'barbershop-branding'
    and (storage.foldername(name))[1] = private.current_user_barbershop_id()::text
    and private.current_user_role() = 'owner'
    and storage.allow_any_operation(
      array[
        'object.get_authenticated_info',
        'object.get_authenticated',
        'object.upload',
        'object.delete_many'
      ]
    )
  );
