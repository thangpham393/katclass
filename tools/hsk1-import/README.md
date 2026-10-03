# Số hoá phiếu bài tập HSK 1 3.0

Lần nhập đầu vào giáo trình `hsk1-new30` trên Supabase đã được đối chiếu thành công
với **584 câu hỏi / đáp án** (`import-report.json`). Sau rà soát dạng bài, dữ liệu
JSON hiện tại chứa **565 mục đúng dạng gốc**, cần migration 0049 và 0050 để chuyển
bản nhập đầu trên hệ thống. Chưa áp dụng hai migration này lên Supabase.
Nguồn: `~/Downloads/PHIẾU BÀI TẬP THEO TỪNG BÀI HSK 3.0/HSK1 3.0`.

- 14 phiếu được nhập: Bài 1–6, 8–15.
- Bài 7 bỏ lại theo yêu cầu người dùng: file Bài 7 trùng **từng byte** với file Bài 9.
- Đủ **785 số câu gốc** (bao gồm các mục được khôi phục từ đáp án).
- Dữ liệu mới: **565 bản ghi câu hỏi, 565 đáp án**; giữ đủ 785 số câu gốc.
- Giáo trình, tên bài, từ vựng, ngữ pháp và bài tập đã giao không được sửa bởi script nhập.

## Dữ liệu và kiểm chứng

- `../../supabase/library/hsk1-new30-baitap.json`: dữ liệu câu hỏi/đáp án, tương thích với import JSON của hệ thống.
- `manifest.json`: SHA-256 từng PDF, số câu, dạng bài và toàn bộ hiệu chỉnh nguồn.
- `corrections.json`: các hiệu chỉnh thủ công và câu mẫu bổ sung để tái tạo dữ liệu.
- `import-report.json`: kết quả đối chiếu lần nhập đầu (584 mục, định dạng cũ),
  chưa phải kết quả chuyển đổi sang định dạng mới.
- `work/`: bản trích xuất và bản sao dữ liệu trước nhập; không đưa vào Git.

| Bài | Số câu gốc | Bản ghi mới sau chuyển đổi |
| --- | ---: | ---: |
| 1 | 25 | 21 |
| 2–3 | 50 mỗi bài | 41 mỗi bài |
| 4–6, 8–15 | 60 mỗi bài | 42 mỗi bài |
| 7 | Bỏ lại | 0 |
| Tổng | 785 | 565 |

## Rà soát dạng bài và bổ sung

| Dạng trong PDF | Hỗ trợ sau bổ sung |
| --- | --- |
| Chọn Pinyin / trắc nghiệm | Có sẵn; giữ nguyên |
| Điền từ | Có sẵn; giữ nguyên |
| Đọc hiểu gồm đoạn văn và 10 câu con | Có sẵn; giữ nguyên |
| Dịch câu Việt → Trung | Thêm `translation`, ô viết câu và nhiều đáp án mẫu |
| Viết chữ Hán và Pinyin (Bài 1) | Thêm `hanzi_pinyin`, hai ô trả lời / hai phần điểm |
| Nối chữ Hán – Pinyin – nghĩa (Bài 1) | Thêm `multi_matching`, hai liên kết độc lập cho mỗi từ |
| Nối 10 từ – nghĩa | Mở rộng `matching` tới 26 mục (A–Z), không chia nhóm |
| Sắp xếp câu và viết Pinyin (Bài 1) | Thêm tùy chọn `require_pinyin` cho `reorder` |

Phần soạn câu hỏi, sửa câu, import JSON, chọn câu khi giao bài và màn hình học viên
đều dùng các định dạng mới. Kho câu hỏi tải theo trang thay cho giới hạn 500 mục.
Đáp án mẫu vẫn nằm riêng trong `question_answers`, không gửi tới học viên.

Câu dịch / chữ Hán / Pinyin chuẩn hóa Unicode, khoảng trắng, chữ hoa và dấu câu.
Pinyin phải đúng dấu thanh. Câu dịch chỉ chấp nhận các mẫu giáo viên khai báo,
không chấm ngữ nghĩa tự do. Bài nối tính điểm từng liên kết; Hán-Pinyin và sắp xếp
có Pinyin tính riêng từng phần. Toàn bộ bộ bài có 805 phần đáp án được chấm.

## Những khác biệt trong nguồn

Các lỗi được sửa rõ trong `manifest.json`: khóa Pinyin 加拿大, khóa nối từ Bài 9,
phương án trùng ở Bài 5/10, đáp án điền từ Bài 6, khối chữ thừa/thiếu, và phần bị cắt
cuối trang ở Bài 1/8/11. Bài 8 thiếu khóa đọc hiểu; Bài 12–14 thiếu đáp án dạng 4–5;
đáp án được bổ sung bằng cách đối chiếu đoạn văn, khối chữ và đề dịch.

