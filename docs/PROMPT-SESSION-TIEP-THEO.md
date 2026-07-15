# Prompt cho session tiếp theo — Khu giáo viên + vòng điểm danh

> Copy toàn bộ phần dưới đây dán vào session Claude Code mới.

---

Tiếp tục dự án CLASSHUB (hệ quản lý trung tâm tiếng Trung KAT Education). Đọc trước các file sau để nắm bối cảnh:

- `docs/KE-HOACH-CHUC-NANG.md` — kế hoạch tổng, lộ trình 3 giai đoạn
- `docs/SCHEMA-GIAI-DOAN-1.md` — thiết kế database + các quyết định
- `src/lib/db.ts` — data layer hiện có (pattern truy vấn, dbErrorMessage)
- `supabase/migrations/0004_decouple_profiles.sql` — cấu trúc phân quyền mới nhất

## Trạng thái hiện tại (15/07/2026)

- **Stack**: Next.js 15 App Router + Supabase (project `pfwltalxrmddbckidgad`), deploy Vercel qua GitHub (`thangpham393/katclass`, branch main). Env trong `.env.local` (không commit).
- **Đã xong**: đăng nhập Google/email (Supabase Auth), phân quyền 5 role (student/parent/teacher/staff/admin), schema Giai đoạn 1 đầy đủ (0001→0004 + seed đã chạy trên Supabase thật), khu admin chạy dữ liệu thật (dashboard, CRUD khóa học, tạo lớp + lịch tuần, chi tiết lớp + xếp học viên, phân quyền trong app, phòng học), giao diện mới (xanh dương + đỏ gradient KAT, sidebar navy tối).
- **Dữ liệu thật đã import**: 123 học viên (có `student_code` HV00xxx, `user_id` null vì chưa có tài khoản), 62 lớp `active`, 12 khóa học, chi nhánh Vinhome Landmark. **Lưu ý: 62 lớp chưa có giáo viên, chưa có lịch tuần trong bảng `class_schedules`** — lịch đang nằm trong TÊN lớp (vd "HSK1 T3,5 (17h30-19h00)", "YCT2 T7,CN (14h00-15h30)").
- **Quy ước quan trọng**:
  - `profiles.id` là business key; `profiles.user_id` liên kết auth (null = chưa có tài khoản). RLS dùng `my_profile_id()`.
  - Embed profiles từ classes phải hint FK: `profiles!classes_teacher_id_fkey` (có 2 quan hệ classes↔profiles).
  - Lỗi Postgres 23P01 = trùng lịch phòng/giáo viên (exclusion constraint tự chặn).
  - Chính sách điểm danh đã chốt: vắng có phép → trừ buổi + trigger tự sinh `makeup_credits`; vắng không phép → trừ buổi, không học bù; buổi học bù không trừ thêm.
  - Tôi không chạy được SQL trực tiếp trên Supabase — nếu cần đổi schema thì viết file migration mới trong `supabase/migrations/` và hướng dẫn tôi dán vào SQL Editor.
  - Commit message tiếng Việt, push main → Vercel tự deploy.

## Việc cần làm: khu giáo viên + vòng điểm danh

1. **Gán giáo viên cho lớp**: trang chi tiết lớp admin (`/admin/classes/[id]`) thêm đổi giáo viên phụ trách.
2. **Sửa/nhập lịch tuần cho lớp có sẵn**: form sửa `class_schedules` trong trang chi tiết lớp. Làm thêm chức năng gợi ý tự bóc tách lịch từ tên lớp (T2..T7, CN, giờ dạng 17h30/16:00) để xác nhận nhanh từng lớp thay vì nhập tay 62 lớp.
3. **Sinh buổi học**: nút "Sinh buổi học N tuần tới" từ `class_schedules` vào bảng `sessions` (bỏ qua buổi đã tồn tại, hiện lỗi trùng phòng/GV nếu có).
4. **Khu giáo viên chạy dữ liệu thật** (`/teacher`): trang chủ hiện buổi dạy hôm nay + lớp phụ trách; vào buổi học → **điểm danh** từng học viên (present / absent_excused / absent_unexcused / makeup) + đánh dấu buổi `completed`; **nhận xét từng học viên** sau buổi (bảng `session_comments`, kèm rating 1-5).
5. **Khu admin bổ sung**: trang danh sách chờ học bù (`makeup_credits` status pending → xếp vào buổi khác), thống kê chuyên cần đơn giản.

Làm xong build + commit + push. Sau khối này, phần còn lại của Giai đoạn 1 là: khu học viên dữ liệu thật, nội dung bài học + flashcard, bài tập tự chấm, cổng phụ huynh.
