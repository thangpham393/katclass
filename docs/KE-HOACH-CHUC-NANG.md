# CLASSHUB — Kế hoạch chức năng hệ thống quản lý trung tâm tiếng Trung

> Phiên bản: 1.0 — 15/07/2026
> Stack đã chốt: **Next.js (Vercel) + Supabase** (Postgres, Auth, Storage, Realtime)

---

## 1. Tổng quan

Hệ thống phục vụ 5 nhóm người dùng: **Học viên**, **Phụ huynh**, **Giáo viên** (bao gồm trợ giảng), **Nhân viên hành chính**, **Quản lý trung tâm**.

Nguyên tắc thiết kế nền tảng (quyết định từ đầu, khó sửa về sau):

- **Một tài khoản – nhiều vai trò**: user ↔ role là quan hệ nhiều-nhiều (giáo viên có thể là phụ huynh, hành chính kiêm trợ giảng).
- **Đa cơ sở (multi-branch)**: mọi dữ liệu gắn `branch_id` từ đầu, kể cả khi hiện tại chỉ có 1 cơ sở.
- **Mobile-first**: học viên và phụ huynh dùng gần như 100% trên điện thoại — web responsive/PWA trước, app native tính sau.
- **Khóa học là khuôn mẫu, lớp học là instance**: khóa học (HSK1–6, giao tiếp, thiếu nhi...) định nghĩa số buổi chuẩn, giáo trình, học phí chuẩn; lớp học được mở ra từ khóa học.

---

## 2. Chức năng theo vai trò

### 2.1. Học viên

**Tài khoản & lớp học**
- Đăng ký / đăng nhập bằng Google hoặc email + mật khẩu.
- Xem các lớp mình đang tham gia.
- Xem **thời khóa biểu cá nhân**: lịch học các lớp, lịch học bù, thông báo nghỉ/đổi lịch.
- Xem **điểm danh của chính mình** và **số buổi còn lại** của gói học phí.

**Học tập & ôn tập**
- Xem lại nội dung bài học theo từng buổi: slide bài giảng, từ vựng (flashcard), kiến thức ngữ pháp.
- Flashcard chuẩn tiếng Trung: chữ Hán + pinyin + nghĩa + **audio phát âm** + câu ví dụ; animation thứ tự nét viết (Hanzi Writer).
- **Ôn từ vựng theo spaced repetition (SRS)**: hệ thống tự lên lịch ôn lại từ sắp quên.

**Bài tập & kiểm tra**
- Làm bài tập về nhà giáo viên giao — hệ thống **tự chấm** phần trắc nghiệm ngay khi nộp.
- Làm **bài kiểm tra định kỳ / thi thử**: có giới hạn thời gian, đề trộn từ ngân hàng câu hỏi.
- Nộp **bài nói (ghi âm)** và bài tự luận — giáo viên chấm tay.

**Theo dõi & động lực**
- Biểu đồ thống kê điểm số, thành tích, tiến độ học.
- Nhắc nhở học tập: bài tập mới, sắp đến hạn nộp, đến lịch ôn từ vựng.
- (Giai đoạn 3) Gamification: bảng xếp hạng lớp, chuỗi ngày học liên tục (streak), huy hiệu.

### 2.2. Phụ huynh

- **Liên kết tài khoản phụ huynh ↔ con** (một phụ huynh có thể có nhiều con học tại trung tâm).
- Xem báo cáo thành tích, tình hình học tập của con ở lớp.
- Xem nhận xét của giáo viên về con sau mỗi buổi học.
- Xem danh sách bài tập về nhà của con (đã làm / chưa làm / điểm số) để nhắc con hoàn thành.
- **Thông báo điểm danh tức thời**: con vắng mặt buổi học → phụ huynh nhận thông báo ngay.
- Xem **lịch học của con**, bao gồm lịch học bù và thông báo nghỉ/đổi lịch.
- Xem **học phí**: đã đóng bao nhiêu, còn bao nhiêu buổi, cảnh báo sắp hết khóa / nhắc gia hạn.
- **Kênh liên hệ với trung tâm**: gửi tin nhắn hoặc yêu cầu gọi lại.
- Nhận thông báo chung từ trung tâm (nghỉ lễ, sự kiện, đổi lịch).

