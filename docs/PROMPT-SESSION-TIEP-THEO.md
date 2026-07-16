# Prompt cho session tiếp theo — Giai đoạn 2 (phần còn lại): GV nghỉ/đổi buổi, kiểm tra định kỳ, chấm tay

> Copy toàn bộ phần dưới đây dán vào session Claude Code mới.

---

Tiếp tục dự án CLASSHUB (hệ quản lý trung tâm tiếng Trung KAT Education). Đọc trước các file sau để nắm bối cảnh:

- `docs/KE-HOACH-CHUC-NANG.md` — kế hoạch tổng, lộ trình 3 giai đoạn (mục 5.1 chính sách học phí gói buổi ĐÃ CHỐT)
- `docs/SCHEMA-GIAI-DOAN-1.md` — thiết kế database + các quyết định
- `src/lib/db.ts` — data layer lõi (lớp, buổi học, điểm danh, học bù, thành viên)
- `src/lib/db-content.ts` — data layer nội dung (từ vựng, bài học, câu hỏi, bài tập; quy ước jsonb đề bài/đáp án ghi ở đầu file)
- `src/lib/db-student.ts` — data layer khu học viên + cổng phụ huynh (dựa vào RLS, dùng chung cho HV và PH xem con)
- `src/lib/db-tuition.ts` — data layer học phí gói buổi + chấm công GV (Giai đoạn 2)
- `src/lib/db-notifications.ts` — data layer thông báo in-app
- `src/lib/student-login.ts` — cơ chế đăng nhập bằng mã

## Trạng thái hiện tại (16/07/2026)

