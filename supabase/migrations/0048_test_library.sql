-- Kho đề kiểm tra và đọc hiểu. Đề đã giao giữ bản sao câu hỏi / đáp án.
alter table public.questions drop constraint questions_type_check;
alter table public.questions add constraint questions_type_check check (type in ('multiple_choice','fill_blank','matching','reorder','listening','pinyin_choice','reading'));
alter table public.questions add column is_test_snapshot boolean not null default false;
-- Học viên chỉ đọc câu hỏi đã giao và được phép mở theo RLS homework_questions.
drop policy "read questions" on public.questions;
create policy "read questions" on public.questions for select to authenticated using (
  public.has_perm('library.manage') or public.has_perm('homework.manage')
  or exists (select 1 from public.homework_questions hq where hq.question_id = questions.id)
);
create table public.test_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  category text not null check (category in ('lesson','midterm','final')),
  time_limit_minutes int not null check (time_limit_minutes > 0),
  question_ids uuid[] not null check (cardinality(question_ids) > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.test_templates enable row level security;
create policy "read test library" on public.test_templates for select to authenticated using (public.my_role() in ('teacher','admin') or public.has_perm('library.manage'));
create policy "delete test templates" on public.test_templates for delete to authenticated using (public.my_role() = 'admin' or (public.my_role() = 'teacher' and created_by = public.my_profile_id()));
grant select, delete on public.test_templates to authenticated;
revoke insert, update on public.test_templates from authenticated, anon;

create function public.save_test_template(template_id uuid, template_title text, template_category text, minutes int, ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare result uuid;
begin
  if public.my_role() is null or public.my_role() not in ('teacher','admin') then raise exception 'Bạn không có quyền soạn đề kiểm tra'; end if;
  if ids is null or cardinality(ids) = 0 or exists (select 1 from unnest(ids) i where not exists (select 1 from questions q join question_answers a on a.question_id=q.id where q.id=i)) then raise exception 'Đề kiểm tra cần câu hỏi có đáp án hợp lệ'; end if;
  if cardinality(ids) <> (select count(distinct i) from unnest(ids) i) then raise exception 'Câu hỏi bị trùng'; end if;
  if template_id is null then
    insert into test_templates(title,category,time_limit_minutes,question_ids,created_by) values(btrim(template_title),template_category,minutes,ids,public.my_profile_id()) returning id into result;
  else
    update test_templates set title=btrim(template_title), category=template_category,time_limit_minutes=minutes,question_ids=ids where id=template_id and (public.my_role()='admin' or created_by=public.my_profile_id()) returning id into result;
    if result is null then raise exception 'Không tìm thấy đề hoặc bạn không có quyền sửa'; end if;
  end if;
  return result;
end; $$;
revoke all on function public.save_test_template(uuid,text,text,int,uuid[]) from public;
grant execute on function public.save_test_template(uuid,text,text,int,uuid[]) to authenticated;

create function public.assign_test_template(tid uuid,cid uuid,assignment_title text,minutes int,opens timestamptz,due timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare template public.test_templates; hwid uuid; qid uuid; copyid uuid; n int := 0;
begin
  if not coalesce((public.has_perm('homework.manage') or exists(select 1 from classes where id=cid and teacher_id=public.my_profile_id())), false) then raise exception 'Bạn không có quyền giao kiểm tra cho lớp'; end if;
  select * into template from test_templates where id=tid;
  if template.id is null then raise exception 'Không tìm thấy đề kiểm tra'; end if;
  if opens is not null and due is not null and opens >= due then raise exception 'Hạn vào làm phải sau giờ mở đề'; end if;
  insert into homeworks(class_id,title,kind,time_limit_minutes,open_at,due_at,created_by) values(cid,assignment_title,'test',minutes,opens,due,public.my_profile_id()) returning id into hwid;
  foreach qid in array template.question_ids loop
    if not exists(select 1 from questions q join question_answers a on a.question_id=q.id where q.id=qid) then raise exception 'Một câu hỏi trong đề đã bị xóa. Hãy sửa lại đề'; end if;
    insert into questions(type,content,level,tags,created_by,is_test_snapshot) select type,content,level,tags,public.my_profile_id(),true from questions where id=qid returning id into copyid;
    insert into question_answers(question_id,answer) select copyid,answer from question_answers where question_id=qid;
    insert into homework_questions(homework_id,question_id,sort) values(hwid,copyid,n);
    n := n + 1;
  end loop;
  return hwid;
end; $$;
revoke all on function public.assign_test_template(uuid,uuid,text,int,timestamptz,timestamptz) from public;
grant execute on function public.assign_test_template(uuid,uuid,text,int,timestamptz,timestamptz) to authenticated;

create or replace function public.submit_homework(hw_id uuid, my_answers jsonb)
returns public.submissions
security definer
set search_path = public
language plpgsql
as $$
declare
  sid uuid := public.my_profile_id();
  hw record;
  att public.test_attempts;
  total int;
  correct int;
  result public.submissions;
begin
  if sid is null then
    raise exception 'Không tìm thấy hồ sơ học viên';
  end if;

  select h.* into hw from homeworks h where h.id = hw_id;

  if not exists (
    select 1
    from public.class_students cs
    where cs.class_id = hw.class_id and cs.student_id = sid
  ) then
    raise exception 'Bạn không có quyền nộp bài tập này';
  end if;

  -- Luật riêng cho bài kiểm tra có giờ
  if hw.kind = 'test' then
    select * into att
    from test_attempts
    where homework_id = hw_id and student_id = sid;

    if att.homework_id is null then
      raise exception 'Bạn chưa bắt đầu làm bài kiểm tra này';
    end if;

    if exists (
      select 1 from submissions s
      where s.homework_id = hw_id and s.student_id = sid
    ) then
      raise exception 'Bài kiểm tra chỉ được nộp một lần';
    end if;

    -- 60 giây ân hạn cho mạng chậm / auto-submit lúc hết giờ
    if now() > att.started_at + make_interval(mins => hw.time_limit_minutes) + interval '60 seconds' then
      raise exception 'Đã hết giờ làm bài — bài nộp không được ghi nhận';
    end if;
  end if;

  -- Mỗi câu con đọc hiểu tính một điểm như các câu hỏi thông thường.
  select count(*), count(*) filter (where expected = actual)
  into total, correct
  from (
    select qa.answer as expected, my_answers -> hq.question_id::text as actual
    from homework_questions hq join questions q on q.id=hq.question_id
    join question_answers qa on qa.question_id=q.id
    where hq.homework_id=hw_id and q.type <> 'reading'
    union all
    select to_jsonb(a.value), my_answers -> hq.question_id::text -> a.key
    from homework_questions hq join questions q on q.id=hq.question_id
    join question_answers qa on qa.question_id=q.id
    cross join lateral jsonb_each_text(case when q.type='reading' then qa.answer else '{}'::jsonb end) a
    where hq.homework_id=hw_id and q.type='reading'
  ) responses;

  insert into public.submissions (homework_id, student_id, answers, auto_score, score, status)
  values (
    hw_id,
    sid,
    my_answers,
    case when total > 0 then round(correct::numeric * 10 / total, 1) else null end,
    case when total > 0 then round(correct::numeric * 10 / total, 1) else null end,
    'graded'
  )
  on conflict (homework_id, student_id) do update
    set answers = excluded.answers,
        auto_score = excluded.auto_score,
        score = excluded.score,
        submitted_at = now()
  returning * into result;

  return result;
end;
$$;
