# Classroom: gọi tên và ảnh lớp

Áp dụng `supabase/migrations/0054_class_photos.sql` trước khi triển khai bản giao diện này. Migration tạo kho ảnh riêng tư, bảng ảnh theo lớp và RPC lưu cả lượt gán ảnh trong một giao dịch.

Trong chi tiết lớp (giáo viên hoặc quản lý), mở **Ảnh lớp & học viên → Quản lý ảnh**. Chọn ảnh tập thể, bấm khuôn mặt, chọn tên rồi **Lưu ảnh**. Có thể kéo/phóng to ảnh, thay ảnh từng người, hoặc gỡ ảnh. Ảnh cắt lấy từ độ phân giải của nguồn; ảnh tập thể lưu tối đa 2400px, chân dung lưu 512×512. Ảnh lớp dùng riêng cho lớp đó và ưu tiên hơn avatar hồ sơ trong classroom.

Trong classroom, **Gọi tên** có vòng quay hiện tại, ảnh bay và đua bi. Chỉ học viên có mặt được tham gia. Ba phương thức dùng chung lịch sử tránh gọi trùng, lưu theo buổi trong trình duyệt; gọi hết lớp thì vòng kế tiếp bắt đầu lại. Đóng công cụ hủy lượt đang chạy. Lựa chọn kết quả ngẫu nhiên diễn ra trước phần hoạt ảnh; đường đua là hoạt ảnh minh họa, không dùng va chạm vật lý để quyết định xác suất.

Giáo viên của lớp, giáo viên được gán buổi và người có quyền `classes.manage` được cập nhật ảnh. Học viên và người ngoài lớp không được truy cập bộ ảnh qua API. URL ảnh có hạn 6 giờ; classroom tải lại ảnh khi cửa sổ được focus.

Kiểm tra:

```sh
node --test tests/classroom-picker.test.cjs
node tools/classroom/test-photo-migration.mjs /path/to/@electric-sql/pglite/dist/index.js
node tools/classroom/test-name-picker-ui.cjs /path/to/playwright
npm run build
```

Kiểm thử trình duyệt dựng route tạm, dùng dữ liệu và Storage giả trên localhost, chạy Chrome cài trên máy và dọn route khi kết thúc. Ảnh chụp kiểm tra lưu ở `/private/tmp/classhub-name-picker-ui`. Không ghi dữ liệu lên Supabase thật.
