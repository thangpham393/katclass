# Tổng kết cập nhật CLASSHUB — 03/11/2026

Đợt này làm lại **Bảng điều khiển** của admin, thêm phần **theo dõi lớp cho giáo viên**, **phiếu chăm sóc học viên**, bảng **các buổi đã học** trong lớp và tính năng **lớp lên khóa mới**. Tất cả đã lên bản chính.

> Kỹ thuật: ba migration **0061_care_requests.sql**, **0062_class_course_stages.sql** và **0063_teachers_see_all_comments.sql** phải được chạy trên Supabase thì các phần mới mới hoạt động.

---

## 1. Bảng điều khiển (admin)

Mở trang là thấy ngay việc gì cần xử lý, lọc được theo **cơ sở** và theo **giáo viên**. Thứ tự từ trên xuống:

| Khối | Dùng để làm gì |
| --- | --- |
| Thông điệp hôm nay | Câu nói trong ngày, cả trung tâm thấy chung một câu |
| 4 ô vận hành | Chăm sóc đang mở · Buổi học chưa cập nhật · Học viên cần chú ý · Chuyên cần 30 ngày |
| 4 ô kinh doanh | Doanh thu tháng (so cùng kỳ tháng trước) · Công nợ quá hạn · Đăng ký mới tháng · Nghỉ học tháng *(chỉ người có quyền học phí / học viên mới thấy)* |
| Việc cần xử lý ngay | 8 ô có số đếm, bấm là tới trang xử lý: buổi 7 ngày tới chưa có GV · GV xin nghỉ/đổi buổi · HV xin nghỉ · chờ xếp học bù · đã dạy chưa điểm danh · hết buổi vẫn đang học · khách mới chưa liên hệ · học cụ sắp hết |
| Lớp học hôm nay | Bấm vào buổi → mở chi tiết buổi; bấm "Chưa ghi/Đã ghi" → chấm công hộ GV |
| Học viên chưa nhận xét | Buổi đã dạy 14 ngày qua còn HV có mặt chưa được nhận xét; **bấm tên em → mở đúng buổi đó, ô nhận xét tự bật** |
| Buổi học chưa cập nhật | Chưa chấm công quá 24 giờ hoặc chấm rồi mà chưa điểm danh |
| Học viên cần chú ý | Nghỉ nhiều · thiếu bài tập · điểm trung bình thấp |
| Chăm sóc đang mở | Phiếu chăm sóc Mới / Đang xử lý, quá hạn tô đỏ |
| Học phí | Học viên sắp hết buổi · Công nợ quá hạn |
| Lớp cần lên kế hoạch | Lớp kết thúc trong 21 ngày (mở lớp nối tiếp, chốt tái phí) hoặc sĩ số dưới 4 |
| Giữ chân học viên | Ai nghỉ trong tháng và lý do · bảo lưu sắp đến hẹn quay lại · sinh nhật 7 ngày tới |
| Giáo viên | Mỗi GV: buổi đã dạy, chấm công trễ, đang thiếu công, chưa điểm danh, buổi chưa nhận xét |
| Tình hình các lớp | Sĩ số, đã dạy, buổi gần nhất, buổi nghỉ, chuyên cần, chưa cập nhật — xuất Excel được |

Các bảng bấm tiêu đề cột để sắp xếp; bảng dài thì cuộn trong khung (~10 dòng).

**Học viên sắp hết buổi** tính theo hai cách:
- Có gói học phí trên app: còn dưới 6 buổi, hoặc đã hết mà vẫn đang học.
- Chưa có gói trên app (học phí đang nhập nơi khác): lấy số buổi còn lại **theo tiến độ lớp**, hiện khi còn dưới 3 buổi.

## 2. Trang chủ giáo viên

Giữ nguyên phần cũ (ca dạy Hôm qua / Hôm nay / Ngày mai, lớp phụ trách). Bên dưới có thêm khối **"Theo dõi lớp của tôi"**:
- 4 ô: buổi chưa cập nhật · học viên cần chú ý · học viên chưa nhận xét · chuyên cần 30 ngày.
- Các bảng: học viên chưa nhận xét · buổi chưa cập nhật · học viên cần chú ý · chăm sóc đang mở (chỉ xem) · tình hình các lớp.

Giáo viên **chỉ thấy lớp mình phụ trách và các buổi mình đứng lớp**. Không có học phí, doanh thu, khách tiềm năng hay số liệu của giáo viên khác.

## 3. Phiếu chăm sóc học viên

Mục menu mới **Chăm sóc học viên** (`/admin/care`), chấm đỏ đếm số phiếu Mới.
- Mỗi phiếu có mã **YC0001…**, học viên, lớp, vấn đề, nguồn, người xử lý, hạn, trạng thái **Mới → Đang xử lý → Đã xong / Huỷ**.
- **Tự mở phiếu** khi học viên vắng từ 2 buổi liên tiếp (buổi lớp nghỉ không tính), hạn 2 ngày sau buổi vắng.
- Ghi một lần liên hệ ở trang **Vắng liên tiếp** → phiếu tự chuyển *Đang xử lý* (người gọi thành người xử lý). Chọn kết quả *"Đã xử lý xong"* → phiếu tự đóng.
- Tạo phiếu tay cho các việc khác (kiểm tra, bài tập, học phí, giáo viên đề xuất…). Nút nhanh **Tôi nhận** / **Xong** trên từng dòng.

