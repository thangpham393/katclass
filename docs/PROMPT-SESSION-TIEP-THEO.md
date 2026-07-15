# Prompt cho session tiếp theo — Khu học viên + nội dung bài học

> Copy toàn bộ phần dưới đây dán vào session Claude Code mới.

---

Tiếp tục dự án CLASSHUB (hệ quản lý trung tâm tiếng Trung KAT Education). Đọc trước các file sau để nắm bối cảnh:

- `docs/KE-HOACH-CHUC-NANG.md` — kế hoạch tổng, lộ trình 3 giai đoạn
- `docs/SCHEMA-GIAI-DOAN-1.md` — thiết kế database + các quyết định
- `src/lib/db.ts` — data layer hiện có (pattern truy vấn, dbErrorMessage, sessions/điểm danh/học bù đã có sẵn)
- `supabase/migrations/0003_content.sql` — schema nội dung (vocab, lessons, questions, homeworks)

## Trạng thái hiện tại (15/07/2026)

- **Stack**: Next.js 15 App Router + Supabase (project `pfwltalxrmddbckidgad`), deploy Vercel qua GitHub (`thangpham393/katclass`, branch main). Env trong `.env.local` (không commit).
- **Đã xong**: đăng nhập + phân quyền 5 role; khu admin dữ liệu thật (dashboard, khóa học, lớp + lịch tuần, xếp học viên, phòng học, phân quyền); **khối giáo viên + vòng điểm danh vừa hoàn thành**:
  - Trang chi tiết lớp admin: đổi GV phụ trách (kèm gán cho các buổi sắp tới), sửa lịch tuần, **gợi ý bóc lịch từ tên lớp** (`src/lib/parse-schedule.ts`), nút sinh buổi học N tuần tới (bỏ qua buổi trùng, báo xung đột phòng/GV 23P01).
  - Khu giáo viên thật: trang chủ (buổi dạy hôm nay/7 ngày + lớp phụ trách), `/teacher/classes/[id]`, `/teacher/sessions/[id]` điểm danh 4 trạng thái + ghi chú + đánh dấu buổi completed + nhận xét từng học viên (rating 1-5).
  - Admin: `/admin/makeup` xếp học bù (pending → chọn buổi sắp tới → scheduled; trigger đóng khi GV điểm danh 'makeup'), `/admin/reports` thống kê chuyên cần thật theo lớp + cơ cấu điểm danh.
  - **Đăng nhập bằng mã thành viên (chính sách hiện hành)**: TẤT CẢ đăng nhập bằng mã do admin cấp — HVKAT (học viên), GVKAT (giáo viên), NVKAT (nhân viên), QLKAT (quản trị) — Google/email tạm ẩn sau mục "Dành cho quản trị" ở /login. Admin tạo học viên/GV/NV ở /admin/students và /admin/teachers → hệ thống TỰ cấp mã (trigger DB) + TỰ tạo tài khoản (API `/api/provision-account`, chỉ staff/admin gọi được) với mật khẩu mặc định `kat12345` (hằng trong `src/lib/student-login.ts`); người dùng đăng nhập bằng mật khẩu mặc định sẽ bị đưa tới /account/password để đổi. API `/api/student-auth` chỉ tra mã→email, KHÔNG tự tạo tài khoản. Cần env `SUPABASE_SERVICE_ROLE_KEY` (local + Vercel).
  - Migrations cần dán vào SQL Editor theo thứ tự: `0005_makeup_flow.sql` (vòng học bù), `0006_invite_codes.sql` (mã kích hoạt legacy + RPC claim_invite, trang /activate vẫn dùng), `0007_student_codes.sql` (tiền tố HVKAT + trigger mã học viên), `0008_team_codes.sql` (mã GVKAT/NVKAT/QLKAT cho đội ngũ). **KIỂM TRA đã chạy đủ chưa trước khi làm gì khác.**
- **Dữ liệu thật**: 123 học viên (HV00xxx, đa số user_id null), 62 lớp active, 12 khóa học. Lịch tuần các lớp cần được admin xác nhận dần bằng nút gợi ý từ tên lớp rồi sinh buổi học.
- **Quy ước quan trọng**:
  - `profiles.id` là business key; `profiles.user_id` liên kết auth (null = chưa có tài khoản). RLS dùng `my_profile_id()`.
  - Embed profiles từ classes/sessions phải hint FK (vd `profiles!classes_teacher_id_fkey`, `profiles!sessions_teacher_id_fkey`).
  - Lỗi Postgres 23P01 = trùng lịch phòng/giáo viên (exclusion constraint tự chặn).
  - Học viên KHÔNG đọc được bảng `question_answers`; nộp bài qua RPC `submit_homework(hw_id, my_answers)` (đáp án jsonb chuẩn hóa).
  - Tôi không chạy được SQL trực tiếp trên Supabase — cần đổi schema thì viết migration mới trong `supabase/migrations/` và hướng dẫn tôi dán vào SQL Editor.
  - Commit message tiếng Việt, push main → Vercel tự deploy.

## Việc cần làm: khu học viên dữ liệu thật + nội dung bài học

1. **Khu học viên chạy dữ liệu thật** (`/student`): trang chủ hiện lớp đang học, lịch học sắp tới (kể cả buổi học bù được xếp), điểm danh/số buổi đã học của chính mình; trang lớp của tôi.
2. **Nội dung bài học**: giáo viên/admin tạo bài học (`lessons`) gắn khóa học, thêm từ vựng (`vocab_items` + `lesson_vocab`), gán nội dung ôn tập cho buổi học (`session_lessons`); học viên xem lại theo buổi.
3. **Flashcard thật**: chuyển flashcard player hiện có (đang mock) sang đọc `vocab_items` theo bài học/bộ từ.
4. **Bài tập tự chấm**: giáo viên tạo câu hỏi (`questions` + `question_answers`), giao bài (`homeworks` + `homework_questions`); học viên làm bài, nộp qua RPC `submit_homework`; xem điểm.
5. **Cổng phụ huynh** (`/parent`): liên kết phụ huynh ↔ con (admin thêm `parent_students`), xem lịch học, điểm danh, nhận xét sau buổi của con.

Làm xong build + commit + push. Sau khối này Giai đoạn 1 hoàn tất — sang Giai đoạn 2 (học phí gói buổi, thông báo Zalo, chấm công).
