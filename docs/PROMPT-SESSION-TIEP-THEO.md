# Prompt cho session tiếp theo — Khu học viên + nội dung bài học

> Copy toàn bộ phần dưới đây dán vào session Claude Code mới.

---

Tiếp tục dự án CLASSHUB (hệ quản lý trung tâm tiếng Trung KAT Education). Đọc trước các file sau để nắm bối cảnh:

- `docs/KE-HOACH-CHUC-NANG.md` — kế hoạch tổng, lộ trình 3 giai đoạn
- `docs/SCHEMA-GIAI-DOAN-1.md` — thiết kế database + các quyết định
- `src/lib/db.ts` — data layer (pattern truy vấn, dbErrorMessage; sessions/điểm danh/học bù/thành viên đã có sẵn)
- `supabase/migrations/0003_content.sql` — schema nội dung (vocab_items, lessons, session_lessons, questions, question_answers, homeworks, submissions)
- `src/lib/student-login.ts` + `src/app/api/provision-account/route.ts` — cơ chế đăng nhập bằng mã

## Trạng thái hiện tại (15/07/2026)

- **Stack**: Next.js 15 App Router + Supabase (project `pfwltalxrmddbckidgad`), deploy Vercel qua GitHub (`thangpham393/katclass`, branch main). Env trong `.env.local` (không commit).
- **Đã xong**:
  - Khu admin dữ liệu thật: dashboard, khóa học, lớp + lịch tuần (gợi ý bóc lịch từ tên lớp `src/lib/parse-schedule.ts`), xếp học viên, đổi GV phụ trách, sinh buổi học N tuần, thời khóa biểu tuần toàn trung tâm (/admin/timetable, lọc phòng/GV), phòng học, học bù (/admin/makeup), báo cáo chuyên cần (/admin/reports), trang chi tiết thành viên /admin/members/[id] (xem, cấp tài khoản, reset mật khẩu, xóa).
  - Khu giáo viên dữ liệu thật: buổi dạy hôm nay/7 ngày, lớp phụ trách, điểm danh 4 trạng thái + nhận xét học viên (rating 1-5) + hoàn thành buổi (/teacher/sessions/[id]).
  - **Hệ đăng nhập bằng mã thành viên (chính sách chốt)**: TẤT CẢ đăng nhập bằng mã do admin cấp — HVKAT (học viên), GVKAT (giáo viên), NVKAT (nhân viên), QLKAT (quản trị). Google/email đã gỡ khỏi UI (ô mã vẫn nhận email làm dự phòng). Tự đăng ký bị KHÓA (0009): tài khoản lạ không có hồ sơ bị đăng xuất ngay. Admin tạo học viên/GV/NV ở /admin/students, /admin/teachers → trigger DB tự cấp mã + API `/api/provision-account` tự tạo tài khoản với mật khẩu mặc định `kat12345` (hằng trong `src/lib/student-login.ts`); đăng nhập bằng mật khẩu mặc định bị đưa tới /account/password để đổi (trang này hiện mã của chính mình). API `/api/student-auth` chỉ tra mã→email; `/api/member-admin` reset mật khẩu/xóa thành viên (staff không động được vào staff/admin).
- **Dữ liệu thật**: 123 học viên (mã HVKAT00xxx sau 0007), 62 lớp active, 12 khóa học. Lịch tuần các lớp admin xác nhận dần bằng nút gợi ý từ tên lớp rồi sinh buổi học.
- **Setup cần kiểm tra trước khi làm gì khác** (hỏi tôi nếu chưa chắc):
  1. Migrations đã dán vào Supabase SQL Editor theo thứ tự: `0005_makeup_flow` → `0006_invite_codes` → `0007_student_codes` → `0008_team_codes` → `0009_lock_signup`.
  2. Env `SUPABASE_SERVICE_ROLE_KEY` đã thêm ở `.env.local` + Vercel.
  3. Admin đã đặt mật khẩu riêng (nút chìa khóa topbar) để đăng nhập bằng mã QLKAT.
  4. Đã bấm "Cấp tài khoản cho tất cả" ở /admin/students cho 123 học viên import.
- **Quy ước quan trọng**:
  - `profiles.id` là business key; `profiles.user_id` liên kết auth (null = chưa cấp tài khoản). RLS dùng `my_profile_id()`. `profiles.student_code` = mã thành viên mọi vai trò.
  - Embed profiles phải hint FK: `profiles!classes_teacher_id_fkey`, `profiles!sessions_teacher_id_fkey`, `profiles!class_students_student_id_fkey`...
  - Lỗi Postgres 23P01 = trùng lịch phòng/GV; 23503 = còn dữ liệu gắn kèm.
  - Học viên KHÔNG đọc được bảng `question_answers`; nộp bài qua RPC `submit_homework(hw_id, my_answers)` — đáp án jsonb chuẩn hóa (trắc nghiệm `"B"`, điền từ `["了","的"]`, nối `{"1":"a"}`).
  - Tôi không chạy được SQL trực tiếp — cần đổi schema thì viết migration mới trong `supabase/migrations/` và hướng dẫn tôi dán vào SQL Editor.
  - Commit message tiếng Việt, push main → Vercel tự deploy. Khu học viên/phụ huynh phải mobile-first.

## Việc cần làm: khu học viên dữ liệu thật + nội dung bài học

1. **Khu học viên chạy dữ liệu thật** (`/student`, đang mock toàn bộ): trang chủ hiện lớp đang học, lịch học sắp tới (gồm cả buổi học bù được xếp), điểm danh + chuyên cần của chính mình; trang "Lớp của tôi" với chi tiết lớp, danh sách buổi.
2. **Nội dung bài học**: khu giáo viên tạo bài học (`lessons` gắn course), quản lý từ vựng (`vocab_items` + `lesson_vocab`), gán nội dung ôn tập cho buổi (`session_lessons`); học viên xem lại nội dung theo buổi đã học.
3. **Flashcard thật**: chuyển flashcard player hiện có (`src/components/flashcard/flashcard-player.tsx`, đang mock) sang đọc `vocab_items` theo bài học.
4. **Bài tập tự chấm**: giáo viên tạo câu hỏi (`questions` + `question_answers`), giao bài (`homeworks` + `homework_questions`, hạn nộp); học viên làm bài + nộp qua RPC `submit_homework`, xem điểm; giáo viên xem tỷ lệ nộp/điểm của lớp.
5. **Cổng phụ huynh** (`/parent`): admin liên kết phụ huynh ↔ con (`parent_students`, phụ huynh cũng cần mã đăng nhập — cân nhắc thêm tiền tố PHKAT trong migration mới + cấp tài khoản như học viên); phụ huynh xem lịch học, điểm danh, nhận xét sau buổi, bài tập của con.

Làm xong build + commit + push, cập nhật lại file này cho session sau. Sau khối này Giai đoạn 1 hoàn tất — sang Giai đoạn 2 (học phí gói buổi, thông báo Zalo, chấm công GV).
