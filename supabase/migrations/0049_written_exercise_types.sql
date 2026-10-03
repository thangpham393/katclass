-- Dạng bài đúng theo phiếu: dịch câu, chữ Hán + Pinyin, nối ba cột.
-- Chạy sau 0048. Các helper chỉ được gọi trong RPC chấm, không cấp cho học viên.
begin;

alter table public.questions drop constraint questions_type_check;
alter table public.questions add constraint questions_type_check check (type in (
  'multiple_choice','fill_blank','matching','reorder','listening','pinyin_choice',
  'reading','translation','hanzi_pinyin','multi_matching'
));

create function public.normalize_written_answer(value text)
returns text language sql immutable parallel safe set search_path = pg_catalog as $$
  select regexp_replace(lower(normalize(coalesce(value, ''), NFKC)),
    '[[:space:][:punct:]，。！？；：“”‘’、…·—]+', '', 'g');
$$;

create function public.written_answer_matches(expected jsonb, actual jsonb)
returns boolean language sql immutable parallel safe set search_path = pg_catalog, public as $$
  select coalesce(jsonb_typeof(actual) = 'string'
    and public.normalize_written_answer(actual #>> '{}') <> ''
    and exists (
      select 1 from jsonb_array_elements(
        case when jsonb_typeof(expected) = 'array' then expected else jsonb_build_array(expected) end
      ) variant
      where jsonb_typeof(variant) = 'string'
        and public.normalize_written_answer(variant #>> '{}') = public.normalize_written_answer(actual #>> '{}')
    ), false);
$$;

create function public.grade_question_answer(qtype text, content jsonb, expected jsonb, actual jsonb)
returns table(total int, correct int)
language plpgsql immutable parallel safe set search_path = pg_catalog, public as $$
begin
  if qtype = 'translation' then
    return query select 1, public.written_answer_matches(expected, actual)::int;
  elsif qtype = 'hanzi_pinyin' or (qtype = 'reorder' and content ->> 'require_pinyin' = 'true') then
    return query select 2,
      public.written_answer_matches(expected -> 'hanzi', actual -> 'hanzi')::int +
      public.written_answer_matches(expected -> 'pinyin', actual -> 'pinyin')::int;
  elsif qtype in ('matching', 'multi_matching', 'reading') then
    -- Mỗi liên kết / câu con có một điểm; chỉ duyệt khóa đáp án của GV.
    return query select count(*)::int, count(*) filter (where a.value = actual -> a.key)::int
      from jsonb_each(case when jsonb_typeof(expected) = 'object' then expected else '{}'::jsonb end) a;
  else
    -- Các câu cũ giữ quy tắc chấm chính xác bằng jsonb equality.
    return query select 1, coalesce(expected = actual, false)::int;
  end if;
end;
$$;

revoke all on function public.normalize_written_answer(text) from public, anon, authenticated;
revoke all on function public.written_answer_matches(jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.grade_question_answer(text,jsonb,jsonb,jsonb) from public, anon, authenticated;

create or replace function public.submit_homework(hw_id uuid, my_answers jsonb)
returns public.submissions
security definer set search_path = public language plpgsql as $$
declare
  sid uuid := public.my_profile_id();
  hw record;
  att public.test_attempts;
  total int;
  correct int;
  result public.submissions;
begin
  if sid is null then raise exception 'Không tìm thấy hồ sơ học viên'; end if;
  if my_answers is null or jsonb_typeof(my_answers) <> 'object' then
    raise exception 'Bài nộp phải là danh sách câu trả lời hợp lệ';
  end if;
  select h.* into hw from homeworks h where h.id = hw_id;
  if not exists (select 1 from public.class_students cs where cs.class_id = hw.class_id and cs.student_id = sid) then
    raise exception 'Bạn không có quyền nộp bài tập này';
  end if;
  -- Giữ nguyên giới hạn thời gian và một lần nộp của 0048.
  if hw.kind = 'test' then
    select * into att from test_attempts where homework_id = hw_id and student_id = sid;
    if att.homework_id is null then raise exception 'Bạn chưa bắt đầu làm bài kiểm tra này'; end if;
    if exists (select 1 from submissions s where s.homework_id = hw_id and s.student_id = sid) then
      raise exception 'Bài kiểm tra chỉ được nộp một lần';
    end if;
    if now() > att.started_at + make_interval(mins => hw.time_limit_minutes) + interval '60 seconds' then
      raise exception 'Đã hết giờ làm bài — bài nộp không được ghi nhận';
    end if;
  end if;

  select coalesce(sum(g.total), 0)::int, coalesce(sum(g.correct), 0)::int into total, correct
  from homework_questions hq join questions q on q.id = hq.question_id
  join question_answers qa on qa.question_id = q.id
  cross join lateral public.grade_question_answer(q.type, q.content, qa.answer, my_answers -> q.id::text) g
  where hq.homework_id = hw_id;

  insert into public.submissions(homework_id,student_id,answers,auto_score,score,status)
  values(hw_id,sid,my_answers,
    case when total > 0 then round(correct::numeric * 10 / total, 1) else null end,
    case when total > 0 then round(correct::numeric * 10 / total, 1) else null end,'graded')
  on conflict (homework_id,student_id) do update set answers=excluded.answers,
    auto_score=excluded.auto_score,score=excluded.score,submitted_at=now()
  returning * into result;
  return result;
end;
$$;

commit;