### 2.3. Giáo viên (& trợ giảng)

**Lớp học & lịch dạy**
- Quản lý các lớp mình phụ trách: danh sách học viên, tiến độ giáo trình.
- Xem **lịch dạy cá nhân**; **đăng ký nghỉ / đề xuất đổi buổi** để quản lý duyệt và xếp dạy thay.
- **Điểm danh học viên ngay trong buổi dạy** (giáo viên/trợ giảng là người điểm danh chính; hành chính giám sát và xử lý ngoại lệ).
- Chấm công buổi dạy của bản thân.
- Xem **bảng công / bảng lương của chính mình** để đối soát số buổi đã dạy.

**Nội dung & bài tập**
- Thêm giáo trình, bài học, ngân hàng câu hỏi, đề thi vào thư viện chung của trung tâm.
- Set nội dung ôn tập sau mỗi buổi học cho học viên (chọn từ thư viện: từ vựng, slide, ngữ pháp).
- Giao bài tập về nhà (chọn từ thư viện bài tập / ngân hàng câu hỏi, đặt hạn nộp).
- Tạo đề kiểm tra: chọn tay hoặc **trộn tự động từ ngân hàng câu hỏi** theo cấp độ/chủ đề.
- **Hàng chờ chấm tay**: chấm bài tự luận, bài viết đoạn văn, bài nói ghi âm (phần trắc nghiệm hệ thống đã tự chấm).

**Theo dõi học viên**
- Nhận xét từng học viên sau mỗi buổi học (phụ huynh xem được).
- **Thống kê lớp mình dạy**: tỷ lệ nộp bài, điểm trung bình, danh sách học viên đang tụt lại để can thiệp sớm.
- Gửi thông báo cho cả lớp.

### 2.4. Nhân viên hành chính

**Học viên & lớp học**
- Thêm / sửa / xóa học viên, lớp học.
- Quản lý trạng thái học viên: **chờ xếp lớp → đang học → chờ học bù → bảo lưu → kết thúc khóa**.
- Theo dõi chi tiết từng học viên: lịch sử điểm danh, điểm số, thành tích, số buổi còn lại của gói.

**Lịch học & điểm danh**
- Xem và tạo thời khóa biểu cho các lớp (hệ thống **cảnh báo xung đột phòng học và giáo viên**).
- Điểm danh học viên (đi học / vắng có phép / vắng không phép) — vai trò giám sát, xử lý ngoại lệ.
- **Xếp lịch học bù**: học viên vắng có phép → vào danh sách chờ → xếp vào lớp bù hoặc buổi phù hợp → thông báo tự động cho học viên/phụ huynh.

**Học phí (thao tác hằng ngày)**
- **Thu học phí + xuất biên lai** (tiền mặt / chuyển khoản), ghi nhận gói buổi cho học viên.
- **Nhắc phí**: danh sách học viên đến hạn / quá hạn đóng phí, ghi chú kết quả liên hệ.
- Danh sách **cảnh báo gia hạn**: học viên còn ≤ N buổi.

**Nhân sự & liên lạc**
- Quản lý chấm công giáo viên, trợ giảng, nhân viên.
- **Gửi thông báo hàng loạt** cho lớp / phụ huynh (nghỉ lễ, đổi lịch, sự kiện).
- **CRM học viên tiềm năng**: ghi nhận liên hệ mới → tư vấn → học thử → ghi danh (xem 2.5).

### 2.5. Quản lý trung tâm

**Dashboard & báo cáo**
- Dashboard thống kê toàn hệ thống: sĩ số, tỷ lệ chuyên cần, tỷ lệ nộp bài, doanh thu tháng, công nợ học phí.
- Thống kê doanh thu, chi phí, lợi nhuận theo tháng/quý.
- Báo cáo **tỷ lệ gia hạn / giữ chân học viên (retention)**.
- **Xuất báo cáo Excel/PDF**: danh sách lớp, công nợ, bảng lương, doanh thu.

