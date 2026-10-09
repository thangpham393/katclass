-- Review released only after the student's own submission. Run after 0051.
-- Does not alter existing questions, submissions or scores. Safe to run twice.
begin;
alter table public.submissions add column if not exists review jsonb;
alter table public.question_answers add column if not exists explanation text;

create or replace function public.normalize_pinyin_answer(value text)
returns text language sql immutable parallel safe set search_path = pg_catalog as $$
  -- Preserve ü as v before removing tone marks; accept ü, v and u:.
  select regexp_replace(
    regexp_replace(replace(normalize(replace(lower(normalize(coalesce(value, ''), NFKC)), 'u:', 'v'), NFD), U&'u\0308', 'v'),
      U&'[\0300-\036f]', '', 'g'),
    '[[:space:][:punct:]1-5，。！？；：“”‘’、…·—]+', '', 'g');
$$;

create or replace function public.pinyin_answer_matches(expected jsonb, actual jsonb)
returns boolean language sql immutable parallel safe set search_path = pg_catalog, public as $$
  select coalesce(jsonb_typeof(actual) = 'string'
    and public.normalize_pinyin_answer(actual #>> '{}') <> ''
    and exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(expected) = 'array' then expected else jsonb_build_array(expected) end) variant
      where jsonb_typeof(variant) = 'string'
      and public.normalize_pinyin_answer(variant #>> '{}') = public.normalize_pinyin_answer(actual #>> '{}')
    ), false);
$$;

create or replace function public.grade_question_answer(qtype text, content jsonb, expected jsonb, actual jsonb)
returns table(total int, correct int)
language plpgsql immutable parallel safe set search_path = pg_catalog, public as $$
begin
  if qtype = 'essay' then
    return query select 0, 0;
  elsif qtype in ('translation', 'sentence_correction') then
    return query select 1, public.written_answer_matches(expected, actual)::int;
  elsif qtype = 'hanzi_pinyin' or (qtype = 'reorder' and content ->> 'require_pinyin' = 'true') then
    return query select 2,
      public.written_answer_matches(expected -> 'hanzi', actual -> 'hanzi')::int +
      public.pinyin_answer_matches(expected -> 'pinyin', actual -> 'pinyin')::int;
  elsif qtype in ('matching', 'multi_matching', 'reading') then
    return query select count(*)::int, count(*) filter (where a.value = actual -> a.key)::int
      from jsonb_each(case when jsonb_typeof(expected) = 'object' then expected else '{}'::jsonb end) a;
  else
    return query select 1, coalesce(expected = actual, false)::int;
  end if;
end;
$$;