- **Stack**: Next.js 15 App Router + Supabase (project `pfwltalxrmddbckidgad`), deploy Vercel qua GitHub (`thangpham393/katclass`, branch main). Env trong `.env.local` (không commit).
- **GIAI ĐOẠN 1 ĐÃ HOÀN TẤT** — toàn bộ chạy dữ liệu thật, không còn mock (mock-data.ts đã xóa):
  - **Khu admin**: dashboard, khóa học, lớp + lịch tuần, xếp học viên, sinh buổi học N tuần, thời khóa biểu toàn trung tâm (làm lại 16/07: 2 chế độ — Tuần chia Sáng/Chiều/Tối + Ngày dạng lưới giờ theo cột phòng học, vạch giờ hiện tại, dải 7 ngày bấm để nhảy, lọc phòng/GV, thống kê tuần), phòng học, học bù, báo cáo chuyên cần, chi tiết thành viên /admin/members/[id] (cấp tài khoản, reset mật khẩu, xóa, **liên kết phụ huynh ↔ con** — tạo PH mới tự cấp mã PHKAT + tài khoản, hoặc chọn PH có sẵn, quan hệ bố/mẹ/giám hộ).
  - **Khu giáo viên**: buổi dạy + điểm danh 4 trạng thái + nhận xét (rating 1-5) + **nội dung ôn tập theo buổi** (chọn bài học gán vào buổi ở /teacher/sessions/[id]); **kho từ vựng** (CRUD, ví dụ, audio_url, TTS zh-CN); **bài học** (/teacher/lessons: CRUD gắn course, unit, ngữ pháp, link slide + gắn từ vựng có thứ tự); **ngân hàng câu hỏi** (/teacher/questions: 6 dạng — trắc nghiệm, điền từ, nối từ-nghĩa, sắp xếp câu, nghe-chọn TTS, chọn pinyin; đáp án lưu bảng riêng); **giao bài tập** (/teacher/homework/new chọn câu từ ngân hàng, hạn nộp) + trang chi tiết /teacher/homework/[id] (tỷ lệ nộp, điểm TB, danh sách chưa nộp); học viên của tôi.
  - **Khu học viên** (mobile-first): trang chủ (lịch 14 ngày kể cả buổi học bù được xếp, bài tập chờ, chuyên cần, nhận xét GV); lớp của tôi + chi tiết lớp /student/classes/[id] (buổi sắp tới, buổi đã diễn ra kèm điểm danh của mình + link nội dung ôn tập từng buổi, bài tập lớp); xem bài học /student/lessons/[id] (slide, ngữ pháp, từ vựng + flashcard); flashcard theo bài học; thư viện; **làm bài tập** /student/homework/[id] (đủ 6 dạng câu, nộp qua RPC `submit_homework` chấm server thang 10, xem điểm, làm lại được).
  - **Cổng phụ huynh** /parent: chọn con (nhiều con), lịch học sắp tới, điểm danh gần đây + chuyên cần, nhận xét GV sau buổi, bài tập của con (trạng thái/điểm).
  - **Thư viện giáo trình** (migration 0011): admin import giáo trình từ file JSON ở /admin/library (bảng `textbooks` + `lessons.textbook_id`; import idempotent chạy client-side qua RLS — bài khớp theo unit, từ vựng tái dùng kho theo hanzi, câu hỏi trùng bỏ qua). File dữ liệu ở `supabase/library/`: `msutong-4.json` (Hán ngữ MSutong Q4 — trích từ PDF giáo trình thật: 10 bài, 192 từ, ngữ pháp từng bài, 60 câu luyện tập tự soạn), `hsk1-standard.json` (标准教程 HSK 1 bản dịch Việt — **trích từ sách thật**, 15 bài, 183 mục từ khớp bảng 词语总表 cuối sách), `hsk1-standard-baitap.json` (bộ câu hỏi theo bài cho HSK 1) và `yct1-standard.json` (标准教程 YCT 1 bản dịch Việt — trích từ sách thật "YCT1 Tieng Viet.pdf": 12 bài, bài 12 ôn tập, 104 mục từ khớp 100% bảng 词语表 trang 62–64, sort 2 — đã commit, đã import vào DB). `importTextbook` (src/lib/db-library.ts) đã sửa: từ trùng hanzi trong kho chung được **cập nhật pinyin/nghĩa/ví dụ theo file import sau cùng** — YCT1 và HSK1 chồng nhiều từ cơ bản (你, 好, 我...), re-import file nào sau thì nghĩa theo file đó. GV lọc bài học theo giáo trình, gán vào buổi, lọc câu hỏi theo bài khi giao bài tập; format JSON ghi ở đầu `src/lib/db-library.ts`.
  - **Gán giáo trình cho lớp** (migration 0012, `classes.textbook_id`): admin chọn giáo trình khi tạo lớp hoặc đổi ngay trên trang chi tiết lớp. GV gán nội dung ôn tập cho buổi: mặc định chỉ hiện bài của giáo trình lớp (nút "Hiện tất cả bài học" để chọn ngoài); giao bài tập: chọn lớp xong tự lọc bài học + câu hỏi theo giáo trình lớp (checkbox bỏ lọc được).
  - **Bộ bài tập theo bài MSutong 4**: `supabase/library/msutong-4-baitap.json` — 191 câu trích từ worksheet của chính trung tâm (file MSUTONG4 BT.pdf), 4 dạng tự chấm: chọn từ điền chỗ trống (trắc nghiệm ngân hàng từ), chọn vị trí từ A/B/C/D, sắp xếp câu (reorder), đọc hiểu (trắc nghiệm + `content.passage`). Import file này SAU msutong-4.json (importer cập nhật mềm: file chỉ có questions sẽ không đụng vocab/grammar). 2 dạng không tự chấm được đã bỏ: hoàn thành hội thoại theo tranh, viết câu theo tranh. GV giao bài: lọc theo bài học → nút "Chọn cả bộ" lấy nguyên bộ câu hỏi + tự điền tiêu đề "Luyện tập Bài N". Player học viên hỗ trợ `passage` (khung đoạn văn giữ xuống dòng, font Hán tự tự nhận diện).
  - **Đăng nhập bằng mã**: HVKAT (học viên), GVKAT (GV), NVKAT (NV), QLKAT (admin), **PHKAT (phụ huynh — mới, migration 0010)**. Mật khẩu mặc định `kat12345`, bị ép đổi ở /account/password. Tự đăng ký bị khóa (0009).
