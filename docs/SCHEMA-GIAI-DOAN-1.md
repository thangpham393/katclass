# Schema Giai đoạn 1 — CLASSHUB

> File SQL: [`supabase/migrations/0002_core.sql`](../supabase/migrations/0002_core.sql) và [`0003_content.sql`](../supabase/migrations/0003_content.sql). Chạy theo đúng thứ tự trong Supabase SQL Editor.

## Sơ đồ tổng quan

```
branches (cơ sở)
   └── profiles (user: student/parent/teacher/staff/admin)
   │       └── parent_students (phụ huynh ↔ con, n-n)
   └── courses (khóa học - khuôn mẫu: HSK1-6, số buổi chuẩn)
   └── rooms (phòng học)
   └── classes (lớp = instance của khóa, có GV phụ trách)
           ├── class_schedules (lịch lặp hằng tuần → sinh sessions)
           ├── class_students (học viên trong lớp, n-n)
           └── sessions (buổi học cụ thể: ngày, giờ, phòng, GV thực dạy)
                   ├── attendance (điểm danh từng học viên/buổi)
                   │       └── makeup_credits (quyền học bù, tự sinh khi vắng có phép)
                   ├── session_comments (nhận xét từng học viên sau buổi)
                   └── session_lessons (nội dung ôn tập gán cho buổi)

Thư viện nội dung (dùng chung toàn trung tâm):
vocab_items (từ vựng: hán tự + pinyin + nghĩa + audio)
lessons (bài học giáo trình, gắn course) ── lesson_vocab (n-n với vocab)
questions (ngân hàng câu hỏi, ĐỀ BÀI không chứa đáp án)
question_answers (đáp án tách riêng — chỉ GV/staff đọc được)
homeworks (bài tập giao cho lớp) ── homework_questions (n-n với questions)
submissions (bài nộp + điểm, chấm tự động qua RPC submit_homework)
```

## Các quyết định thiết kế chính

1. **Chính sách điểm danh (đã chốt 15/07/2026):** mọi trạng thái điểm danh đều trừ buổi trong gói; vắng **có phép** thì trigger tự sinh `makeup_credits` (quyền học bù); vắng **không phép** không có học bù; buổi đi học bù (`attendance.status = 'makeup'`) không trừ thêm buổi. Từ `0005_makeup_flow.sql`: điểm danh 'makeup' tự đóng quyền học bù (`status = 'attended'`), và GV xem được các quyền học bù xếp vào buổi mình dạy.
2. **Chống trùng lịch ở tầng database:** hai exclusion constraint trên `sessions` khiến Postgres **từ chối thẳng** việc xếp 2 buổi chồng giờ cùng phòng hoặc cùng giáo viên — không cần tin vào logic phía app.
3. **Chống lộ đáp án:** đề bài (`questions.content`) học viên đọc được để làm bài, nhưng đáp án nằm ở bảng riêng `question_answers` mà RLS chỉ cho giáo viên/staff đọc. Học viên nộp bài qua RPC `submit_homework` — server so đáp án và trả về điểm, đáp án không bao giờ xuống trình duyệt.
4. **Phân quyền bằng RLS:** mọi bảng bật Row Level Security. Các hàm helper (`my_role`, `is_staff`, `is_my_student`, `can_view_class`, `teaches_session`) dùng `security definer` để tránh đệ quy chính sách. Nguyên tắc: học viên chỉ thấy dữ liệu của mình, phụ huynh thấy của con (qua `parent_students`), giáo viên thấy/ghi trong phạm vi lớp mình dạy, staff/admin thấy tất cả.
5. **GV thực dạy tách khỏi GV phụ trách:** `classes.teacher_id` là GV phụ trách lớp, `sessions.teacher_id` là người thực dạy buổi đó — sẵn sàng cho nghiệp vụ dạy thay và chấm công theo buổi (Giai đoạn 2).
6. **`session_no` trên buổi học** để hiển thị "buổi 5/24"; số buổi còn lại của học viên sẽ tính khi có bảng gói học phí (Giai đoạn 2) — cấu trúc điểm danh hiện tại đã đủ dữ liệu để tính ngược.

7. **Cổng phụ huynh (0010):** phụ huynh cũng đăng nhập bằng mã (`PHKAT...`, trigger cấp mã mở rộng cho role `parent`); policy `read team profiles` cho phép mọi người đăng nhập đọc hồ sơ teacher/staff/admin để học viên/phụ huynh thấy tên giáo viên trong lịch học và nhận xét. Liên kết phụ huynh ↔ con qua `parent_students` (admin thao tác ở trang chi tiết thành viên).
8. **Quy ước jsonb câu hỏi (app):** đề bài trong `questions.content`, đáp án trong `question_answers.answer` — cấu trúc từng dạng câu ghi ở đầu `src/lib/db-content.ts`. Điểm chấm tự động thang 10, RPC `submit_homework` cho phép nộp lại (ghi đè điểm).

## Những gì chưa nằm trong schema này (chủ đích, theo lộ trình)

- Gói học phí, thanh toán, công nợ → Giai đoạn 2 (bảng `enrollment_packages`, `payments`).
- Chấm công lương, thông báo đa kênh → Giai đoạn 2.
- Câu hỏi tự luận/ghi âm + hàng chờ chấm tay → Giai đoạn 2 (thêm `type` mới + cột `manual_score`).
- SRS, gamification, CRM → Giai đoạn 3.

## Quy ước cho code phía app

- Đáp án lưu trong `question_answers.answer` theo **dạng jsonb chuẩn hóa** (ví dụ trắc nghiệm: `"B"`, điền từ: `["了","的"]`, nối: `{"1":"a","2":"c"}`). Client phải gửi câu trả lời đúng dạng đó khi gọi `submit_homework(hw_id, my_answers)`.
- Sinh buổi học: app đọc `class_schedules` và tạo `sessions` cho N tuần tới; nếu Postgres báo lỗi exclusion constraint tức là trùng phòng/GV → hiển thị cảnh báo cho người xếp lịch.
- Điểm danh xong buổi nào thì cập nhật `sessions.status = 'completed'`.
