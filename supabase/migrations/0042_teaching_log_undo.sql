-- =====================================================================
-- HUỶ CHẤM CÔNG (undo) — sửa khi giáo viên chấm công NHẦM BUỔI/NHẦM NGÀY.
-- Chạy SAU 0041_parent_share.sql.
--
-- Bấm lại vào đúng buổi thì chỉ ghi đè giờ/nội dung (upsert theo
-- session_id), nhưng chấm nhầm sang buổi khác thì phải xoá bản ghi ở
-- buổi sai rồi chấm lại ở buổi đúng — trước 0042 giao diện không có
-- đường nào xoá, buổi sai giữ công vĩnh viễn và đội giờ công tháng đó.
--
-- Quy ước: giáo viên tự huỷ được công của mình trong 24h kể từ lúc bấm;
-- quá hạn thì hành chính huỷ hộ (tránh sửa công tháng đã chốt).
-- =====================================================================

drop policy if exists "staff delete teaching log" on public.teaching_logs;

create policy "delete teaching log" on public.teaching_logs
  for delete using (
    public.is_staff()
    or (public.teaches_session(session_id) and checked_in_at > now() - interval '24 hours')
  );

-- Xoá công → buổi quay lại 'scheduled' (trigger 0018 đã đẩy sang
-- 'completed' khi chấm). Security definer để GV không cần quyền update
-- sessions. Chỉ đụng buổi đang 'completed' — buổi đã huỷ giữ nguyên.
create or replace function public.uncomplete_session_on_log_delete()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  update public.sessions
     set status = 'scheduled'
   where id = old.session_id
     and status = 'completed';
  return old;
end;
$$;

create trigger trg_uncomplete_session_on_log_delete
  after delete on public.teaching_logs
  for each row execute function public.uncomplete_session_on_log_delete();
