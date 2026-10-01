-- Giáo viên ghi điểm bài tập giao thủ công (phiếu giấy / vở / sách bài tập).
create or replace function public.grade_manual_homework(
  hw_id uuid,
  sid uuid,
  manual_score numeric
)
returns public.submissions
security definer
set search_path = public
language plpgsql
as $$
declare
  hw public.homeworks;
  result public.submissions;
begin
  if manual_score is null or manual_score < 0 or manual_score > 10 then
    raise exception 'Điểm phải từ 0 đến 10';
  end if;

  select * into hw from public.homeworks where id = hw_id;
  if hw.id is null then
    raise exception 'Không tìm thấy bài tập';
  end if;
  if cardinality(hw.manual_tasks) = 0 and btrim(coalesce(hw.teacher_note, '')) = '' then
    raise exception 'Bài tập này không có phần giao thủ công';
  end if;
  if not (
    public.has_perm('homework.manage')
    or exists (
      select 1 from public.classes c
      where c.id = hw.class_id and c.teacher_id = public.my_profile_id()
    )
  ) then
    raise exception 'Bạn không có quyền chấm bài tập này';
  end if;
  if not exists (
    select 1 from public.class_students cs
    where cs.class_id = hw.class_id and cs.student_id = sid
  ) then
    raise exception 'Học viên không thuộc lớp được giao bài';
  end if;

  insert into public.submissions (
    homework_id, student_id, answers, auto_score, score, status, submitted_at, graded_at, graded_by
  ) values (
    hw_id, sid, '{}'::jsonb, null, manual_score, 'graded', now(), now(), public.my_profile_id()
  )
  on conflict (homework_id, student_id) do update
    set score = excluded.score,
        status = 'graded',
        graded_at = now(),
        graded_by = public.my_profile_id()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.grade_manual_homework(uuid, uuid, numeric) from public;
grant execute on function public.grade_manual_homework(uuid, uuid, numeric) to authenticated;
