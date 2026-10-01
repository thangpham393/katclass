-- Xác nhận từng phần giao thủ công, độc lập với bài nộp online và điểm.
create table public.manual_homework_receipts (
  homework_id uuid not null references public.homeworks(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  task text not null,
  received boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  primary key (homework_id, student_id, task)
);
alter table public.manual_homework_receipts enable row level security;
create policy "read manual receipts" on public.manual_homework_receipts
for select to authenticated using (
  student_id = public.my_profile_id()
  or public.is_my_student(student_id)
  or public.has_perm('homework.manage')
  or exists (select 1 from public.homeworks h join public.classes c on c.id = h.class_id
             where h.id = homework_id and c.teacher_id = public.my_profile_id())
);
grant select on public.manual_homework_receipts to authenticated;
revoke insert, update, delete on public.manual_homework_receipts from authenticated, anon;

create function public.set_manual_homework_receipt(hw_id uuid, sid uuid, task_name text, is_received boolean)
returns public.manual_homework_receipts
language plpgsql security definer set search_path = public as $$
declare
  hw public.homeworks;
  result public.manual_homework_receipts;
begin
  select * into hw from public.homeworks where id = hw_id;
  if hw.id is null then raise exception 'Không tìm thấy bài tập'; end if;
  if not (public.has_perm('homework.manage') or exists (
    select 1 from public.classes c where c.id = hw.class_id and c.teacher_id = public.my_profile_id()
  )) then raise exception 'Bạn không có quyền xác nhận bài tập này'; end if;
  if not exists (select 1 from public.class_students cs where cs.class_id = hw.class_id and cs.student_id = sid)
    then raise exception 'Học viên không thuộc lớp được giao bài'; end if;
  if task_name is null or not (task_name = any(hw.manual_tasks)
    or (task_name = '__teacher_note__' and btrim(coalesce(hw.teacher_note, '')) <> ''))
    then raise exception 'Phần bài tập không hợp lệ'; end if;
  if is_received is null then raise exception 'Trạng thái không hợp lệ'; end if;
  insert into public.manual_homework_receipts(homework_id, student_id, task, received, updated_by)
  values(hw_id, sid, task_name, is_received, public.my_profile_id())
  on conflict (homework_id, student_id, task) do update
    set received = excluded.received, updated_at = now(), updated_by = excluded.updated_by
  returning * into result;
  return result;
end;
$$;
revoke all on function public.set_manual_homework_receipt(uuid, uuid, text, boolean) from public;
grant execute on function public.set_manual_homework_receipt(uuid, uuid, text, boolean) to authenticated;
