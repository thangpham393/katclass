# Import chi nhánh Quận 2 — danh sách 2026

Nguồn: `DANH SÁCH HỌC VIÊN QUẬN 2 (2026) - 2026.pdf`, 1 trang, được đối chiếu cả nội dung văn bản và ảnh PDF. Dữ liệu rà soát nằm trong `roster.json`.

- 6 lớp, 15 học viên; 13 liên kết phụ huynh qua 10 số điện thoại khác nhau.
- Thêm số 0 trước số điện thoại có 9 chữ số; giữ số gốc trong ghi chú học viên.
- SĐT lưu trong hồ sơ `parent`, liên kết bằng `parent_students` để hiển thị đúng cột điện thoại phụ huynh. Tên phụ huynh được đặt theo tên các học viên vì nguồn không ghi tên phụ huynh.
- Dương Thanh Ngọc và Nguyễn Khả Di chưa có số phụ huynh.
- 9 lịch tuần cho 5 lớp; PREKIDS01001 chưa có ngày/giờ học.
- Tên 3 giáo viên giữ đúng nhãn trong PDF. Tạo hồ sơ chưa liên kết tài khoản tại Quận 2; không tự đồng nhất “Cô Thùy Dương” với các hồ sơ có họ tên đầy đủ ở chi nhánh khác.
- Ngày khai giảng và ngày nhập học để trống vì nguồn không có. Ngày vào lớp ghi ngày import 05/10/2026. Trạng thái lớp/học viên là đang học.
- Không sinh buổi học cụ thể khi nguồn chưa có ngày bắt đầu.

Chạy từ thư mục gốc dự án, dùng kết nối trong `.env.local` (không in khóa):

```sh
python3 tools/quan2-import/import_live.py          # kiểm tra, kế hoạch chỉ đọc
python3 tools/quan2-import/import_live.py --apply  # nhập và đọc lại kiểm chứng
python3 tools/quan2-import/import_live.py --verify # kiểm tra lại, không ghi
```

Yêu cầu `pdftotext` và PDF nguồn tại đường dẫn Downloads khai báo trong script. Import kiểm tra toàn bộ bảng liên quan trước khi ghi, tạo ID ổn định, chỉ chèn bản ghi còn thiếu và dừng khi dữ liệu đã có khác với nguồn. REST chèn theo bảng, không phải một transaction xuyên bảng; chạy lại tiếp tục các phần còn thiếu mà không tạo trùng. Trigger có sẵn tự cấp mã học viên và gán giáo viên chính.

Bản chụp trước import lưu trong `work/` (được bỏ qua bởi Git). Sau import, script đối chiếu từng trường, quan hệ, lịch tuần, mã học viên và bảo đảm các bản ghi ngoài phạm vi import vẫn giữ nguyên; kết quả ở `import-report.json`.
