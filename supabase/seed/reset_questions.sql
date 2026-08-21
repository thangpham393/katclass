-- Xoá sạch ngân hàng câu hỏi trước khi nạp bộ bài tập KAT
-- ------------------------------------------------------
-- Chạy trong SQL Editor của Supabase (quyền service role).
-- Cascade sẽ dọn luôn question_answers và homework_questions, nghĩa là các
-- bài tập / bài kiểm tra ĐÃ GIAO trước đây sẽ không còn câu hỏi nào.
-- Bài làm của học viên (submissions) vẫn giữ nguyên nhưng không xem lại được
-- nội dung câu hỏi.

begin;
delete from public.questions;
commit;

-- Kiểm tra lại: cả ba bảng phải về 0
select
  (select count(*) from public.questions)          as questions,
  (select count(*) from public.question_answers)   as answers,
  (select count(*) from public.homework_questions) as homework_questions;
