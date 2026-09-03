-- =====================================================================
-- IMPORT DANH SÁCH LỚP + HỌC VIÊN CHI NHÁNH THỦ ĐỨC (sheet 2026)
-- Nguồn: 'DANH SÁCH HỌC VIÊN THỦ ĐỨC.xlsx' — sheet 2026: 35 lớp / 203 học viên.
--
-- Chạy trong Supabase Dashboard > SQL Editor (bôi đen tất cả rồi Run).
-- CHẠY LẠI ĐƯỢC NHIỀU LẦN: mỗi dòng Excel gắn một dấu [IMP:TD2026:...]
-- trong cột note/notes nên lần chạy sau không tạo bản ghi trùng.
-- Không dùng bảng tạm và không mở transaction thủ công: SQL Editor chạy
-- mỗi câu lệnh trong transaction riêng. Chạy các câu lệnh THEO THỨ TỰ.
-- Học viên trùng tên ở nhiều lớp được tạo thành hồ sơ RIÊNG (theo yêu cầu).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Chi nhánh Thủ Đức phải tồn tại (tạo ở migration 0026_branches.sql)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.branches where code = 'thuduc') then
    raise exception 'Chưa có chi nhánh Thủ Đức — chạy migration 0026_branches.sql trước.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Giáo viên (chỉ tạo khi chưa có hồ sơ giáo viên trùng tên)
-- ---------------------------------------------------------------------
insert into public.profiles (name, role, branch_id, note)
select t.name, 'teacher', (select id from public.branches where code = 'thuduc'),
       'Tạo từ import danh sách Thủ Đức 2026 — chưa có tài khoản đăng nhập.'
  from (values
    ('Cô Gia Hân'),
    ('Cô Mai Phương'),
    ('Cô Mai Thắm'),
    ('Cô Thu Thảo'),
    ('Cô Trúc Ly'),
    ('TS.NTT'),
    ('Thầy Huy Biên')
  ) as t(name)
 where not exists (
   select 1 from public.profiles p where p.role = 'teacher' and lower(p.name) = lower(t.name));