**Vận hành đào tạo**
- Quản lý **khóa học / chương trình học**: cấp độ (HSK1–6, giao tiếp, thiếu nhi...), số buổi chuẩn, giáo trình gắn kèm, học phí chuẩn.
- Quản lý lịch học các lớp (lớp chính, lớp học bù).
- Quản lý **phòng học** — hệ thống chặn/ cảnh báo trùng phòng, trùng giờ, trùng giáo viên.
- Danh sách lớp học, học viên, giáo viên, nhân viên (hành chính, trợ giảng).
- Quản lý điểm danh học viên (đi học / vắng mặt / xếp học bù).
- Thư viện giáo trình, bài tập, ngân hàng câu hỏi, đề thi (duyệt nội dung giáo viên đóng góp).
- Duyệt đơn **nghỉ / đổi buổi** của giáo viên, xếp dạy thay.

**Tài chính & nhân sự**
- Quản lý học phí học viên: gói buổi, ưu đãi, công nợ.
- Quản lý **khuyến mãi / giảm giá** (đăng ký sớm, học viên cũ, anh chị em ruột...) — ghi nhận để báo cáo doanh thu đúng.
- Danh sách điểm danh chấm công của nhân viên, giáo viên.
- **Tính lương, bảng lương** tự động từ dữ liệu chấm công: giáo viên theo buổi/giờ, fulltime theo tháng, trợ giảng theo buổi.
- Quản lý chi phí vận hành (mặt bằng, lương, marketing...).

**Kinh doanh & hệ thống**
- **CRM học viên tiềm năng (phễu tuyển sinh)**: nguồn liên hệ → tư vấn → học thử → ghi danh → xếp lớp; báo cáo tỷ lệ chuyển đổi theo nguồn.
- **Cảnh báo gia hạn**: học viên sắp hết buổi → giao nhân viên tư vấn gia hạn.
- **Phân quyền chi tiết (RBAC)**: ví dụ hành chính không xem bảng lương, trợ giảng chỉ điểm danh không sửa điểm.
- **Nhật ký thao tác (audit log)** cho hành động nhạy cảm: sửa điểm danh, sửa học phí, xóa học viên.
- Quản lý thông báo toàn hệ thống.

---

## 3. Chức năng nền tảng (dùng chung)

- **Hệ thống thông báo đa kênh**: in-app + email, và **Zalo OA/ZNS** (phụ huynh Việt Nam đọc Zalo, gần như không đọc email). Là hạ tầng chung cho mọi tính năng "nhắc nhở": vắng mặt, bài tập, học phí, đổi lịch.
- **Đăng nhập**: Google OAuth + email/mật khẩu (Supabase Auth); phân quyền theo role, một user nhiều role.
- **Lưu trữ**: slide (PDF), audio phát âm, ảnh, file ghi âm bài nói (Supabase Storage).
- **Realtime**: cập nhật điểm danh, thông báo tức thời (Supabase Realtime).
- **Đa cơ sở**: `branch_id` trên mọi bảng dữ liệu chính.
- **Sao lưu dữ liệu định kỳ**.

---

## 4. Đặc thù dạy tiếng Trung

- **Flashcard**: chữ Hán + pinyin + nghĩa + audio + ví dụ; animation thứ tự nét viết (thư viện Hanzi Writer).
- **Dạng câu hỏi tự chấm**: trắc nghiệm, điền từ, nối từ–nghĩa, **sắp xếp từ thành câu** (đặc trưng ngữ pháp tiếng Trung), **nghe audio chọn đáp án**, chọn pinyin đúng cho chữ Hán.
- **Ngân hàng câu hỏi gắn thẻ**: theo giáo trình / cấp độ HSK / chủ đề / dạng bài — giáo viên lọc nhanh khi giao bài, trộn đề tự động được.
- **Bài nói**: học viên ghi âm nộp, giáo viên nghe chấm tay; (tương lai) AI đánh giá phát âm.
- **SRS (spaced repetition)** cho từ vựng — điểm khác biệt giữ chân học viên.

---

## 5. Ba luồng nghiệp vụ then chốt (chốt chính sách trước khi code)

