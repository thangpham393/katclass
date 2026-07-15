# Prompt cho session tiếp theo — Giai đoạn 2: học phí gói buổi + thông báo + chấm công

> Copy toàn bộ phần dưới đây dán vào session Claude Code mới.

---

Tiếp tục dự án CLASSHUB (hệ quản lý trung tâm tiếng Trung KAT Education). Đọc trước các file sau để nắm bối cảnh:

- `docs/KE-HOACH-CHUC-NANG.md` — kế hoạch tổng, lộ trình 3 giai đoạn (mục 5.1 chính sách học phí gói buổi ĐÃ CHỐT)
- `docs/SCHEMA-GIAI-DOAN-1.md` — thiết kế database + các quyết định
- `src/lib/db.ts` — data layer lõi (lớp, buổi học, điểm danh, học bù, thành viên)
- `src/lib/db-content.ts` — data layer nội dung (từ vựng, bài học, câu hỏi, bài tập; quy ước jsonb đề bài/đáp án ghi ở đầu file)
- `src/lib/db-student.ts` — data layer khu học viên + cổng phụ huynh (dựa vào RLS, dùng chung cho HV và PH xem con)
- `src/lib/student-login.ts` — cơ chế đăng nhập bằng mã

## Trạng thái hiện tại (15/07/2026)

- **Stack**: Next.js 15 App Router + Supabase (project `pfwltalxrmddbckidgad`), deploy Vercel qua GitHub (`thangpham393/katclass`, branch main). Env trong `.env.local` (không commit).
- **GIAI ĐOẠN 1 ĐÃ HOÀN TẤT** — toàn bộ chạy dữ liệu thật, không còn mock (mock-data.ts đã xóa):
  - **Khu admin**: dashboard, khóa học, lớp + lịch tuần, xếp học viên, sinh buổi học N tuần, thời khóa biểu toàn trung tâm, phòng học, học bù, báo cáo chuyên cần, chi tiết thành viên /admin/members/[id] (cấp tài khoản, reset mật khẩu, xóa, **liên kết phụ huynh ↔ con** — tạo PH mới tự cấp mã PHKAT + tài khoản, hoặc chọn PH có sẵn, quan hệ bố/mẹ/giám hộ).
  - **Khu giáo viên**: buổi dạy + điểm danh 4 trạng thái + nhận xét (rating 1-5) + **nội dung ôn tập theo buổi** (chọn bài học gán vào buổi ở /teacher/sessions/[id]); **kho từ vựng** (CRUD, ví dụ, audio_url, TTS zh-CN); **bài học** (/teacher/lessons: CRUD gắn course, unit, ngữ pháp, link slide + gắn từ vựng có thứ tự); **ngân hàng câu hỏi** (/teacher/questions: 6 dạng — trắc nghiệm, điền từ, nối từ-nghĩa, sắp xếp câu, nghe-chọn TTS, chọn pinyin; đáp án lưu bảng riêng); **giao bài tập** (/teacher/homework/new chọn câu từ ngân hàng, hạn nộp) + trang chi tiết /teacher/homework/[id] (tỷ lệ nộp, điểm TB, danh sách chưa nộp); học viên của tôi.
  - **Khu học viên** (mobile-first): trang chủ (lịch 14 ngày kể cả buổi học bù được xếp, bài tập chờ, chuyên cần, nhận xét GV); lớp của tôi + chi tiết lớp /student/classes/[id] (buổi sắp tới, buổi đã diễn ra kèm điểm danh của mình + link nội dung ôn tập từng buổi, bài tập lớp); xem bài học /student/lessons/[id] (slide, ngữ pháp, từ vựng + flashcard); flashcard theo bài học; thư viện; **làm bài tập** /student/homework/[id] (đủ 6 dạng câu, nộp qua RPC `submit_homework` chấm server thang 10, xem điểm, làm lại được).
  - **Cổng phụ huynh** /parent: chọn con (nhiều con), lịch học sắp tới, điểm danh gần đây + chuyên cần, nhận xét GV sau buổi, bài tập của con (trạng thái/điểm).
  - **Thư viện giáo trình** (migration 0011): admin import giáo trình từ file JSON ở /admin/library (bảng `textbooks` + `lessons.textbook_id`; import idempotent chạy client-side qua RLS — bài khớp theo unit, từ vựng tái dùng kho theo hanzi, câu hỏi trùng bỏ qua). File dữ liệu ở `supabase/library/`: `msutong-4.json` (Hán ngữ MSutong Q4 — trích từ PDF giáo trình thật: 10 bài, 192 từ, ngữ pháp từng bài, 60 câu luyện tập tự soạn) và `hsk1-standard.json` (HSK 1 chuẩn 15 bài — bản Claude tự biên soạn, chưa đối chiếu sách của trung tâm). GV lọc bài học theo giáo trình, gán vào buổi, lọc câu hỏi theo bài khi giao bài tập; format JSON ghi ở đầu `src/lib/db-library.ts`.
  - **Gán giáo trình cho lớp** (migration 0012, `classes.textbook_id`): admin chọn giáo trình khi tạo lớp hoặc đổi ngay trên trang chi tiết lớp. GV gán nội dung ôn tập cho buổi: mặc định chỉ hiện bài của giáo trình lớp (nút "Hiện tất cả bài học" để chọn ngoài); giao bài tập: chọn lớp xong tự lọc bài học + câu hỏi theo giáo trình lớp (checkbox bỏ lọc được).
  - **Đăng nhập bằng mã**: HVKAT (học viên), GVKAT (GV), NVKAT (NV), QLKAT (admin), **PHKAT (phụ huynh — mới, migration 0010)**. Mật khẩu mặc định `kat12345`, bị ép đổi ở /account/password. Tự đăng ký bị khóa (0009).