Gắn bài tập **theo số bài trên phiếu**, giữ tên bài hiện có. Chủ đề Bài 11–15 trong
PDF khác tên bài của giáo trình trong hệ thống:

| Bài | Chủ đề PDF | Tên bài trong giáo trình |
| --- | --- | --- |
| 11 | 现在几点？ | 我读大学呢 |
| 12 | 明天天气怎么样？ | 昨天下雪了 |
| 13 | 他在学做中国菜呢 | 请给我一杯茶 |
| 14 | 我明年去中国学习汉语 | 我看了一个电影 |
| 15 | 你去过中国吗？ | 大兴机场见！ |

## Áp dụng bản cập nhật

Triển khai mã giao diện cùng bản cập nhật này, rồi chạy trong Supabase SQL Editor
theo thứ tự:

1. `supabase/migrations/0049_written_exercise_types.sql`: mở rộng loại câu hỏi,
   bổ sung chấm điểm, giữ các điều kiện của bài kiểm tra có giờ.
2. `supabase/migrations/0050_hsk1_native_exercises.sql`: chuyển 159 mục, giữ nguyên
   406 mục, đưa 19 mục tách thừa ra khỏi kho chọn bài; còn 565 mục.

0050 đối chiếu nội dung / đáp án trước khi ghi, chạy trong một giao dịch và chạy lại
không tạo bản trùng. Nếu phát hiện giáo viên đã sửa câu cần chuyển đổi, migration
dừng và rollback để rà soát. Câu có trong bài đã giao hoặc mẫu đề giữ ID, nội dung
và đáp án cũ dưới dạng snapshot; bản mới dùng ID riêng. Không xóa câu hỏi, bài đã
giao, lượt nộp hay mẫu đề. Bài 7 tiếp tục bỏ lại.

Sau khi chạy SQL, dùng `import_live.py --verify` để đối chiếu trực tiếp hệ thống;
script sẽ cập nhật báo cáo kiểm chứng. Không dùng import JSON hoặc `--apply`
trước hai migration để tránh tạo thêm bản trùng định dạng cũ.

## Tái tạo / kiểm chứng

Yêu cầu Python 3, Poppler (`pdftotext`) và `.env.local` chứa thông tin Supabase.
Không in hoặc lưu khoá truy cập trong dữ liệu/báo cáo.

```sh
python3 tools/hsk1-import/digitize.py
python3 tools/hsk1-import/prepare_native_upgrade.py # cần bản sao lần nhập đầu trong work/
python3 tools/hsk1-import/import_live.py          # chỉ đọc, lập kế hoạch
python3 tools/hsk1-import/import_live.py --apply  # chỉ sau migration 0049 + 0050
python3 tools/hsk1-import/import_live.py --verify # chỉ đọc, đối chiếu
```

Script chỉ thêm vào giáo trình đã tồn tại; dừng nếu còn bản nhập cũ / khác nội dung.
UUID được tạo xác định từ nội dung, đáp án gắn bằng UUID tường minh.
Chạy lại cùng dữ liệu bỏ qua câu đã có và bổ sung đáp án còn thiếu sau lần nhập gián đoạn.
Không ghi đè câu hỏi/đáp án có nội dung khác. Thay đổi bản JSON sau lần nhập cần rà soát
riêng vì nội dung khác sẽ được coi là câu mới.

Kiểm thử định dạng và dữ liệu có sẵn:

```sh
node --test tests/question-schema.test.cjs
npm run build
```

Kiểm thử hai migration trên PostgreSQL chạy trong bộ nhớ (PGlite, không kết nối
Supabase). Cài gói vào thư mục tạm để không thay đổi dependency của ứng dụng:

```sh
npm install --prefix /private/tmp/classhub-exercise-tests --no-audit --no-fund --save-exact @electric-sql/pglite@0.3.14
node tools/hsk1-import/test-migrations.mjs /private/tmp/classhub-exercise-tests/node_modules/@electric-sql/pglite/dist/index.js
```

Kiểm thử bao gồm toàn bộ 565 đáp án qua RPC nộp bài, chấm từng phần, biến thể câu
dịch, dấu thanh, quyền truy cập helper, chuyển dữ liệu có bài đã giao / mẫu đề,
chạy lại migration, rollback khi có chỉnh sửa và giới hạn bài kiểm tra có giờ.