create or replace function public.question_review_part(part_key text, label text, expected jsonb, actual jsonb, matched boolean, rule text)
returns jsonb language sql immutable parallel safe set search_path = pg_catalog as $$
  select jsonb_build_object('key', part_key, 'label', label, 'expected', expected, 'actual', actual,
    'correct', matched, 'reason', case
      when matched is null then 'Giáo viên sẽ nhận xét và chấm phần này.'
      when matched then 'Đáp án được chấp nhận.'
      when actual is null or actual in ('null'::jsonb, '""'::jsonb, '[]'::jsonb, '{}'::jsonb)
        or (jsonb_typeof(actual) = 'string' and actual #>> '{}' ~ '^[[:space:]]*$') then 'Bạn bỏ trống phần này nên chưa có điểm.'
      else rule end);
$$;

create or replace function public.build_question_review(qtype text, content jsonb, expected jsonb, actual jsonb, legacy boolean default false)
returns jsonb language plpgsql immutable parallel safe set search_path = pg_catalog, public as $$
declare
  parts jsonb := '[]'::jsonb;
  g record;
  item record;
  matched boolean;
  reading_type text;
begin
  select * into g from public.grade_question_answer(qtype, content, expected, actual);
  if qtype = 'essay' then
    -- No model essay is sent to students as an automatic "correct answer".
    parts := jsonb_build_array(public.question_review_part('answer', 'Bài làm', null, actual, null, ''));
  elsif qtype = 'hanzi_pinyin' or (qtype = 'reorder' and content ->> 'require_pinyin' = 'true') then
    matched := public.written_answer_matches(expected -> 'hanzi', actual -> 'hanzi');
    parts := parts || jsonb_build_array(public.question_review_part('hanzi', 'Chữ Hán', expected -> 'hanzi', actual -> 'hanzi', matched,
      'Chữ Hán chưa khớp đáp án mẫu. Đối chiếu các chữ và thứ tự trong câu; khoảng trắng và dấu câu không ảnh hưởng điểm.'));
    matched := case when legacy then public.written_answer_matches(expected -> 'pinyin', actual -> 'pinyin')
      else public.pinyin_answer_matches(expected -> 'pinyin', actual -> 'pinyin') end;
    parts := parts || jsonb_build_array(public.question_review_part('pinyin', 'Pinyin', expected -> 'pinyin', actual -> 'pinyin', matched,
      case when legacy then 'Lượt nộp cũ chấm theo cả dấu thanh. Quy tắc mới cho phép nhập không dấu.'
      else 'Âm Pinyin chưa khớp đáp án mẫu. Có thể bỏ dấu thanh, dùng số thanh và viết liền; ü, v, u: được xem là tương đương.' end));
    select count(*) filter(where (p ->> 'correct')::boolean)::int into g.correct from jsonb_array_elements(parts) p;
  elsif qtype in ('matching', 'multi_matching', 'reading') then
    for item in select key, value from jsonb_each(case when jsonb_typeof(expected) = 'object' then expected else '{}'::jsonb end) order by key loop
      reading_type := content -> 'items' -> (case when qtype = 'reading' then item.key::int else 0 end) ->> 'type';
      parts := parts || jsonb_build_array(public.question_review_part(item.key,
        case when qtype = 'multi_matching' then 'Mục ' || (split_part(item.key, ':', 1)::int + 1) || ' · ' || coalesce(content -> 'columns' -> split_part(item.key, ':', 2)::int ->> 'label', 'Cột')
          when qtype = 'reading' then 'Câu đọc hiểu ' || (item.key::int + 1) else 'Cặp nối ' || (item.key::int + 1) end,
        item.value, actual -> item.key, coalesce(item.value = actual -> item.key, false),
        case when qtype = 'reading' and reading_type = 'short_answer' then 'Câu trả lời chưa khớp đáp án mẫu của câu đọc hiểu. Đối chiếu với thông tin trong đoạn văn.'
          when qtype = 'reading' then 'Lựa chọn chưa đúng theo đoạn văn. Đối chiếu câu hỏi với đáp án bên dưới.'
          else 'Bạn nối chưa đúng mục tương ứng. Xem cặp chữ Hán, phiên âm hoặc nghĩa đúng bên dưới.' end));
    end loop;
  elsif qtype = 'fill_blank' and jsonb_typeof(expected) = 'array' then
    for item in select value, ordinality from jsonb_array_elements(expected) with ordinality loop
      parts := parts || jsonb_build_array(public.question_review_part((item.ordinality - 1)::text, 'Chỗ trống ' || item.ordinality,
        item.value, actual -> (item.ordinality::int - 1), coalesce(item.value = actual -> (item.ordinality::int - 1), false),
        'Từ điền chưa khớp đáp án của ô này. Bài điền từ cần đúng tất cả các ô để có điểm câu hỏi.'));
    end loop;
  else
    parts := jsonb_build_array(public.question_review_part('answer', 'Câu trả lời', expected, actual, g.correct = g.total,
      case when qtype in ('translation', 'sentence_correction') then 'Câu trả lời chưa khớp các mẫu được chấp nhận. Đối chiếu với mẫu bên dưới; hệ thống bỏ qua khoảng trắng và dấu câu, chưa chấm các cách diễn đạt khác theo nghĩa.'
        when qtype = 'reorder' then 'Các từ chưa đúng thứ tự hoặc còn thiếu từ. So sánh câu đã xếp với câu đúng bên dưới.'
        else 'Bạn chọn đáp án chưa đúng. Đối chiếu nội dung lựa chọn với đáp án đúng bên dưới.' end));
  end if;
  return jsonb_build_object('type', qtype, 'content', content, 'actual', actual, 'total', g.total, 'correct', g.correct, 'parts', parts);
end;
$$;

create or replace function public.build_homework_review(hw_id uuid, answers jsonb, legacy boolean default false)
returns jsonb language sql stable set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(public.build_question_review(q.type, q.content, qa.answer, answers -> q.id::text, legacy)
    || jsonb_build_object('question_id', q.id, 'explanation', case when q.type <> 'essay' then qa.explanation else null end)
    order by hq.sort, q.id), '[]'::jsonb)
  from public.homework_questions hq join public.questions q on q.id = hq.question_id
  join public.question_answers qa on qa.question_id = q.id
  where hq.homework_id = hw_id;