### 5.1. Học phí theo gói buổi (chính sách đã chốt 15/07/2026)
1. Học viên mua gói N buổi (có thể kèm ưu đãi) → hành chính thu tiền, xuất biên lai.
2. Mỗi lần điểm danh **có mặt** → trừ 1 buổi khỏi gói.
3. **Vắng có phép** → vẫn trừ buổi, nhưng được xếp học bù (buổi học bù không trừ thêm).
4. **Vắng không phép** → trừ buổi, không được học bù.
5. Còn ≤ 3 buổi → cảnh báo gia hạn cho hành chính + thông báo phụ huynh.

> Toàn bộ điểm danh, học bù, học phí, doanh thu xoay quanh luồng này.

### 5.2. Học bù
1. Học viên vắng có phép → tự động vào **danh sách chờ học bù**.
2. Hành chính xếp vào lớp bù hoặc buổi trống của lớp khác cùng trình độ.
3. Hệ thống thông báo cho học viên + phụ huynh.
4. Điểm danh buổi bù → đóng yêu cầu học bù.

### 5.3. Chấm bài
1. Học viên nộp bài → hệ thống **tự chấm ngay** phần trắc nghiệm.
2. Phần tự luận / ghi âm → vào **hàng chờ chấm** của giáo viên.
3. Điểm tổng chỉ chốt khi giáo viên chấm xong.
4. Điểm chảy vào: biểu đồ thành tích học viên → báo cáo phụ huynh → thống kê lớp của giáo viên → dashboard quản lý.

---

## 6. Lộ trình xây dựng

### Giai đoạn 1 — Vận hành lõi (MVP)
- Đăng nhập (Google + email/password) + phân quyền theo role.
- Quản lý khóa học, lớp học, học viên, giáo viên, phòng học.
- Thời khóa biểu + kiểm tra xung đột phòng/giáo viên.
- Điểm danh + danh sách chờ học bù + xếp học bù.
- Nội dung ôn tập theo buổi: slide, flashcard từ vựng (có audio), ngữ pháp.
- Thư viện giáo trình + ngân hàng câu hỏi cơ bản.
- Giao bài tập trắc nghiệm tự chấm + hạn nộp.
- Nhận xét học viên sau buổi học.
- Cổng phụ huynh: xem thành tích, nhận xét, bài tập, lịch học của con.

### Giai đoạn 2 — Tiền & thông báo
- Học phí theo gói buổi: thu phí, biên lai, công nợ, nhắc phí, cảnh báo gia hạn.
- Hệ thống thông báo: in-app + Zalo OA/ZNS (vắng mặt, bài tập, lịch học, học phí).
- Chấm công giáo viên / trợ giảng / nhân viên; giáo viên đăng ký nghỉ - đổi buổi.
- Bài kiểm tra định kỳ có giới hạn thời gian; hàng chờ chấm tay (tự luận, ghi âm).
- Dashboard thống kê cơ bản cho quản lý.

### Giai đoạn 3 — Tối ưu & tăng trưởng
- Bảng lương tự động từ dữ liệu chấm công.
- Báo cáo doanh thu – chi phí – lợi nhuận; báo cáo retention; xuất Excel/PDF.
- CRM học viên tiềm năng (phễu tuyển sinh) + báo cáo chuyển đổi theo nguồn.
- SRS flashcard + gamification (bảng xếp hạng, streak, huy hiệu).
- Trộn đề tự động từ ngân hàng câu hỏi; audit log; khuyến mãi.
- (Tùy chọn) AI chấm phát âm bài nói; app mobile native.

> Lương và tài chính xếp ở giai đoạn 3 vì chỉ đúng khi dữ liệu chấm công và học phí ở giai đoạn 1–2 đã chạy ổn định và sạch.

---

## 7. Bước tiếp theo

1. **Chốt chính sách nghiệp vụ** ở mục 5 (trừ buổi khi vắng, chính sách học bù).
2. **Thiết kế sơ đồ dữ liệu (database schema)** cho Giai đoạn 1 — nền tảng quyết định mọi thứ phía sau.
3. Migrate phần Firebase Auth hiện có trong repo sang **Supabase Auth** cho nhất quán với stack đã chốt.
4. Xây dựng theo thứ tự Giai đoạn 1 → 2 → 3.
