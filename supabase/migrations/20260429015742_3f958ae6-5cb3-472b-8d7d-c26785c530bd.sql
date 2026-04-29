-- Create private storage bucket for generated PDF reports
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- RLS policies for reports bucket: users can only access their own files (path prefix = their user id)
create policy "Reports: select own"
on storage.objects for select
to authenticated
using (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Reports: insert own"
on storage.objects for insert
to authenticated
with check (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Reports: delete own"
on storage.objects for delete
to authenticated
using (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]);