$$;

-- Never accept an arbitrary student's ID or arbitrary answers as a review request.
create or replace function public.get_homework_review(hw_id uuid)
returns jsonb security definer set search_path = pg_catalog, public language plpgsql as $$
declare
  sub public.submissions;
begin
  select * into sub from public.submissions s where s.homework_id = hw_id and s.student_id = public.my_profile_id();
  if sub.id is null then raise exception 'Bạn cần nộp bài trước khi xem đáp án'; end if;
  return jsonb_build_object('legacy', sub.review is null, 'questions',
    coalesce(sub.review, public.build_homework_review(hw_id, sub.answers, true)));
end;
$$;

revoke all on function public.normalize_pinyin_answer(text) from public, anon, authenticated;
revoke all on function public.pinyin_answer_matches(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.grade_question_answer(text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.question_review_part(text, text, jsonb, jsonb, boolean, text) from public, anon, authenticated;
revoke all on function public.build_question_review(text, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.build_homework_review(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.get_homework_review(uuid) from public, anon, authenticated;
grant execute on function public.get_homework_review(uuid) to authenticated;

create or replace function public.submit_homework(hw_id uuid, my_answers jsonb)
returns public.submissions
security definer set search_path = public language plpgsql as $$
declare
  sid uuid := public.my_profile_id();
  hw record;
  att public.test_attempts;
  total int;
  correct int;
  needs_manual boolean;
  feedback jsonb;
  result public.submissions;
begin
  if sid is null then raise exception 'Không tìm thấy hồ sơ học viên'; end if;
  if my_answers is null or jsonb_typeof(my_answers) <> 'object' then
    raise exception 'Bài nộp phải là danh sách câu trả lời hợp lệ';
  end if;
  select h.* into hw from homeworks h where h.id = hw_id for update;
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

  feedback := public.build_homework_review(hw_id, my_answers);
  select coalesce(sum((q ->> 'total')::int), 0)::int, coalesce(sum((q ->> 'correct')::int), 0)::int
  into total, correct from jsonb_array_elements(feedback) q;

  select exists (
    select 1 from public.homework_questions hq join public.questions q on q.id=hq.question_id
    where hq.homework_id=hw_id and q.type='essay'
  ) into needs_manual;

  insert into public.submissions(homework_id,student_id,answers,auto_score,score,status,review)
  values(hw_id,sid,my_answers,
    case when total > 0 then round(correct::numeric * 10 / total, 1) else null end,
    case when not needs_manual and total > 0 then round(correct::numeric * 10 / total, 1) else null end,
    case when needs_manual then 'submitted' else 'graded' end,feedback)
  on conflict (homework_id,student_id) do update set answers=excluded.answers,
    auto_score=excluded.auto_score,score=excluded.score,status=excluded.status,review=excluded.review,submitted_at=now(),
    graded_at=null,graded_by=null
  returning * into result;
  return result;
end;
$$;


commit;