-- ---------------------------------------------------------------------
-- 2. Lớp học (35 lớp)
-- ---------------------------------------------------------------------
insert into public.classes (branch_id, name, teacher_id, status, start_date, notes)
select (select id from public.branches where code = 'thuduc'), c.name, t.id,
       c.status, c.start_date, c.notes || E'\n[IMP:TD2026:' || c.key || ']'
  from (values
    ('r3', 'HSK 1 · T2,T4 19:30', null, 'active', '2026-06-09'::date, 'Nhãn trong Excel: HSK 1 / T2 - 4 (19g30 - 21g)
Thời gian khoá: 9/6 - 17/9
Nguồn: Excel Thủ Đức 2026, dòng 3.'),
    ('r15', 'HSK3B', 'TS.NTT', 'active', '2026-06-15'::date, 'Nhãn trong Excel: HSK3B / T2,4 (19h30-21h00) / TS.NTT
Thời gian khoá: 15/06-28/09
Giáo viên ghi trong file: TS.NTT
Nguồn: Excel Thủ Đức 2026, dòng 15.'),
    ('r22', 'HSK 1 · T7,CN', null, 'active', null::date, 'Nhãn trong Excel: HSK 1 / T7 - CN
⚠ File không ghi giờ học — chưa tạo lịch tuần.
Nguồn: Excel Thủ Đức 2026, dòng 22.'),
    ('r23', 'PREKIDS', 'Cô Mai Phương', 'active', '2026-07-22'::date, 'Nhãn trong Excel: PREKIDS / T2,4 (17h30-19h00) / Cô Mai Phương
Thời gian khoá: 22/07-19/10
Giáo viên ghi trong file: Cô Mai Phương
Nguồn: Excel Thủ Đức 2026, dòng 23.'),
    ('r25', 'Lớp T2,T4 19:30', null, 'completed', '2026-05-13'::date, 'Nhãn trong Excel: T2 - 4 (19g30 - 21g)
Thời gian khoá: 13/5 -31/7
⚠ Tên lớp SUY ĐOÁN từ danh sách 2025 (khớp 100%) — cần kiểm tra lại.
Nguồn: Excel Thủ Đức 2026, dòng 25.'),
    ('r31', 'HSK1 · T2,T4 19:30', null, 'active', '2026-09-08'::date, 'Nhãn trong Excel: HSK1 / T2-T4 (19g30-21g00)
Thời gian khoá: 8/9 - 17/12
Nguồn: Excel Thủ Đức 2026, dòng 31.'),
    ('r33', 'GIAO TIẾP 3 Online', 'TS.NTT', 'active', '2026-06-08'::date, 'Nhãn trong Excel: GIAO TIẾP 3 Online / T3,5 (7h30-9h30) / TS.NTT
Thời gian khoá: 08/06-01/09  khoá mới tháng 10
Giáo viên ghi trong file: TS.NTT
Nguồn: Excel Thủ Đức 2026, dòng 33.'),
    ('r42', 'YCT 1 ONL', null, 'active', '2026-03-21'::date, 'Nhãn trong Excel: YCT 1 ONL / T2 - T4 (9g30 - 11g30)
Thời gian khoá: 46102
Nguồn: Excel Thủ Đức 2026, dòng 42.'),
    ('r52', 'YCT2 · T7,CN 13:00', null, 'active', null::date, 'Nhãn trong Excel: YCT2 / T7 - CN (13g-14g30)
Nguồn: Excel Thủ Đức 2026, dòng 52.'),
    ('r53', 'YCT OFF', null, 'active', '2026-06-10'::date, 'Nhãn trong Excel: YCT OFF / T3 - T5 (14g30 - 16g00)
Thời gian khoá: 10/6 - 18/9
Nguồn: Excel Thủ Đức 2026, dòng 53.'),
    ('r64', 'HSK1 · T7,CN 14:00 · Huy Biên', 'Thầy Huy Biên', 'active', '2026-08-22'::date, 'Nhãn trong Excel: HSK1 / T7,CN (14h00-15h30) / Thầy Huy Biên
Thời gian khoá: 22/08-14/11
Giáo viên ghi trong file: Thầy Huy Biên
Nguồn: Excel Thủ Đức 2026, dòng 64.'),
    ('r71', 'HSK2 ONL', null, 'active', null::date, 'Nhãn trong Excel: HSK2 ONL / T6-7 (19g30 - 21g30 và 20g30 - 22g30)
Nguồn: Excel Thủ Đức 2026, dòng 71.'),
    ('r81', 'YCT3 Online · T7 20:00 · Gia Hân', 'Cô Gia Hân', 'active', null::date, 'Nhãn trong Excel: YCT3 Online / T7 (20h00-21h30) / Cô Gia Hân
Giáo viên ghi trong file: Cô Gia Hân
Nguồn: Excel Thủ Đức 2026, dòng 81.'),
    ('r83', 'YCT3 Online · T6 20:00 · Gia Hân', 'Cô Gia Hân', 'active', '2026-06-26'::date, 'Nhãn trong Excel: YCT3 Online / T6 (20h00-21h30) / Cô Gia Hân
Thời gian khoá: 26/06-06/11
Giáo viên ghi trong file: Cô Gia Hân
Nguồn: Excel Thủ Đức 2026, dòng 83.'),
    ('r89', 'HSK 2 ONL · T7,CN 08:30 (dòng 89)', null, 'active', '2026-07-26'::date, 'Nhãn trong Excel: HSK 2 ONL / T7 - CN (8g30-10g)
Thời gian khoá: 26/7 - 2/11
Nguồn: Excel Thủ Đức 2026, dòng 89.'),
    ('r91', 'HSK 2 ONL · T7,CN 08:30 (dòng 91)', null, 'active', null::date, 'Nhãn trong Excel: HSK 2 ONL / T7 - CN (8g30-10g)
⚠ Tách ra từ ô gộp chung trong Excel, tên kế thừa lớp phía trên — cần kiểm tra lại.
Nguồn: Excel Thủ Đức 2026, dòng 91.'),
    ('r93', 'HSK 2 ONL · T7,CN 08:30 (dòng 93)', null, 'active', null::date, 'Nhãn trong Excel: HSK 2 ONL / T7 - CN (8g30-10g)
⚠ Tên lớp SUY ĐOÁN từ danh sách 2025 (khớp 69%) — cần kiểm tra lại.
Nguồn: Excel Thủ Đức 2026, dòng 93.'),
    ('r102', 'HSK4A Online', 'Cô Mai Thắm', 'active', '2026-07-12'::date, 'Nhãn trong Excel: HSK4A Online / T7,CN (8h30-10h00) / Cô Mai Thắm
Thời gian khoá: 12/07-04/10
Giáo viên ghi trong file: Cô Mai Thắm
Nguồn: Excel Thủ Đức 2026, dòng 102.'),
    ('r108', 'HSK3A OFF · dòng 108', null, 'active', '2026-06-26'::date, 'Nhãn trong Excel: HSK3A OFF
Thời gian khoá: 26/6 - 7/10
⚠ Tên lớp SUY ĐOÁN từ danh sách 2025 (khớp 58%) — cần kiểm tra lại.
Nguồn: Excel Thủ Đức 2026, dòng 108.'),
    ('r118', 'HSK4C · T2,T3 19:30 · Mai Thắm (dòng 118)', 'Cô Mai Thắm', 'active', '2026-08-03'::date, 'Nhãn trong Excel: HSK4C / T2 (19h30) T3 (18h00) / Cô Mai Thắm
Thời gian khoá: 03/08-07/12
Giáo viên ghi trong file: Cô Mai Thắm
Nguồn: Excel Thủ Đức 2026, dòng 118.'),
    ('r122', 'HSK3A OFF · T2,T4 17:30', null, 'active', null::date, 'Nhãn trong Excel: HSK3A OFF / T2-4(17g30 - 19g30)
⚠ Tên lớp SUY ĐOÁN từ danh sách 2025 (khớp 100%) — cần kiểm tra lại.
Nguồn: Excel Thủ Đức 2026, dòng 122.'),
    ('r127', 'HSK3B OFF', null, 'active', null::date, 'Nhãn trong Excel: HSK3B OFF / T3 - 5 (19g - 21g)
⚠ Tên lớp SUY ĐOÁN từ danh sách 2025 (khớp 100%) — cần kiểm tra lại.
Nguồn: Excel Thủ Đức 2026, dòng 127.'),
    ('r137', 'HSK4C · T2,T3 19:30 · Mai Thắm (dòng 137)', 'Cô Mai Thắm', 'active', null::date, 'Nhãn trong Excel: HSK4C / T2 (19h30) T3 (18h00) / Cô Mai Thắm
Giáo viên ghi trong file: Cô Mai Thắm
⚠ Tách ra từ ô gộp chung trong Excel, tên kế thừa lớp phía trên — cần kiểm tra lại.
Nguồn: Excel Thủ Đức 2026, dòng 137.'),
    ('r144', 'MC NHÍ', null, 'completed', '2026-06-13'::date, 'Nhãn trong Excel: MC NHÍ
Thời gian khoá: 13/6 - 1/8
Nguồn: Excel Thủ Đức 2026, dòng 144.'),
    ('r152', 'CME 5', null, 'active', '2026-07-22'::date, 'Nhãn trong Excel: CME 5 / T3 - 5 (17g30 - 19g)
Thời gian khoá: 22/7 - 4/11 (ghi cả thời gian học vào phiếu thu)
Nguồn: Excel Thủ Đức 2026, dòng 152.'),
    ('r154', 'CME 6', null, 'active', null::date, 'Nhãn trong Excel: CME 6 / T3-5 (17g30-19g)
⚠ Tên lớp SUY ĐOÁN từ danh sách 2025 (khớp 100%) — cần kiểm tra lại.
Nguồn: Excel Thủ Đức 2026, dòng 154.'),
    ('r164', 'YCT4 Online', 'Cô Mai Thắm', 'active', '2026-06-21'::date, 'Nhãn trong Excel: YCT4 Online / T7,CN (10h00-11h30) / Cô Mai Thắm
Thời gian khoá: 21/06-13/09  khoá mới 11/10
Giáo viên ghi trong file: Cô Mai Thắm
Nguồn: Excel Thủ Đức 2026, dòng 164.'),
    ('r168', 'HSK3A', 'Cô Mai Thắm', 'completed', '2026-06-02'::date, 'Nhãn trong Excel: HSK3A / T3,5 (19h30-21h00) / Cô Mai Thắm
Thời gian khoá: 02/06-25/08 khoá mới 15/09
Giáo viên ghi trong file: Cô Mai Thắm
Nguồn: Excel Thủ Đức 2026, dòng 168.'),
    ('r175', 'YCT1', 'Cô Mai Thắm', 'completed', '2026-05-04'::date, 'Nhãn trong Excel: YCT1 / T2,4 (18h00-19h30) / Cô Mai Thắm
Thời gian khoá: 04/05-12/08  khoá mới 16/09
Giáo viên ghi trong file: Cô Mai Thắm
Nguồn: Excel Thủ Đức 2026, dòng 175.'),
    ('r179', 'HSK1, HSK2, HSK3', 'Cô Mai Thắm', 'active', '2026-05-07'::date, 'Nhãn trong Excel: HSK1, HSK2, HSK3 / T5, T7 (18h00-19h30) / Cô Mai Thắm
Thời gian khoá: 07/05/26-20/03/27
Giáo viên ghi trong file: Cô Mai Thắm
Nguồn: Excel Thủ Đức 2026, dòng 179.'),
    ('r186', 'Giao Tiếp 1:1', 'Cô Mai Thắm', 'active', '2026-05-20'::date, 'Nhãn trong Excel: Giao Tiếp 1:1 / T4,6 (7h00-8h30) / Cô Mai Thắm
Thời gian khoá: 20/05-23/09
Giáo viên ghi trong file: Cô Mai Thắm
Nguồn: Excel Thủ Đức 2026, dòng 186.'),
    ('r187', 'HSK1 · T7,CN 19:30 · Mai Thắm', 'Cô Mai Thắm', 'active', '2026-06-27'::date, 'Nhãn trong Excel: HSK1 / T7 (19h30-21h00) / CN (15h00-16h30) / Cô Mai Thắm
Thời gian khoá: 27/06-19/09
Giáo viên ghi trong file: Cô Mai Thắm
Nguồn: Excel Thủ Đức 2026, dòng 187.'),
    ('r193', 'HSK1 · T2,T4 19:30 · Trúc Ly', 'Cô Trúc Ly', 'active', '2026-06-15'::date, 'Nhãn trong Excel: HSK1 / T2,4 (19h30-21h00) / Cô Trúc Ly
Thời gian khoá: 15/06-09/09  dự kiến 31/8 hết khoá
Giáo viên ghi trong file: Cô Trúc Ly
Nguồn: Excel Thủ Đức 2026, dòng 193.'),
    ('r199', 'YCT2 · T4,T5 18:00 · Thu Thảo', 'Cô Thu Thảo', 'active', '2026-07-22'::date, 'Nhãn trong Excel: YCT2 / T4 (18h00-19h00) / T5 (17h00-18h00) / Cô Thu Thảo
Thời gian khoá: 22/07-21/10
Giáo viên ghi trong file: Cô Thu Thảo
Nguồn: Excel Thủ Đức 2026, dòng 199.'),
    ('r200', 'HSK1 · T7,CN 17:30 · Trúc Ly', 'Cô Trúc Ly', 'active', '2026-07-27'::date, 'Nhãn trong Excel: HSK1 / T7,CN (17h30-19h00) / Cô Trúc Ly
Thời gian khoá: 27/07-21/10
Giáo viên ghi trong file: Cô Trúc Ly
Nguồn: Excel Thủ Đức 2026, dòng 200.')
  ) as c(key, name, teacher, status, start_date, notes)
  left join public.profiles t on t.role = 'teacher' and lower(t.name) = lower(c.teacher)
 where not exists (
   select 1 from public.classes x where x.notes like '%[IMP:TD2026:' || c.key || ']%');

-- ---------------------------------------------------------------------
-- 3. Lịch học hằng tuần (0 = Chủ nhật, 1 = Thứ 2 ...)
-- ---------------------------------------------------------------------
insert into public.class_schedules (class_id, weekday, start_time, end_time)
select cl.id, s.weekday, s.start_time, s.end_time
  from (values
    ('r3', 1::smallint, '19:30'::time, '21:00'::time),
    ('r3', 3::smallint, '19:30'::time, '21:00'::time),
    ('r15', 1::smallint, '19:30'::time, '21:00'::time),
    ('r15', 3::smallint, '19:30'::time, '21:00'::time),
    ('r23', 1::smallint, '17:30'::time, '19:00'::time),
    ('r23', 3::smallint, '17:30'::time, '19:00'::time),
    ('r25', 1::smallint, '19:30'::time, '21:00'::time),
    ('r25', 3::smallint, '19:30'::time, '21:00'::time),
    ('r31', 1::smallint, '19:30'::time, '21:00'::time),
    ('r31', 3::smallint, '19:30'::time, '21:00'::time),
    ('r33', 2::smallint, '07:30'::time, '09:30'::time),
    ('r33', 4::smallint, '07:30'::time, '09:30'::time),
    ('r42', 1::smallint, '09:30'::time, '11:30'::time),
    ('r42', 3::smallint, '09:30'::time, '11:30'::time),
    ('r52', 6::smallint, '13:00'::time, '14:30'::time),
    ('r52', 0::smallint, '13:00'::time, '14:30'::time),
    ('r53', 2::smallint, '14:30'::time, '16:00'::time),
    ('r53', 4::smallint, '14:30'::time, '16:00'::time),
    ('r64', 6::smallint, '14:00'::time, '15:30'::time),
    ('r64', 0::smallint, '14:00'::time, '15:30'::time),
    ('r71', 5::smallint, '19:30'::time, '21:30'::time),
    ('r71', 6::smallint, '20:30'::time, '22:30'::time),
    ('r81', 6::smallint, '20:00'::time, '21:30'::time),
    ('r83', 5::smallint, '20:00'::time, '21:30'::time),
    ('r89', 6::smallint, '08:30'::time, '10:00'::time),
    ('r89', 0::smallint, '08:30'::time, '10:00'::time),
    ('r91', 6::smallint, '08:30'::time, '10:00'::time),
    ('r91', 0::smallint, '08:30'::time, '10:00'::time),
    ('r93', 6::smallint, '08:30'::time, '10:00'::time),
    ('r93', 0::smallint, '08:30'::time, '10:00'::time),
    ('r102', 6::smallint, '08:30'::time, '10:00'::time),
    ('r102', 0::smallint, '08:30'::time, '10:00'::time),
    ('r118', 1::smallint, '19:30'::time, '21:00'::time),
    ('r118', 2::smallint, '18:00'::time, '19:30'::time),
    ('r122', 1::smallint, '17:30'::time, '19:30'::time),
    ('r122', 3::smallint, '17:30'::time, '19:30'::time),
    ('r127', 2::smallint, '19:00'::time, '21:00'::time),
    ('r127', 4::smallint, '19:00'::time, '21:00'::time),
    ('r137', 1::smallint, '19:30'::time, '21:00'::time),
    ('r137', 2::smallint, '18:00'::time, '19:30'::time),
    ('r152', 2::smallint, '17:30'::time, '19:00'::time),
    ('r152', 4::smallint, '17:30'::time, '19:00'::time),
    ('r154', 2::smallint, '17:30'::time, '19:00'::time),
    ('r154', 4::smallint, '17:30'::time, '19:00'::time),
    ('r164', 6::smallint, '10:00'::time, '11:30'::time),
    ('r164', 0::smallint, '10:00'::time, '11:30'::time),
    ('r168', 2::smallint, '19:30'::time, '21:00'::time),
    ('r168', 4::smallint, '19:30'::time, '21:00'::time),
    ('r175', 1::smallint, '18:00'::time, '19:30'::time),
    ('r175', 3::smallint, '18:00'::time, '19:30'::time),
    ('r179', 4::smallint, '18:00'::time, '19:30'::time),
    ('r179', 6::smallint, '18:00'::time, '19:30'::time),
    ('r186', 3::smallint, '07:00'::time, '08:30'::time),
    ('r186', 5::smallint, '07:00'::time, '08:30'::time),
    ('r187', 6::smallint, '19:30'::time, '21:00'::time),
    ('r187', 0::smallint, '15:00'::time, '16:30'::time),
    ('r193', 1::smallint, '19:30'::time, '21:00'::time),
    ('r193', 3::smallint, '19:30'::time, '21:00'::time),
    ('r199', 3::smallint, '18:00'::time, '19:00'::time),
    ('r199', 4::smallint, '17:00'::time, '18:00'::time),
    ('r200', 6::smallint, '17:30'::time, '19:00'::time),
    ('r200', 0::smallint, '17:30'::time, '19:00'::time)
  ) as s(key, weekday, start_time, end_time)
  join public.classes cl on cl.notes like '%[IMP:TD2026:' || s.key || ']%'
 where not exists (
   select 1 from public.class_schedules cs
    where cs.class_id = cl.id and cs.weekday = s.weekday and cs.start_time = s.start_time);

-- ---------------------------------------------------------------------
-- 4. Học viên (203 hồ sơ — mã HVKAT do trigger tự cấp)
-- ---------------------------------------------------------------------
insert into public.profiles (name, role, branch_id, note)
select s.name, 'student', (select id from public.branches where code = 'thuduc'),
       s.note || E'\n[IMP:TD2026:' || s.key || ']'
  from (values
    ('s3', 'Phương Quỳnh', 'Nguồn: Excel Thủ Đức 2026, dòng 3 (lớp HSK 1 · T2,T4 19:30).'),
    ('s4', 'Ngọc Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 4 (lớp HSK 1 · T2,T4 19:30).'),
    ('s5', 'Bảo Hân', 'Nguồn: Excel Thủ Đức 2026, dòng 5 (lớp HSK 1 · T2,T4 19:30).'),
    ('s6', 'Linh Giang', 'Nguồn: Excel Thủ Đức 2026, dòng 6 (lớp HSK 1 · T2,T4 19:30).'),
    ('s7', 'Phương Như', 'Nguồn: Excel Thủ Đức 2026, dòng 7 (lớp HSK 1 · T2,T4 19:30).'),
    ('s8', 'Diệu An', 'Nguồn: Excel Thủ Đức 2026, dòng 8 (lớp HSK 1 · T2,T4 19:30).'),
    ('s9', 'Hoàng Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 9 (lớp HSK 1 · T2,T4 19:30).'),
    ('s10', 'Diệu Huyền', 'Nguồn: Excel Thủ Đức 2026, dòng 10 (lớp HSK 1 · T2,T4 19:30).'),
    ('s11', 'Ngọc Duyên', 'Nguồn: Excel Thủ Đức 2026, dòng 11 (lớp HSK 1 · T2,T4 19:30).'),
    ('s12', 'Thảo Vy', 'Nguồn: Excel Thủ Đức 2026, dòng 12 (lớp HSK 1 · T2,T4 19:30).'),
    ('s13', 'Thảo Vân', 'Nguồn: Excel Thủ Đức 2026, dòng 13 (lớp HSK 1 · T2,T4 19:30).'),
    ('s14', 'Thanh Thương', 'Nguồn: Excel Thủ Đức 2026, dòng 14 (lớp HSK 1 · T2,T4 19:30).'),
    ('s15', 'Lê Thị Ngọc Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 15 (lớp HSK3B).'),
    ('s16', 'Trần Bảo Hân', 'Nguồn: Excel Thủ Đức 2026, dòng 16 (lớp HSK3B).'),
    ('s17', 'Phan Nguyễn Phương Như', 'Nguồn: Excel Thủ Đức 2026, dòng 17 (lớp HSK3B).'),
    ('s18', 'Lê Nguyễn Diệu An', 'Nguồn: Excel Thủ Đức 2026, dòng 18 (lớp HSK3B).'),
    ('s19', 'Hoàng Diệu Huyền', 'Nguồn: Excel Thủ Đức 2026, dòng 19 (lớp HSK3B).'),
    ('s20', 'Ngọc Duyên', 'Nguồn: Excel Thủ Đức 2026, dòng 20 (lớp HSK3B).'),
    ('s21', 'Nguyễn Trương Thảo Vy', 'Nguồn: Excel Thủ Đức 2026, dòng 21 (lớp HSK3B).'),
    ('s22', 'Phương Linh', 'Nguồn: Excel Thủ Đức 2026, dòng 22 (lớp HSK 1 · T7,CN).'),
    ('s23', 'Đăng Khoa', 'Nguồn: Excel Thủ Đức 2026, dòng 23 (lớp PREKIDS).'),
    ('s24', 'Đăng Khôi', 'Nguồn: Excel Thủ Đức 2026, dòng 24 (lớp PREKIDS).'),
    ('s25', 'Thanh Thương', 'Nguồn: Excel Thủ Đức 2026, dòng 25 (lớp Lớp T2,T4 19:30).'),
    ('s26', 'Vân Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 26 (lớp Lớp T2,T4 19:30).'),
    ('s27', 'Ngọc Duyên', 'Nguồn: Excel Thủ Đức 2026, dòng 27 (lớp Lớp T2,T4 19:30).'),
    ('s28', 'Thùy Trang', 'Nguồn: Excel Thủ Đức 2026, dòng 28 (lớp Lớp T2,T4 19:30).'),
    ('s29', 'Thảo Vân', 'Nguồn: Excel Thủ Đức 2026, dòng 29 (lớp Lớp T2,T4 19:30).'),
    ('s30', 'Ninh An', 'Nguồn: Excel Thủ Đức 2026, dòng 30 (lớp Lớp T2,T4 19:30).'),
    ('s31', 'Trần Thị Ánh Vân', 'Nguồn: Excel Thủ Đức 2026, dòng 31 (lớp HSK1 · T2,T4 19:30).'),
    ('s32', 'Trọng Bảo', 'Nguồn: Excel Thủ Đức 2026, dòng 32 (lớp HSK1 · T2,T4 19:30).'),
    ('s33', 'Thuận Lê', 'Nguồn: Excel Thủ Đức 2026, dòng 33 (lớp GIAO TIẾP 3 Online).'),
    ('s34', 'Hảo Lê', 'Nguồn: Excel Thủ Đức 2026, dòng 34 (lớp GIAO TIẾP 3 Online).'),
    ('s35', 'Hoàng Lê', 'Nguồn: Excel Thủ Đức 2026, dòng 35 (lớp GIAO TIẾP 3 Online).'),
    ('s36', 'Huỳnh Nguyễn', 'Nguồn: Excel Thủ Đức 2026, dòng 36 (lớp GIAO TIẾP 3 Online).'),
    ('s37', 'Minh Trang', 'Nguồn: Excel Thủ Đức 2026, dòng 37 (lớp GIAO TIẾP 3 Online).'),
    ('s38', 'Nguyễn Hoàng', 'Nguồn: Excel Thủ Đức 2026, dòng 38 (lớp GIAO TIẾP 3 Online).'),
    ('s39', 'Bình Đặng', 'Nguồn: Excel Thủ Đức 2026, dòng 39 (lớp GIAO TIẾP 3 Online).'),
    ('s40', 'Minh Phụng', 'Nguồn: Excel Thủ Đức 2026, dòng 40 (lớp GIAO TIẾP 3 Online).'),
    ('s41', 'Ngọc Trâm', 'Nguồn: Excel Thủ Đức 2026, dòng 41 (lớp GIAO TIẾP 3 Online).'),
    ('s42', 'Tâm Như', 'Nguồn: Excel Thủ Đức 2026, dòng 42 (lớp YCT 1 ONL).'),
    ('s43', 'Minh Khuê', 'Nguồn: Excel Thủ Đức 2026, dòng 43 (lớp YCT 1 ONL).'),
    ('s44', 'Đức Hoàng', 'Nguồn: Excel Thủ Đức 2026, dòng 44 (lớp YCT 1 ONL).'),
    ('s45', 'Minh Khôi', 'Nguồn: Excel Thủ Đức 2026, dòng 45 (lớp YCT 1 ONL).'),
    ('s46', 'Minh Châu', 'Nguồn: Excel Thủ Đức 2026, dòng 46 (lớp YCT 1 ONL).'),
    ('s47', 'Lam Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 47 (lớp YCT 1 ONL).'),
    ('s48', 'Kỳ Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 48 (lớp YCT 1 ONL).'),
    ('s49', 'Hồng Phúc', 'Nguồn: Excel Thủ Đức 2026, dòng 49 (lớp YCT 1 ONL).'),
    ('s50', 'Nhã Uyên', 'Nguồn: Excel Thủ Đức 2026, dòng 50 (lớp YCT 1 ONL).'),
    ('s51', 'Thế Phong', 'Nguồn: Excel Thủ Đức 2026, dòng 51 (lớp YCT 1 ONL).'),
    ('s52', 'Minh Châu', 'Nguồn: Excel Thủ Đức 2026, dòng 52 (lớp YCT2 · T7,CN 13:00).'),
    ('s53', 'Đinh Thanh Thảo', 'Nguồn: Excel Thủ Đức 2026, dòng 53 (lớp YCT OFF).'),
    ('s54', 'Nguyễn Phúc Khả Hân', 'Nguồn: Excel Thủ Đức 2026, dòng 54 (lớp YCT OFF).'),
    ('s55', 'Nguyễn Phúc Khải Minh', 'Nguồn: Excel Thủ Đức 2026, dòng 55 (lớp YCT OFF).'),
    ('s56', 'An Nhiên', 'Nguồn: Excel Thủ Đức 2026, dòng 56 (lớp YCT OFF).'),
    ('s57', 'Hoàng Nam', 'Nguồn: Excel Thủ Đức 2026, dòng 57 (lớp YCT OFF).'),
    ('s58', 'Nguyễn Thuỳ Dương', 'Nguồn: Excel Thủ Đức 2026, dòng 58 (lớp YCT OFF).'),
    ('s59', 'Hồng Lĩnh', 'Nguồn: Excel Thủ Đức 2026, dòng 59 (lớp YCT OFF).'),
    ('s60', 'My An', 'Nguồn: Excel Thủ Đức 2026, dòng 60 (lớp YCT OFF).'),
    ('s61', 'Hoàng Diệu Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 61 (lớp YCT OFF).'),
    ('s62', 'Nguyễn Quốc Phong', 'Nguồn: Excel Thủ Đức 2026, dòng 62 (lớp YCT OFF).'),
    ('s63', 'Phạm Mỹ Linh', 'Nguồn: Excel Thủ Đức 2026, dòng 63 (lớp YCT OFF).'),
    ('s64', 'Nguyễn Thuỳ Dương', 'Nguồn: Excel Thủ Đức 2026, dòng 64 (lớp HSK1 · T7,CN 14:00 · Huy Biên).'),
    ('s65', 'Hoàng Diệu Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 65 (lớp HSK1 · T7,CN 14:00 · Huy Biên).'),
    ('s66', 'Nguyễn Quốc Phong', 'Nguồn: Excel Thủ Đức 2026, dòng 66 (lớp HSK1 · T7,CN 14:00 · Huy Biên).'),
    ('s67', 'Gia Linh', 'Nguồn: Excel Thủ Đức 2026, dòng 67 (lớp HSK1 · T7,CN 14:00 · Huy Biên).'),
    ('s68', 'Quỳnh Nhi', 'Nguồn: Excel Thủ Đức 2026, dòng 68 (lớp HSK1 · T7,CN 14:00 · Huy Biên).'),
    ('s69', 'Lê Ngọc Lam Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 69 (lớp HSK1 · T7,CN 14:00 · Huy Biên).'),
    ('s70', 'Lê Ngọc Minh Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 70 (lớp HSK1 · T7,CN 14:00 · Huy Biên).'),
    ('s71', 'Dương Xuân Uyên', 'Nguồn: Excel Thủ Đức 2026, dòng 71 (lớp HSK2 ONL).'),
    ('s72', 'Phạm Trung Huy', 'Nguồn: Excel Thủ Đức 2026, dòng 72 (lớp HSK2 ONL).'),
    ('s73', 'Huỳnh Bùi Bảo Di', 'Nguồn: Excel Thủ Đức 2026, dòng 73 (lớp HSK2 ONL).'),
    ('s74', 'Trần Nhật Quỳnh Lan', 'Nguồn: Excel Thủ Đức 2026, dòng 74 (lớp HSK2 ONL).'),
    ('s75', 'Trần Phương Linh', 'Nguồn: Excel Thủ Đức 2026, dòng 75 (lớp HSK2 ONL).'),
    ('s76', 'Hồ Nguyễn Uyên Nhi', 'Nguồn: Excel Thủ Đức 2026, dòng 76 (lớp HSK2 ONL).'),
    ('s77', 'Mai Thanh Ngọc', 'Nguồn: Excel Thủ Đức 2026, dòng 77 (lớp HSK2 ONL).'),
    ('s78', 'Hoàng Bách', 'Nguồn: Excel Thủ Đức 2026, dòng 78 (lớp HSK2 ONL).'),
    ('s79', 'Băng Giang', 'Nguồn: Excel Thủ Đức 2026, dòng 79 (lớp HSK2 ONL).'),
    ('s80', 'Phúc Nguyên', 'Nguồn: Excel Thủ Đức 2026, dòng 80 (lớp HSK2 ONL).'),
    ('s81', 'Mai Thanh Ngọc', 'Nguồn: Excel Thủ Đức 2026, dòng 81 (lớp YCT3 Online · T7 20:00 · Gia Hân).'),
    ('s82', 'Hoàng Bách', 'Ghi chú trong Excel: 27/06-07/11
Nguồn: Excel Thủ Đức 2026, dòng 82 (lớp YCT3 Online · T7 20:00 · Gia Hân).'),
    ('s83', 'Hồ Nguyễn Uyên Nhi', 'Nguồn: Excel Thủ Đức 2026, dòng 83 (lớp YCT3 Online · T6 20:00 · Gia Hân).'),
    ('s84', 'Mai Thanh Ngọc', 'Nguồn: Excel Thủ Đức 2026, dòng 84 (lớp YCT3 Online · T6 20:00 · Gia Hân).'),
    ('s85', 'Phạm Trung Huy', 'Nguồn: Excel Thủ Đức 2026, dòng 85 (lớp YCT3 Online · T6 20:00 · Gia Hân).'),
    ('s86', 'Huỳnh Bùi Bảo Di', 'Nguồn: Excel Thủ Đức 2026, dòng 86 (lớp YCT3 Online · T6 20:00 · Gia Hân).'),
    ('s87', 'Băng Giang', 'Nguồn: Excel Thủ Đức 2026, dòng 87 (lớp YCT3 Online · T6 20:00 · Gia Hân).'),
    ('s88', 'Nguyễn Ngọc Khánh', 'Nguồn: Excel Thủ Đức 2026, dòng 88 (lớp YCT3 Online · T6 20:00 · Gia Hân).'),
    ('s89', 'Nguyễn Thị Thuận Ninh', 'Nguồn: Excel Thủ Đức 2026, dòng 89 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 89)).'),
    ('s90', 'Trường Giang', 'Nguồn: Excel Thủ Đức 2026, dòng 90 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 89)).'),
    ('s91', 'Minh Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 91 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 91)).'),
    ('s92', 'Minh Trí', 'Nguồn: Excel Thủ Đức 2026, dòng 92 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 91)).'),
    ('s93', 'Bích Liên', 'Nguồn: Excel Thủ Đức 2026, dòng 93 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 93)).'),
    ('s94', 'Thảo Nguyên', 'Nguồn: Excel Thủ Đức 2026, dòng 94 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 93)).'),
    ('s95', 'Anh Khuê', 'Nguồn: Excel Thủ Đức 2026, dòng 95 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 93)).'),
    ('s96', 'Dương Ngọc Quỳnh Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 96 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 93)).'),
    ('s97', 'Gia Huy', 'Nguồn: Excel Thủ Đức 2026, dòng 97 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 93)).'),
    ('s98', 'Khánh Tân', 'Nguồn: Excel Thủ Đức 2026, dòng 98 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 93)).'),
    ('s99', 'Khánh Huyền', 'Nguồn: Excel Thủ Đức 2026, dòng 99 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 93)).'),
    ('s100', 'Nguyễn Ngọc Khánh', 'Nguồn: Excel Thủ Đức 2026, dòng 100 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 93)).'),
    ('s101', 'Vũ Bảo Quyên', 'Nguồn: Excel Thủ Đức 2026, dòng 101 (lớp HSK 2 ONL · T7,CN 08:30 (dòng 93)).'),
    ('s102', 'Anh Khuê', 'Nguồn: Excel Thủ Đức 2026, dòng 102 (lớp HSK4A Online).'),
    ('s103', 'Dương Uyên Nhi', 'Nguồn: Excel Thủ Đức 2026, dòng 103 (lớp HSK4A Online).'),
    ('s104', 'Bảo Ngọc', 'Nguồn: Excel Thủ Đức 2026, dòng 104 (lớp HSK4A Online).'),
    ('s105', 'Vũ Bảo Quyên', 'Nguồn: Excel Thủ Đức 2026, dòng 105 (lớp HSK4A Online).'),
    ('s106', 'Lai Bảo Trân', 'Nguồn: Excel Thủ Đức 2026, dòng 106 (lớp HSK4A Online).'),
    ('s107', 'Lai Bảo San', 'Nguồn: Excel Thủ Đức 2026, dòng 107 (lớp HSK4A Online).'),
    ('s108', 'Đỗ Lê Đức Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 108 (lớp HSK3A OFF · dòng 108).'),
    ('s109', 'Nguyễn Thị Kim Tiền', 'Nguồn: Excel Thủ Đức 2026, dòng 109 (lớp HSK3A OFF · dòng 108).'),
    ('s110', 'Đoàn Gia Bảo Ngọc', 'Nguồn: Excel Thủ Đức 2026, dòng 110 (lớp HSK3A OFF · dòng 108).'),
    ('s111', 'Nguyễn Thị Yến Nhi', 'Nguồn: Excel Thủ Đức 2026, dòng 111 (lớp HSK3A OFF · dòng 108).'),
    ('s112', 'Nguyễn Hoàng Ngọc', 'Nguồn: Excel Thủ Đức 2026, dòng 112 (lớp HSK3A OFF · dòng 108).'),
    ('s113', 'Đỗ Doãn Thanh Vy', 'Nguồn: Excel Thủ Đức 2026, dòng 113 (lớp HSK3A OFF · dòng 108).'),
    ('s114', 'Kiều Trần Gia Hân', 'Nguồn: Excel Thủ Đức 2026, dòng 114 (lớp HSK3A OFF · dòng 108).'),
    ('s115', 'Nguyễn Dương Mai Thi', 'Nguồn: Excel Thủ Đức 2026, dòng 115 (lớp HSK3A OFF · dòng 108).'),
    ('s116', 'Tăng Khánh Long', 'Nguồn: Excel Thủ Đức 2026, dòng 116 (lớp HSK3A OFF · dòng 108).'),
    ('s117', 'Vi Hiền', 'Nguồn: Excel Thủ Đức 2026, dòng 117 (lớp HSK3A OFF · dòng 108).'),
    ('s118', 'Nguyễn Thị Yến Nhi', 'Nguồn: Excel Thủ Đức 2026, dòng 118 (lớp HSK4C · T2,T3 19:30 · Mai Thắm (dòng 118)).'),
    ('s119', 'Khánh Long', 'Nguồn: Excel Thủ Đức 2026, dòng 119 (lớp HSK4C · T2,T3 19:30 · Mai Thắm (dòng 118)).'),
    ('s120', 'Nguyễn Hoàng Ngọc', 'Nguồn: Excel Thủ Đức 2026, dòng 120 (lớp HSK4C · T2,T3 19:30 · Mai Thắm (dòng 118)).'),
    ('s121', 'Đức Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 121 (lớp HSK4C · T2,T3 19:30 · Mai Thắm (dòng 118)).'),
    ('s122', 'Lê Văn Lập', 'Nguồn: Excel Thủ Đức 2026, dòng 122 (lớp HSK3A OFF · T2,T4 17:30).'),
    ('s123', 'Võ Khánh Linh', 'Nguồn: Excel Thủ Đức 2026, dòng 123 (lớp HSK3A OFF · T2,T4 17:30).'),
    ('s124', 'Ngô Kim Ngọc', 'Nguồn: Excel Thủ Đức 2026, dòng 124 (lớp HSK3A OFF · T2,T4 17:30).'),
    ('s125', 'Tô Đào Khánh Linh', 'Nguồn: Excel Thủ Đức 2026, dòng 125 (lớp HSK3A OFF · T2,T4 17:30).'),
    ('s126', 'Bùi Thị Bích Yến', 'Nguồn: Excel Thủ Đức 2026, dòng 126 (lớp HSK3A OFF · T2,T4 17:30).'),
    ('s127', 'Nguyễn Ngọc Hậu', 'Nguồn: Excel Thủ Đức 2026, dòng 127 (lớp HSK3B OFF).'),
    ('s128', 'Cao Thị Thùy Vy', 'Nguồn: Excel Thủ Đức 2026, dòng 128 (lớp HSK3B OFF).'),
    ('s129', 'Trần Thị Kim Ngân', 'Nguồn: Excel Thủ Đức 2026, dòng 129 (lớp HSK3B OFF).'),
    ('s130', 'Hoàng Nguyễn Đức Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 130 (lớp HSK3B OFF).'),
    ('s131', 'Nguyễn Đỗ Uyên Nhi', 'Nguồn: Excel Thủ Đức 2026, dòng 131 (lớp HSK3B OFF).'),
    ('s132', 'Đỗ Thị Bảo Uyên', 'Nguồn: Excel Thủ Đức 2026, dòng 132 (lớp HSK3B OFF).'),
    ('s133', 'Trần Khánh Uyên', 'Nguồn: Excel Thủ Đức 2026, dòng 133 (lớp HSK3B OFF).'),
    ('s134', 'Minh Nguyên', 'Nguồn: Excel Thủ Đức 2026, dòng 134 (lớp HSK3B OFF).'),
    ('s135', 'Mỹ Ngọc', 'Nguồn: Excel Thủ Đức 2026, dòng 135 (lớp HSK3B OFF).'),
    ('s136', 'Trà My', 'Nguồn: Excel Thủ Đức 2026, dòng 136 (lớp HSK3B OFF).'),
    ('s137', 'Hoàng Nguyễn Đức Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 137 (lớp HSK4C · T2,T3 19:30 · Mai Thắm (dòng 137)).'),
    ('s138', 'Chung Mỹ Ngọc', 'Nguồn: Excel Thủ Đức 2026, dòng 138 (lớp HSK4C · T2,T3 19:30 · Mai Thắm (dòng 137)).'),
    ('s139', 'Trần Hồ Kim Thoa', 'Nguồn: Excel Thủ Đức 2026, dòng 139 (lớp HSK4C · T2,T3 19:30 · Mai Thắm (dòng 137)).'),
    ('s140', 'Tô Đào Khánh Linh', 'Nguồn: Excel Thủ Đức 2026, dòng 140 (lớp HSK4C · T2,T3 19:30 · Mai Thắm (dòng 137)).'),
    ('s141', 'Nguyễn Đỗ Uyên Nhi', 'Nguồn: Excel Thủ Đức 2026, dòng 141 (lớp HSK4C · T2,T3 19:30 · Mai Thắm (dòng 137)).'),
    ('s142', 'Kiều Trần Gia Hân', 'Nguồn: Excel Thủ Đức 2026, dòng 142 (lớp HSK4C · T2,T3 19:30 · Mai Thắm (dòng 137)).'),
    ('s143', 'Lê Đình Nguyên', 'Nguồn: Excel Thủ Đức 2026, dòng 143 (lớp HSK4C · T2,T3 19:30 · Mai Thắm (dòng 137)).'),
    ('s144', 'Phương Vy', 'Nguồn: Excel Thủ Đức 2026, dòng 144 (lớp MC NHÍ).'),
    ('s145', 'Nhã An', 'Nguồn: Excel Thủ Đức 2026, dòng 145 (lớp MC NHÍ).'),
    ('s146', 'Vinh Quang', 'Nguồn: Excel Thủ Đức 2026, dòng 146 (lớp MC NHÍ).'),
    ('s147', 'Quang Vinh', 'Nguồn: Excel Thủ Đức 2026, dòng 147 (lớp MC NHÍ).'),
    ('s148', 'Thanh Phương', 'Nguồn: Excel Thủ Đức 2026, dòng 148 (lớp MC NHÍ).'),
    ('s149', 'Hoàng Nam', 'Nguồn: Excel Thủ Đức 2026, dòng 149 (lớp MC NHÍ).'),
    ('s150', 'Nhật Minh', 'Nguồn: Excel Thủ Đức 2026, dòng 150 (lớp MC NHÍ).'),
    ('s151', 'Ngọc Thư', 'Nguồn: Excel Thủ Đức 2026, dòng 151 (lớp MC NHÍ).'),
    ('s152', 'Nhật Tuệ', 'Nguồn: Excel Thủ Đức 2026, dòng 152 (lớp CME 5).'),
    ('s153', 'Nhật Tiên', 'Nguồn: Excel Thủ Đức 2026, dòng 153 (lớp CME 5).'),
    ('s154', 'Lam Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 154 (lớp CME 6).'),
    ('s155', 'Minh Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 155 (lớp CME 6).'),
    ('s156', 'Quỳnh Nhi', 'Nguồn: Excel Thủ Đức 2026, dòng 156 (lớp CME 6).'),
    ('s157', 'Nhã Trân', 'Nguồn: Excel Thủ Đức 2026, dòng 157 (lớp CME 6).'),
    ('s158', 'Nhất Mạnh', 'Nguồn: Excel Thủ Đức 2026, dòng 158 (lớp CME 6).'),
    ('s159', 'Hoàng Quân', 'Nguồn: Excel Thủ Đức 2026, dòng 159 (lớp CME 6).'),
    ('s160', 'Gia Linh', 'Nguồn: Excel Thủ Đức 2026, dòng 160 (lớp CME 6).'),
    ('s161', 'Thuỳ Quyên', 'Nguồn: Excel Thủ Đức 2026, dòng 161 (lớp CME 6).'),
    ('s162', 'Nhã An', 'Nguồn: Excel Thủ Đức 2026, dòng 162 (lớp CME 6).'),
    ('s163', 'Phương Vy', 'Nguồn: Excel Thủ Đức 2026, dòng 163 (lớp CME 6).'),
    ('s164', 'Đức Hoàng', 'Nguồn: Excel Thủ Đức 2026, dòng 164 (lớp YCT4 Online).'),
    ('s165', 'Minh Khôi', 'Nguồn: Excel Thủ Đức 2026, dòng 165 (lớp YCT4 Online).'),
    ('s166', 'Thế Phong', 'Nguồn: Excel Thủ Đức 2026, dòng 166 (lớp YCT4 Online).'),
    ('s167', 'Bùi Linh Chi', 'Nguồn: Excel Thủ Đức 2026, dòng 167 (lớp YCT4 Online).'),
    ('s168', 'Nguyễn Võ Hoàng Trang', 'Nguồn: Excel Thủ Đức 2026, dòng 168 (lớp HSK3A).'),
    ('s169', 'Quân', 'Nguồn: Excel Thủ Đức 2026, dòng 169 (lớp HSK3A).'),
    ('s170', 'Võ Trịnh Phương Quỳnh', 'Nguồn: Excel Thủ Đức 2026, dòng 170 (lớp HSK3A).'),
    ('s171', 'Phương Thị Yến Nhi', 'Nguồn: Excel Thủ Đức 2026, dòng 171 (lớp HSK3A).'),
    ('s172', 'Lê Thúy Ngân', 'Nguồn: Excel Thủ Đức 2026, dòng 172 (lớp HSK3A).'),
    ('s173', 'Gia Nghi', 'Nguồn: Excel Thủ Đức 2026, dòng 173 (lớp HSK3A).'),
    ('s174', 'Phương Linh', 'Nguồn: Excel Thủ Đức 2026, dòng 174 (lớp HSK3A).'),
    ('s175', 'Nguyễn Trần Ngọc Hữu', 'Nguồn: Excel Thủ Đức 2026, dòng 175 (lớp YCT1).'),
    ('s176', 'Nguyễn Trần Ngọc Huyền', 'Nguồn: Excel Thủ Đức 2026, dòng 176 (lớp YCT1).'),
    ('s177', 'Mai Nhất Phương', 'Ghi chú trong Excel: 29/06-12/10
Nguồn: Excel Thủ Đức 2026, dòng 177 (lớp YCT1).'),
    ('s178', 'Dương Gia Yến', 'Ghi chú trong Excel: 13/07/2026-12/07/2027
Nguồn: Excel Thủ Đức 2026, dòng 178 (lớp YCT1).'),
    ('s179', 'Nguyễn Quốc Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 179 (lớp HSK1, HSK2, HSK3).'),
    ('s180', 'Phan Hồng Phúc', 'Nguồn: Excel Thủ Đức 2026, dòng 180 (lớp HSK1, HSK2, HSK3).'),
    ('s181', 'Trần Thị Huyền', 'Nguồn: Excel Thủ Đức 2026, dòng 181 (lớp HSK1, HSK2, HSK3).'),
    ('s182', 'Nguyễn Ngọc Hải Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 182 (lớp HSK1, HSK2, HSK3).'),
    ('s183', 'Trần Thị Dung', 'Nguồn: Excel Thủ Đức 2026, dòng 183 (lớp HSK1, HSK2, HSK3).'),
    ('s184', 'Phạm Hoàng Sang', 'Ghi chú trong Excel: 07/05-01/09 khoá mới HSK2 05/09
Nguồn: Excel Thủ Đức 2026, dòng 184 (lớp HSK1, HSK2, HSK3).'),
    ('s185', 'Hoàng Thị Hồng Linh', 'Nguồn: Excel Thủ Đức 2026, dòng 185 (lớp HSK1, HSK2, HSK3).'),
    ('s186', 'Mai Linh Hương', 'Nguồn: Excel Thủ Đức 2026, dòng 186 (lớp Giao Tiếp 1:1).'),
    ('s187', 'Hồ Song Thư', 'Nguồn: Excel Thủ Đức 2026, dòng 187 (lớp HSK1 · T7,CN 19:30 · Mai Thắm).'),
    ('s188', 'Ninh Nguyễn Anh Thư', 'Nguồn: Excel Thủ Đức 2026, dòng 188 (lớp HSK1 · T7,CN 19:30 · Mai Thắm).'),
    ('s189', 'Trần Hữu Chiến', 'Nguồn: Excel Thủ Đức 2026, dòng 189 (lớp HSK1 · T7,CN 19:30 · Mai Thắm).'),
    ('s190', 'Từ Trọng Huy', 'Nguồn: Excel Thủ Đức 2026, dòng 190 (lớp HSK1 · T7,CN 19:30 · Mai Thắm).'),
    ('s191', 'Ngô Mạnh Tuấn', 'Nguồn: Excel Thủ Đức 2026, dòng 191 (lớp HSK1 · T7,CN 19:30 · Mai Thắm).'),
    ('s192', 'Nguyễn Lê Anh Thư', 'Ghi chú trong Excel: 27/06/2026-06/06/2027
Nguồn: Excel Thủ Đức 2026, dòng 192 (lớp HSK1 · T7,CN 19:30 · Mai Thắm).'),
    ('s193', 'Nguyễn Ngọc Vân Anh', 'Nguồn: Excel Thủ Đức 2026, dòng 193 (lớp HSK1 · T2,T4 19:30 · Trúc Ly).'),
    ('s194', 'Trần Anh Thư', 'Nguồn: Excel Thủ Đức 2026, dòng 194 (lớp HSK1 · T2,T4 19:30 · Trúc Ly).'),
    ('s195', 'Võ Thanh Tăng', 'Nguồn: Excel Thủ Đức 2026, dòng 195 (lớp HSK1 · T2,T4 19:30 · Trúc Ly).'),
    ('s196', 'Dương Huỳnh Bảo', 'Nguồn: Excel Thủ Đức 2026, dòng 196 (lớp HSK1 · T2,T4 19:30 · Trúc Ly).'),
    ('s197', 'Dương Khánh Đăng', 'Nguồn: Excel Thủ Đức 2026, dòng 197 (lớp HSK1 · T2,T4 19:30 · Trúc Ly).'),
    ('s198', 'Nguyễn Thị Hoài Thương', 'Nguồn: Excel Thủ Đức 2026, dòng 198 (lớp HSK1 · T2,T4 19:30 · Trúc Ly).'),
    ('s199', 'Mai Nhất Nguyên', 'Nguồn: Excel Thủ Đức 2026, dòng 199 (lớp YCT2 · T4,T5 18:00 · Thu Thảo).'),
    ('s200', 'Trần Võ Thanh Hào', 'Nguồn: Excel Thủ Đức 2026, dòng 200 (lớp HSK1 · T7,CN 17:30 · Trúc Ly).'),
    ('s201', 'Nguyễn Lê Anh Thy', 'Ghi chú trong Excel: 27/06/2026-06/06/2027
Nguồn: Excel Thủ Đức 2026, dòng 201 (lớp HSK1 · T7,CN 17:30 · Trúc Ly).'),
    ('s202', 'Huỳnh Mỹ Duyên', 'Ghi chú trong Excel: 22/08-08/11
Nguồn: Excel Thủ Đức 2026, dòng 202 (lớp HSK1 · T7,CN 17:30 · Trúc Ly).'),
    ('s203', 'Bùi Mỹ Duyên', 'Nguồn: Excel Thủ Đức 2026, dòng 203 (lớp HSK1 · T7,CN 17:30 · Trúc Ly).'),
    ('s204', 'Phạm Minh Đức', 'Nguồn: Excel Thủ Đức 2026, dòng 204 (lớp HSK1 · T7,CN 17:30 · Trúc Ly).'),
    ('s205', 'Tống Gia Hân', 'Nguồn: Excel Thủ Đức 2026, dòng 205 (lớp HSK1 · T7,CN 17:30 · Trúc Ly).')
  ) as s(key, name, note)
 where not exists (
   select 1 from public.profiles p where p.note like '%[IMP:TD2026:' || s.key || ']%');

-- ---------------------------------------------------------------------
-- 5. Ghi danh học viên vào lớp
-- ---------------------------------------------------------------------
insert into public.class_students (class_id, student_id, status, joined_at)
select cl.id, p.id,
       case when cl.status = 'completed' then 'finished' else 'active' end,
       coalesce(cl.start_date, current_date)
  from (values
    ('s3', 'r3'),
    ('s4', 'r3'),
    ('s5', 'r3'),
    ('s6', 'r3'),
    ('s7', 'r3'),
    ('s8', 'r3'),
    ('s9', 'r3'),
    ('s10', 'r3'),
    ('s11', 'r3'),
    ('s12', 'r3'),
    ('s13', 'r3'),
    ('s14', 'r3'),
    ('s15', 'r15'),
    ('s16', 'r15'),
    ('s17', 'r15'),
    ('s18', 'r15'),
    ('s19', 'r15'),
    ('s20', 'r15'),
    ('s21', 'r15'),
    ('s22', 'r22'),
    ('s23', 'r23'),
    ('s24', 'r23'),
    ('s25', 'r25'),
    ('s26', 'r25'),
    ('s27', 'r25'),
    ('s28', 'r25'),
    ('s29', 'r25'),
    ('s30', 'r25'),
    ('s31', 'r31'),
    ('s32', 'r31'),
    ('s33', 'r33'),
    ('s34', 'r33'),
    ('s35', 'r33'),
    ('s36', 'r33'),
    ('s37', 'r33'),
    ('s38', 'r33'),
    ('s39', 'r33'),
    ('s40', 'r33'),
    ('s41', 'r33'),
    ('s42', 'r42'),
    ('s43', 'r42'),
    ('s44', 'r42'),
    ('s45', 'r42'),
    ('s46', 'r42'),
    ('s47', 'r42'),
    ('s48', 'r42'),
    ('s49', 'r42'),
    ('s50', 'r42'),
    ('s51', 'r42'),
    ('s52', 'r52'),
    ('s53', 'r53'),
    ('s54', 'r53'),
    ('s55', 'r53'),
    ('s56', 'r53'),
    ('s57', 'r53'),
    ('s58', 'r53'),
    ('s59', 'r53'),
    ('s60', 'r53'),
    ('s61', 'r53'),
    ('s62', 'r53'),
    ('s63', 'r53'),
    ('s64', 'r64'),
    ('s65', 'r64'),
    ('s66', 'r64'),
    ('s67', 'r64'),
    ('s68', 'r64'),
    ('s69', 'r64'),
    ('s70', 'r64'),
    ('s71', 'r71'),
    ('s72', 'r71'),
    ('s73', 'r71'),
    ('s74', 'r71'),
    ('s75', 'r71'),
    ('s76', 'r71'),
    ('s77', 'r71'),
    ('s78', 'r71'),
    ('s79', 'r71'),
    ('s80', 'r71'),
    ('s81', 'r81'),
    ('s82', 'r81'),
    ('s83', 'r83'),
    ('s84', 'r83'),
    ('s85', 'r83'),
    ('s86', 'r83'),
    ('s87', 'r83'),
    ('s88', 'r83'),
    ('s89', 'r89'),
    ('s90', 'r89'),
    ('s91', 'r91'),
    ('s92', 'r91'),
    ('s93', 'r93'),
    ('s94', 'r93'),
    ('s95', 'r93'),
    ('s96', 'r93'),
    ('s97', 'r93'),
    ('s98', 'r93'),
    ('s99', 'r93'),
    ('s100', 'r93'),
    ('s101', 'r93'),
    ('s102', 'r102'),
    ('s103', 'r102'),
    ('s104', 'r102'),
    ('s105', 'r102'),
    ('s106', 'r102'),
    ('s107', 'r102'),
    ('s108', 'r108'),
    ('s109', 'r108'),
    ('s110', 'r108'),
    ('s111', 'r108'),
    ('s112', 'r108'),
    ('s113', 'r108'),
    ('s114', 'r108'),
    ('s115', 'r108'),
    ('s116', 'r108'),
    ('s117', 'r108'),
    ('s118', 'r118'),
    ('s119', 'r118'),
    ('s120', 'r118'),
    ('s121', 'r118'),
    ('s122', 'r122'),
    ('s123', 'r122'),
    ('s124', 'r122'),
    ('s125', 'r122'),
    ('s126', 'r122'),
    ('s127', 'r127'),
    ('s128', 'r127'),
    ('s129', 'r127'),
    ('s130', 'r127'),
    ('s131', 'r127'),
    ('s132', 'r127'),
    ('s133', 'r127'),
    ('s134', 'r127'),
    ('s135', 'r127'),
    ('s136', 'r127'),
    ('s137', 'r137'),
    ('s138', 'r137'),
    ('s139', 'r137'),
    ('s140', 'r137'),
    ('s141', 'r137'),
    ('s142', 'r137'),
    ('s143', 'r137'),
    ('s144', 'r144'),
    ('s145', 'r144'),
    ('s146', 'r144'),
    ('s147', 'r144'),
    ('s148', 'r144'),
    ('s149', 'r144'),
    ('s150', 'r144'),
    ('s151', 'r144'),
    ('s152', 'r152'),
    ('s153', 'r152'),
    ('s154', 'r154'),
    ('s155', 'r154'),
    ('s156', 'r154'),
    ('s157', 'r154'),
    ('s158', 'r154'),
    ('s159', 'r154'),
    ('s160', 'r154'),
    ('s161', 'r154'),
    ('s162', 'r154'),
    ('s163', 'r154'),
    ('s164', 'r164'),
    ('s165', 'r164'),
    ('s166', 'r164'),
    ('s167', 'r164'),
    ('s168', 'r168'),
    ('s169', 'r168'),
    ('s170', 'r168'),
    ('s171', 'r168'),
    ('s172', 'r168'),
    ('s173', 'r168'),
    ('s174', 'r168'),
    ('s175', 'r175'),
    ('s176', 'r175'),
    ('s177', 'r175'),
    ('s178', 'r175'),
    ('s179', 'r179'),
    ('s180', 'r179'),
    ('s181', 'r179'),
    ('s182', 'r179'),
    ('s183', 'r179'),
    ('s184', 'r179'),
    ('s185', 'r179'),
    ('s186', 'r186'),
    ('s187', 'r187'),
    ('s188', 'r187'),
    ('s189', 'r187'),
    ('s190', 'r187'),
    ('s191', 'r187'),
    ('s192', 'r187'),
    ('s193', 'r193'),
    ('s194', 'r193'),
    ('s195', 'r193'),
    ('s196', 'r193'),
    ('s197', 'r193'),
    ('s198', 'r193'),
    ('s199', 'r199'),
    ('s200', 'r200'),
    ('s201', 'r200'),
    ('s202', 'r200'),
    ('s203', 'r200'),
    ('s204', 'r200'),
    ('s205', 'r200')
  ) as e(student_key, class_key)
  join public.classes cl on cl.notes like '%[IMP:TD2026:' || e.class_key || ']%'
  join public.profiles p on p.note like '%[IMP:TD2026:' || e.student_key || ']%'
on conflict (class_id, student_id) do nothing;

-- ---------------------------------------------------------------------
-- 6. Kiểm tra kết quả (kỳ vọng: 35 lớp, 203 học viên, 203 ghi danh)
-- ---------------------------------------------------------------------
select 'lớp' as loai, count(*) from public.classes where notes like '%[IMP:TD2026:%'
union all
select 'học viên', count(*) from public.profiles
 where role = 'student' and note like '%[IMP:TD2026:%'
union all
select 'ghi danh', count(*) from public.class_students cs
  join public.classes cl on cl.id = cs.class_id
 where cl.notes like '%[IMP:TD2026:%'
union all
select 'lịch tuần', count(*) from public.class_schedules s
  join public.classes cl on cl.id = s.class_id
 where cl.notes like '%[IMP:TD2026:%';