## 4. Lớp học

**Bảng "Các buổi đã học"** trong trang chi tiết lớp (admin và giáo viên): mọi buổi tới hôm nay, gồm GV đứng buổi, tình trạng chấm công, điểm danh (có mặt / vắng), nhận xét (đủ hay thiếu mấy em), nội dung bài. Bấm ngày để mở buổi; xuất Excel được. Phía giáo viên, bảng này thay cho thẻ "Buổi đã qua" cũ.

**Lên khóa mới** — dùng khi lớp học xong khóa và học tiếp khóa sau (ví dụ YCT 1 → YCT 2):
1. Trang lớp → thẻ tiến độ → **Lên khóa mới**.
2. Chọn khóa tiếp theo và ngày khóa mới bắt đầu (mặc định: buổi ngay sau buổi cuối của khóa cũ).
3. Kết quả: khóa cũ lưu vào lịch sử lớp; các buổi từ ngày đó đánh lại số từ Buổi 1; tiến độ chỉ đếm khóa mới; học viên đang học được ghi danh khóa mới. Học viên, giáo viên, ảnh, lịch tuần giữ nguyên.

**Quy định mới:** khi khóa hiện tại **đã đủ số buổi**, app **không cho sinh thêm buổi học** (chặn cả trên giao diện lẫn cơ sở dữ liệu). Muốn xếp buổi tiếp theo thì phải **Lên khóa mới** trước. Khi khóa chưa đủ, "Sinh buổi học" cũng chỉ sinh tối đa số buổi còn thiếu.

> Ô chọn "Khóa học" ở đầu trang lớp chỉ dùng để **sửa khi gán nhầm khóa** — không ghi lịch sử, không đánh lại số buổi.

## 5. Thay đổi nhỏ khác

- **Ảnh học viên:** danh sách Học viên, hồ sơ học viên và "Học viên của tôi" dùng ảnh đã cắt trong lớp (ảnh mới nhất); chưa có thì dùng ảnh hồ sơ.
- **Ô "Đã dạy chưa điểm danh":** 1 buổi → mở thẳng buổi đó; nhiều buổi → cuộn tới bảng "Buổi học chưa cập nhật".
- **Trang chi tiết buổi** mở được thẳng ô nhận xét cho một học viên (từ bảng "Học viên chưa nhận xét"), và ghi tên người đã viết nhận xét.

## 6. Các ngưỡng cảnh báo đang dùng

| Ngưỡng | Giá trị |
| --- | --- |
| Nghỉ nhiều | từ 2 buổi trong 30 ngày |
| Thiếu bài tập | từ 2 lần trong 30 ngày |
| Kết quả yếu | điểm TB dưới 5 (thang 10) |
| Chấm công trễ / chưa cập nhật | quá 24 giờ sau giờ tan lớp |
| Tự mở phiếu chăm sóc | vắng từ 2 buổi liên tiếp, hạn 2 ngày |
| Sắp hết buổi | dưới 6 buổi (theo gói) · dưới 3 buổi (theo tiến độ lớp) |
| Công nợ quá hạn | gói bắt đầu quá 14 ngày chưa đóng đủ |
| Lớp sắp kết thúc / sĩ số thấp | trong 21 ngày / dưới 4 học viên |
| Bảo lưu sắp quay lại · sinh nhật | trong 14 ngày · trong 7 ngày |
| Nhắc nhận xét từng buổi | các buổi trong 14 ngày qua |

Cần đổi ngưỡng nào thì báo lại để chỉnh.

## 7. Lưu ý khi dùng

- **Khóa học phải ghi tổng số buổi** thì mới tính được tiến độ, "sắp kết thúc" và chặn sinh buổi.
- Lớp đã học **vượt** tổng buổi của khóa (đã sang khóa mới nhưng chưa ghi nhận) → vào lớp bấm **Lên khóa mới** để số liệu đúng.
- **Nhận xét đồng bộ:** nhận xét từng buổi do admin, giáo viên lớp hay giáo viên dạy thay viết đều hiện cho giáo viên của buổi/lớp đó, cho học viên và phụ huynh (phụ huynh nhận thông báo). Ô nhận xét ghi tên người viết; giáo viên sửa lại thì nhận xét chuyển sang tên giáo viên đó.
- "Đăng ký mới tháng này" đếm khách tiềm năng chuyển *Đã đăng ký* và được cập nhật trong tháng (app chưa lưu ngày chuyển trạng thái).
- App **chưa có hàng chờ chấm bài tay**: bài nộp luôn được tự chấm ngay.