- **GIAI ĐOẠN 2 PHẦN 1 ĐÃ XONG (16/07/2026, migration 0013)** — học phí gói buổi + thông báo in-app + chấm công GV:
  - **Học phí gói buổi** (`enrollment_packages` + `payments`, chính sách 5.1): admin bán gói N buổi ở /admin/tuition (chọn HV, giá, ưu đãi, ngày kích hoạt, thu tiền ngay tiền mặt/CK), thu thêm nhiều lần, hủy gói (giữ lịch sử). Biên lai số tự cấp BL-00001 (sequence), trang in /admin/tuition/receipt/[id] (sidebar/topbar có print:hidden). **Số buổi còn lại KHÔNG lưu mà tính ngược từ điểm danh** qua view `package_balances` (security_invoker — dùng chung admin/HV/PH): present + absent_excused + absent_unexcused trừ 1 buổi kể từ ngày kích hoạt gói đầu tiên, makeup không trừ, nhiều gói trừ FIFO theo start_date; view kèm paid_amount/debt/final_price + tên/mã/SĐT học viên. Trang admin có tab Tất cả / Sắp hết buổi (≤3) / Công nợ + 4 stat (gói active, HV sắp hết, tổng nợ, đã thu tháng này). Hàm `student_sessions_remaining(sid)` dùng trong trigger.
  - **Thông báo in-app** (`notifications`, cột channel sẵn cho Zalo sau): chuông trên topbar (`src/components/shell/notification-bell.tsx`) — badge số chưa đọc, mở panel tự đánh dấu đã đọc, bấm thông báo nhảy tới link. 4 trigger DB tự sinh (security definer): bài tập mới → HV cả lớp; xếp học bù → HV + PH; con vắng mặt (có/không phép) → PH; gói còn ≤3 buổi hoặc hết → HV + PH (chống dội: 1 cảnh báo package_low / người / 3 ngày).
  - **Chấm công GV** /admin/payroll: chọn tháng, 1 buổi `completed` có GV thực dạy = 1 công (kể cả dạy thay/buổi bù), đếm từ sessions không cần bảng riêng; bảng công theo GV (số công, tổng giờ, mở rộng xem từng buổi) + stat buổi chưa gán GV.
  - **HV/PH thấy số buổi còn lại**: thẻ `PackageSummaryCard` (src/components/package-summary.tsx) trên trang chủ học viên + cổng phụ huynh — tự ẩn nếu chưa mua gói, đổi màu vàng cảnh báo khi còn ≤3 buổi.
  - **Siết quyền xem bài học (migration 0014)**: học viên KHÔNG còn thấy toàn bộ thư viện — RLS `read lessons` mới dùng `can_view_lesson(id)`: chỉ thấy bài thuộc giáo trình/khóa học của lớp mình, bài GV gán vào buổi của lớp (kể cả ngoài giáo trình), hoặc bài của buổi được xếp học bù; phụ huynh xem theo con; GV/staff thấy tất cả. /student/library và /student/flashcard tự lọc theo (đều dùng fetchLessons + RLS). Kho từ vựng vẫn mở cho mọi người đăng nhập (tính năng tra cứu).
- **Dữ liệu thật**: 123 học viên, 62 lớp active, 12 khóa học.
- **Setup cần kiểm tra trước khi làm gì khác** (hỏi tôi nếu chưa chắc):
  1. Migrations **ĐÃ dán đủ đến `0014_lesson_visibility.sql`** (user xác nhận 16/07/2026 — 0013 = gói buổi + thanh toán + view package_balances + notifications + trigger; 0014 = HV chỉ xem bài học của giáo trình lớp mình). Migration mới từ 0015 trở đi mới cần nhắc dán.
  2. Env `SUPABASE_SERVICE_ROLE_KEY` đã có ở `.env.local` + Vercel.
