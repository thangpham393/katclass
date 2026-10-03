---
name: classhub-workbook-import
description: "Số hoá phiếu bài tập PDF và import vào Bộ bài tập theo giáo trình, bài học và level trên CLASSHUB. Dùng khi nhập các level HSK tiếp theo, kiểm tra độ phủ câu hỏi, xử lý đáp án nguồn hoặc rà soát dạng bài cần bổ sung."
---

# Import phiếu bài tập CLASSHUB

Làm việc trong repo CLASSHUB (máy hiện tại: `/Users/hathang/CLASSHUB`). Mục tiêu là
đưa đầy đủ bài tập nguồn vào đúng giáo trình/bài, học viên làm được và chấm được,
có báo cáo đối chiếu sau nhập. Khi chỉ được yêu cầu chuẩn bị dữ liệu hoặc rà soát,
giữ phạm vi đó; lưu skill không có nghĩa là bắt đầu nhập level mới.

## Chọn nguồn và giáo trình

- Tìm đường dẫn thực tế trong Downloads bằng danh sách file; tên tiếng Việt có
  thể ở dạng Unicode NFD. Không ghép đường dẫn theo tên nhìn thấy rồi kết luận
  thiếu file. Nguồn HSK trước đây nằm dưới `PHIẾU BÀI TẬP THEO TỪNG BÀI HSK 3.0`.
- Đọc danh sách giáo trình và bài học hiện có. Xác định `textbook.code`, ID, level,
  edition và ánh xạ số bài sang `lessons.id`; không suy đoán ID/code từ HSK 1.
- Kiểm tra số bài và chủ đề **trong PDF**, không chỉ tên file. Tính SHA-256 để
  phát hiện file trùng hoặc ghi nhầm bài. Nếu ánh xạ không rõ, hỏi về phần đó và
  tiếp tục các bài độc lập. Quyết định bỏ Bài 7 chỉ áp dụng bộ HSK 1 đã làm.
- Khi bổ sung bài tập vào giáo trình có sẵn, giữ tên bài, từ vựng, ngữ pháp và
  metadata. Payload qua importer giao diện dùng chính tiêu đề hiện có, bỏ các
  field ngoài bài tập; xem tác dụng cập nhật trong `src/lib/db-library.ts`.

## Số hoá và rà soát dạng bài

Đọc [references/classhub-formats.md](references/classhub-formats.md) trước khi
chuẩn bị JSON hoặc thay đổi schema. Mã nguồn và schema live là căn cứ hiện tại.

- Trích xuất với Poppler `pdftotext -layout` và bản raw khi cần. Kiểm tra trang
  có nhiều cột, cuối trang bị cắt, đề/đáp án xuống dòng. Xem ảnh trang PDF khi text
  không đủ; nếu PDF scan thì OCR rồi đối chiếu hình. Giữ PDF gốc.
- Lập danh sách dạng bài của **toàn bộ** level trước khi thiết kế parser. Dùng
  dạng native cho dịch câu, Hán-Pinyin, nối ba cột, sắp xếp có Pinyin; không tách
  thành câu phụ chỉ để né giới hạn giao diện. Đọc hiểu giữ đoạn văn và câu con.
- Với dạng chưa hỗ trợ, ghi rõ khoảng trống. Nếu yêu cầu bao gồm bổ sung, cập nhật
  đồng bộ type/validator, soạn-sửa câu, preview, chọn giao bài, màn hình học viên,
  trạng thái đã trả lời và RPC chấm; thêm migration kế tiếp, kiểm thử trước nhập.
- Tách `content` và đáp án. Giữ chữ Hán, dấu thanh, ngữ cảnh và lựa chọn; không
  đưa đáp án mẫu vào prompt/hint. Lưu nguồn trong `content.source` với file, hash,
  unit, section, numbers; lưu sửa lỗi và căn cứ trong `corrections.json`.
- Đối chiếu từng khóa đáp án với đề. Đáp án suy ra phải có căn cứ và đánh dấu;
  câu không đủ dữ liệu hoặc có nhiều cách hiểu chưa giải quyết thì để chờ, không
  gán đáp án đoán. Câu dịch chấp nhận mẫu khai báo, không hứa chấm ngữ nghĩa.

## Nhập có thể chạy lại

- Tham khảo `tools/hsk1-import/`, nhưng parser/importer/migration ở đó cố định
  HSK 1 và 15 bài. Tạo công cụ cho level đích; không chạy nguyên script HSK 1
  cho HSK 2–6 hay thay ID bằng tìm-thay trong migration 0050.
- Đọc dữ liệu live trước khi ghi; kiểm tra schema/type cần dùng đã được áp dụng.
  Có file SQL trong repo không chứng minh migration đã chạy. Chỉ có service key
  REST không đồng nghĩa có kết nối SQL: chuẩn bị migration và nêu rõ bước chưa
  áp dụng nếu không có phương tiện chạy SQL đã được cấp quyền.
- Dùng ID xác định hoặc ánh xạ ID tường minh, khóa trùng theo lesson + type +
  content JSON ổn định. Ghép đáp án bằng ID, không dựa thứ tự trả về của insert.
  Trước ghi, lập kế hoạch thêm/bỏ qua/xung đột và lưu bản sao câu + đáp án liên quan.
- Chia lô ghi và truy vấn đáp án; phân trang đọc câu hỏi để tránh giới hạn 500/1000
  và URL quá dài. Chạy lại phải bỏ qua câu đã đủ và bổ sung đáp án thiếu sau gián đoạn.
  Dữ liệu khác nội dung/đáp án phải được rà soát, không upsert ghi đè âm thầm.
- Nếu chuyển đổi bản nhập cũ, dùng migration có giao dịch, đối chiếu dữ liệu trước
  ghi, rollback khi có chỉnh sửa và kiểm tra chạy lại. Câu đã nằm trong homework
  hoặc test template giữ ID/nội dung/đáp án cũ; đưa bản mới vào kho chọn bài. Không
  sửa lượt nộp hay các tham chiếu đang dùng. Xem mẫu 0050 và test PostgreSQL của HSK 1.
- Đọc credential từ cấu hình được phép; không in/lưu secret vào skill, JSON,
  báo cáo, SQL hoặc Git. Quyền ghi/triển khai vẫn theo yêu cầu của phiên hiện tại.

## Kiểm chứng và bàn giao

Đếm độ phủ theo `source.numbers` và mục con từng section/bài, không chỉ số bản ghi
database: một bài nối/đọc hiểu chứa nhiều số câu. Không cố định số câu mỗi bài theo
HSK 1. Kiểm tra không thiếu/trùng số nguồn, đủ lựa chọn và đáp án, đúng lesson,
khối sắp xếp khớp đáp án và Pinyin giữ dấu thanh.

Sau nhập, đọc lại **toàn bộ** câu/đáp án và đối chiếu với payload, kiểm tra metadata
và bài bỏ lại; chạy kế hoạch lần hai để chứng minh không tạo trùng. Báo cáo gồm
hash PDF/payload, số nguồn và bản ghi theo bài/dạng, lỗi đã sửa, câu chờ/bỏ lại,
kết quả verify, và phần SQL/triển khai còn chưa làm. Chỉ gọi là đã nhập khi live
verify thành công. Nếu thay mã hoặc chấm điểm, chạy build/typecheck và kiểm thử
các dạng mới, trường hợp chấm sai, từng phần và giới hạn kiểm tra có giờ.
