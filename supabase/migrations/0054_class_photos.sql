-- Private, class-specific photos for classroom name picking. Profile avatars stay independent.
create or replace function public.can_manage_class_photos(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.classes c where c.id = cid and (
      public.has_perm('classes.manage') or c.teacher_id = public.my_profile_id()
      or exists (select 1 from public.class_teachers ct where ct.class_id = cid and ct.teacher_id = public.my_profile_id())
      or exists (select 1 from public.sessions s where s.class_id = cid and s.teacher_id = public.my_profile_id())
    )
  );
$$;

create table public.class_photos (
  class_id uuid not null references public.classes(id) on delete cascade,
  -- 'group' or the student UUID; one portrait per member of this class.
  photo_key text not null,
  path text not null,
  updated_at timestamptz not null default now(),
  primary key (class_id, photo_key),
  check (photo_key = 'group' or photo_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  check (path like class_id::text || '/%')
);
alter table public.class_photos enable row level security;
create policy "class photo access" on public.class_photos for select to authenticated
  using (public.can_manage_class_photos(class_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('class-photos', 'class-photos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- UUID syntax is checked before casting untrusted storage paths.
create or replace function public.can_access_class_photo_path(p text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare cid text := split_part(p, '/', 1);
begin
  if cid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return public.can_manage_class_photos(cid::uuid);
end;
$$;
create policy "class photo storage" on storage.objects for all to authenticated
  using (bucket_id = 'class-photos' and public.can_access_class_photo_path(name))
  with check (bucket_id = 'class-photos' and public.can_access_class_photo_path(name));

-- Apply all assignments together; failed validation never leaves half a saved class.
create or replace function public.save_class_photos(cid uuid, changes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare item record;
begin
  if not public.can_manage_class_photos(cid) then raise exception 'Không có quyền cập nhật ảnh lớp.'; end if;
  if jsonb_typeof(changes) <> 'object' then raise exception 'Dữ liệu ảnh không hợp lệ.'; end if;
  for item in select key, value from jsonb_each_text(changes) loop
    if item.key <> 'group' and not exists (
      select 1 from public.class_students cs where cs.class_id = cid and cs.student_id::text = item.key
    ) then raise exception 'Học viên không thuộc lớp.'; end if;
    if item.value is null then
      delete from public.class_photos where class_id = cid and photo_key = item.key;
    else
      if item.value not like cid::text || '/%' or not exists (
        select 1 from storage.objects where bucket_id = 'class-photos' and name = item.value
      ) then raise exception 'Ảnh chưa được tải lên hoặc không thuộc lớp.'; end if;
      insert into public.class_photos (class_id, photo_key, path) values (cid, item.key, item.value)
      on conflict (class_id, photo_key) do update set path = excluded.path, updated_at = now();
    end if;
  end loop;
end;
$$;
revoke all on function public.save_class_photos(uuid, jsonb) from public, anon;
grant execute on function public.save_class_photos(uuid, jsonb) to authenticated;