- **Dữ liệu thật**: 123 học viên, 62 lớp active, 12 khóa học.
- **Setup cần kiểm tra trước khi làm gì khác** (hỏi tôi nếu chưa chắc):
  1. Migrations đã dán vào Supabase SQL Editor theo thứ tự đến **`0012_class_textbook.sql`** (0011 = bảng textbooks + lessons.textbook_id, 0012 = classes.textbook_id). Nếu chưa dán: mọi trang bài học / lớp học sẽ lỗi vì query embed `textbook:textbooks`.
  2. Env `SUPABASE_SERVICE_ROLE_KEY` đã có ở `.env.local` + Vercel.
- **Quy ước quan trọng**:
  - `profiles.id` là business key; `profiles.user_id` liên kết auth (null = chưa cấp tài khoản). RLS dùng `my_profile_id()`. `profiles.student_code` = mã thành viên mọi vai trò.
  - Embed profiles phải hint FK: `profiles!classes_teacher_id_fkey`, `profiles!sessions_teacher_id_fkey`, `profiles!class_students_student_id_fkey`, `profiles!submissions_student_id_fkey`, `profiles!parent_students_parent_id_fkey`...
  - Khu học viên/phụ huynh: hàm trong `db-student.ts` nhận `studentId` và dựa vào RLS — cùng hàm dùng cho HV tự xem và PH xem con.
  - Đề bài `questions.content` KHÔNG chứa đáp án; đáp án ở `question_answers` (HV không đọc được). Quy ước jsonb từng dạng câu ghi ở đầu `src/lib/db-content.ts` (trắc nghiệm `"B"`, điền từ `["了","的"]`, nối `{"0":"b"}`, sắp xếp `["我","喜欢",...]`). Nộp bài qua RPC `submit_homework(hw_id, my_answers)` — so đáp án bằng jsonb equality, thang 10.
  - Lỗi Postgres 23P01 = trùng lịch phòng/GV; 23503 = còn dữ liệu gắn kèm.
  - Tôi không chạy được SQL trực tiếp — cần đổi schema thì viết migration mới trong `supabase/migrations/` và hướng dẫn tôi dán vào SQL Editor.
  - Commit message tiếng Việt, push main → Vercel tự deploy. Khu học viên/phụ huynh phải mobile-first.

## Việc cần làm: Giai đoạn 2 — tiền & thông báo & chấm công

Theo chính sách đã chốt ở `docs/KE-HOACH-CHUC-NANG.md` mục 5.1:

1. **Học phí theo gói buổi** (migration mới: `enrollment_packages`, `payments`):
   - Hành chính bán gói N buổi cho học viên (giá, ưu đãi, ngày mua), thu tiền + ghi nhận thanh toán (tiền mặt/chuyển khoản), xuất biên lai (in/PDF đơn giản).
   - Mỗi điểm danh (present / absent_excused / absent_unexcused) trừ 1 buổi khỏi gói; buổi `makeup` KHÔNG trừ. Tính "số buổi còn lại" từ điểm danh sau ngày kích hoạt gói (schema hiện tại đủ dữ liệu để tính ngược).
   - Trang admin: danh sách gói của từng học viên, cảnh báo còn ≤ 3 buổi (danh sách nhắc gia hạn), công nợ.
   - Học viên/phụ huynh thấy số buổi còn lại của gói.
2. **Thông báo**: bảng `notifications` in-app (chuông trên topbar) cho: bài tập mới, được xếp học bù, con vắng mặt, sắp hết gói buổi. Zalo OA/ZNS để sau khi có OA — thiết kế bảng sẵn cột kênh.
3. **Chấm công giáo viên**: buổi `completed` có GV thực dạy = 1 công; trang admin tổng hợp công theo GV theo tháng (đếm từ sessions, chưa cần bảng lương).
4. (Nếu còn thời gian) GV đăng ký nghỉ / đề xuất đổi buổi → admin duyệt + xếp dạy thay.

Làm xong build + commit + push, cập nhật lại file này cho session sau.