- **Quy ước quan trọng**:
  - `profiles.id` là business key; `profiles.user_id` liên kết auth (null = chưa cấp tài khoản). RLS dùng `my_profile_id()`. `profiles.student_code` = mã thành viên mọi vai trò.
  - Embed profiles phải hint FK: `profiles!classes_teacher_id_fkey`, `profiles!sessions_teacher_id_fkey`, `profiles!class_students_student_id_fkey`, `profiles!submissions_student_id_fkey`, `profiles!parent_students_parent_id_fkey`...
  - Khu học viên/phụ huynh: hàm trong `db-student.ts` nhận `studentId` và dựa vào RLS — cùng hàm dùng cho HV tự xem và PH xem con.
  - Đề bài `questions.content` KHÔNG chứa đáp án; đáp án ở `question_answers` (HV không đọc được). Quy ước jsonb từng dạng câu ghi ở đầu `src/lib/db-content.ts` (trắc nghiệm `"B"`, điền từ `["了","的"]`, nối `{"0":"b"}`, sắp xếp `["我","喜欢",...]`). Nộp bài qua RPC `submit_homework(hw_id, my_answers)` — so đáp án bằng jsonb equality, thang 10.
  - Lỗi Postgres 23P01 = trùng lịch phòng/GV; 23503 = còn dữ liệu gắn kèm.
  - Tôi không chạy được SQL trực tiếp — cần đổi schema thì viết migration mới trong `supabase/migrations/` và hướng dẫn tôi dán vào SQL Editor.
  - Commit message tiếng Việt, push main → Vercel tự deploy. Khu học viên/phụ huynh phải mobile-first.

## Việc nhỏ còn dở

- (Không còn việc tay nào — migrations đã dán đủ đến 0014, toàn bộ JSON thư viện đã import vào DB 16/07/2026.)
- YCT 1 mới có từ vựng + ngữ pháp, **chưa có bộ bài tập theo bài** — nếu tôi yêu cầu thì soạn từ các "Bài thi mẫu" trong sách (PDF ở ~/Downloads/YCT1 Tieng Viet.pdf). Tôi còn dạy YCT 2 (PDF ở ~/YCT CHINESE/YCT2 PPT VIP/YCT2.pdf) — trích cùng format khi được yêu cầu.

## Việc cần làm: Giai đoạn 2 — phần còn lại

Theo lộ trình `docs/KE-HOACH-CHUC-NANG.md` (mục 6, Giai đoạn 2):

1. **GV đăng ký nghỉ / đề xuất đổi buổi** → admin duyệt + xếp GV dạy thay (buổi đã có constraint chống trùng lịch GV; nhớ trigger thông báo cho HV/PH khi đổi lịch — bảng notifications đã sẵn, thêm type mới thì nới check constraint `notifications_type_check`).
2. **Bài kiểm tra định kỳ có giới hạn thời gian** (dựa trên hạ tầng homeworks/questions sẵn có + đếm giờ).
3. **Hàng chờ chấm tay** (tự luận, ghi âm — mục 5.3): thêm dạng câu không tự chấm, submissions có trạng thái chờ GV chấm, điểm chốt khi GV chấm xong.
4. **Zalo OA/ZNS** khi trung tâm có OA: bảng notifications đã có cột `channel` ('inapp'/'zalo') — cần worker gửi + template ZNS.
5. (Tùy chọn, nếu tôi yêu cầu) Nâng cấp học phí: sửa gói đã bán, báo cáo doanh thu theo tháng, xuất Excel công nợ.

Làm xong build + commit + push, cập nhật lại file này cho session sau.
