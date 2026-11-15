-- Campus Board image uploads: public display, owner-scoped writes.
begin;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('campus-post-images','campus-post-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];
drop policy if exists "Campus post images are publicly viewable" on storage.objects;
create policy "Campus post images are publicly viewable" on storage.objects for select to public
using (bucket_id='campus-post-images');
drop policy if exists "Campus members upload own images" on storage.objects;
create policy "Campus members upload own images" on storage.objects for insert to authenticated
with check (bucket_id='campus-post-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Campus members update own images" on storage.objects;
create policy "Campus members update own images" on storage.objects for update to authenticated
using (bucket_id='campus-post-images' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='campus-post-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Campus members delete own images" on storage.objects;
create policy "Campus members delete own images" on storage.objects for delete to authenticated
using (bucket_id='campus-post-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;