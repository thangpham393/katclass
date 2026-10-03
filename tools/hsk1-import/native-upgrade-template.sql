-- HSK 1: chuyển bản nhập 584 mục sang 565 mục đúng dạng phiếu gốc.
-- Chạy sau 0049. Giao dịch kiểm tra dữ liệu trước khi ghi, chạy lại an toàn.
-- Các câu đã giao / có trong đề kiểm tra được giữ thành snapshot với ID cũ.
begin;

create temporary table _hsk_changes on commit drop as
select * from jsonb_to_recordset(/*CHANGES_JSON*/) as x(
  old_id uuid,new_id uuid,lesson_id uuid,old_type text,old_content jsonb,old_answer jsonb,
  new_type text,new_content jsonb,new_answer jsonb
);
create temporary table _hsk_obsolete on commit drop as
select * from jsonb_to_recordset(/*OBSOLETE_JSON*/) as x(id uuid,content jsonb,type text,answer jsonb);
create temporary table _hsk_unchanged on commit drop as
select value::uuid as id from jsonb_array_elements_text(/*UNCHANGED_JSON*/);

-- Khóa ghi trong thời gian đối chiếu và chuyển đổi.
lock table public.questions, public.question_answers, public.homework_questions, public.test_templates in share row exclusive mode;

do $$ begin
  if exists (
    select 1 from _hsk_changes c left join public.questions q on q.id=c.old_id
    left join public.question_answers a on a.question_id=q.id
    where q.id is null or not coalesce((
      (q.type=c.old_type and q.content=c.old_content and a.answer=c.old_answer) or
      (q.type=c.new_type and q.content=c.new_content and a.answer=c.new_answer)
    ), false)
  ) or exists (
    select 1 from _hsk_obsolete o left join public.questions q on q.id=o.id
    left join public.question_answers a on a.question_id=q.id
    where q.id is null or q.type is distinct from o.type or q.content is distinct from o.content or a.answer is distinct from o.answer
  ) then raise exception 'Bộ bài HSK 1 đã thay đổi sau lần nhập. Dừng chuyển đổi để tránh ghi đè chỉnh sửa.'; end if;
  if exists (
    select 1 from _hsk_changes c join public.questions q on q.id=c.new_id
    left join public.question_answers a on a.question_id=q.id
    where q.type is distinct from c.new_type or q.content is distinct from c.new_content or a.answer is distinct from c.new_answer
  ) then raise exception 'ID câu mới đã tồn tại với dữ liệu khác'; end if;
end $$;

create temporary table _hsk_targets on commit drop as
select c.*, case when q.is_test_snapshot or
  exists(select 1 from public.homework_questions h where h.question_id=c.old_id) or
  exists(select 1 from public.test_templates t where c.old_id=any(t.question_ids))
  then c.new_id else c.old_id end as target_id
from _hsk_changes c join public.questions q on q.id=c.old_id;

insert into public.questions(id,type,content,level,tags,lesson_id,created_by,is_test_snapshot)
select t.target_id,t.new_type,t.new_content,q.level,q.tags,t.lesson_id,q.created_by,false
from _hsk_targets t join public.questions q on q.id=t.old_id
where t.target_id <> t.old_id
on conflict(id) do nothing;

update public.questions q set type=t.new_type,content=t.new_content
from _hsk_targets t where q.id=t.old_id and t.target_id=t.old_id;

insert into public.question_answers(question_id,answer)
select target_id,new_answer from _hsk_targets
on conflict(question_id) do update set answer=excluded.answer;

-- Giữ nguyên đề / đáp án cũ cho các lượt làm đã giao; loại khỏi kho chọn bài.
update public.questions q set is_test_snapshot=true,lesson_id=null
where q.id in(select old_id from _hsk_targets where target_id <> old_id)
   or q.id in(select id from _hsk_obsolete);

do $$ declare count_active int; begin
  if exists (
    select 1 from _hsk_targets t left join public.questions q on q.id=t.target_id
    left join public.question_answers a on a.question_id=q.id
    where q.id is null or q.type is distinct from t.new_type or q.content is distinct from t.new_content
      or a.answer is distinct from t.new_answer or q.lesson_id is distinct from t.lesson_id or q.is_test_snapshot
  ) then raise exception 'Đối chiếu câu mới không khớp'; end if;
  select count(*) into count_active from public.questions q join public.lessons l on l.id=q.lesson_id
    join public.textbooks t on t.id=l.textbook_id
    where t.code='hsk1-new30' and not q.is_test_snapshot and 'hsk1-pdf-worksheets'=any(q.tags);
  if count_active <> 565 then raise exception 'Số mục bài tập không khớp: %, cần 565',count_active; end if;
end $$;

commit;
