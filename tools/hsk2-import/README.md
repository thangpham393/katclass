# Bài tập HSK 2 3.0

Đã nhập và đối chiếu trên Supabase ngày 05/10/2026: **773 câu hỏi và 773 đáp án**,
gắn vào đủ 15 bài của `hsk2-new30` (level `HSK2`). 15 phiếu chứa 790 mục nguồn;
17 mục chưa đủ căn cứ chấm được lưu ở [pending.json](pending.json).

Đã dùng skill `classhub-workbook-import`. Người dùng xác nhận chạy migration
`0051_hsk2_written_and_manual_exercises.sql`; importer kiểm tra RPC thực tế trước
khi nhập hai dạng mới. Tên bài, từ vựng, ngữ pháp và metadata giáo trình/bài học
được đối chiếu nguyên vẹn sau nhập.

## Nguồn và ánh xạ

Nguồn: thư mục `Downloads/PHIẾU BÀI TẬP THEO TỪNG BÀI HSK 3.0/HSK2 3.0`,
15 PDF `PHIẾU BÀI TẬP BÀI {n} HSK2 3.0.pdf`. Header bên trong một số phiếu ghi
HSK 2.0; tên file ghi 3.0. Giữ thông tin nguồn gốc, không đổi tên bài hệ thống.

PDF Bài 2 và 3 đều có bài tập thuê nhà, gần như lặp nhau, trong khi tiêu đề
giáo trình là taxi/du lịch. Theo quyết định của người dùng, gắn theo số bài và
dùng tiêu đề hiện có trên CLASSHUB. Không gộp hai bài vì chúng có nguồn và lesson
khác nhau. Mỗi PDF có SHA-256 riêng, lưu cùng lesson ID/title trong
[manifest.json](manifest.json).

| Bài | Mục nguồn | Đã nhập | Chờ rà soát |
| --- | ---: | ---: | ---: |
| 1 | 50 | 47 | 3 |
| 2 | 50 | 50 | 0 |
| 3 | 50 | 50 | 0 |
| 4 | 60 | 60 | 0 |
| 5 | 52 | 51 | 1 |
| 6 | 60 | 60 | 0 |
| 7 | 52 | 50 | 2 |
| 8 | 52 | 51 | 1 |
| 9 | 52 | 50 | 2 |
| 10 | 52 | 52 | 0 |
| 11 | 52 | 52 | 0 |
| 12 | 52 | 52 | 0 |
| 13 | 52 | 49 | 3 |
| 14 | 52 | 50 | 2 |
| 15 | 52 | 49 | 3 |
| **Tổng** | **790** | **773** | **17** |

## Dạng bài và chấm điểm

| Dạng | Số câu |
| --- | ---: |
| Dịch câu/đoạn văn hai chiều | 250 |
| Trắc nghiệm | 197 |
| Sắp xếp câu | 150 |
| Sửa lỗi câu | 106 |
| Điền từ | 50 |
| Sửa câu với chữ Hán và Pinyin | 10 |
| Viết đoạn văn, giáo viên chấm | 10 |

`translation` có `target_language` cho tiếng Trung/tiếng Việt. Dịch và sửa câu
chấm theo các mẫu khai báo, bỏ qua khoảng trắng, hoa/thường và dấu câu; dấu thanh
vẫn có ý nghĩa. Không chấm ngữ nghĩa hay hứa nhận mọi cách diễn đạt đúng.

`essay` dùng textarea và bài mẫu ở `question_answers`, chỉ giáo viên có quyền đọc.
Bài mẫu không dùng để chấm tự động. Bài nộp có essay giữ `score = null` và trạng
thái `submitted` cho đến khi giáo viên đọc phần viết rồi nhập **điểm toàn bài /10**.
`auto_score` chỉ phản ánh các câu tự động, làm điểm tham khảo cho giáo viên; bài
chỉ có essay không có điểm tự động. Khi học viên nộp lại bài tập thường, bài cần
giáo viên chấm lại. Bài kiểm tra vẫn giới hạn một lần nộp, phải bắt đầu và nộp
trong giới hạn thời gian hiện có.

## Sửa lỗi và các mục chờ

[corrections.json](corrections.json) lưu lỗi đề/đáp án nguồn cùng căn cứ sửa:
khóa đáp án lệch cột Bài 4, khôi phục chủ ngữ/câu đầy đủ, thêm token còn thiếu,
đáp án Pinyin bị cắt, dịch đoạn văn và xử lý đại từ. Bài 2–3 được đối chiếu thủ
công ở [housing-reviewed.json](housing-reviewed.json).

17 mục chờ gồm trắc nghiệm thiếu ngữ cảnh/khóa số tiền sai và các câu sửa lỗi
có thể đúng trong ngữ cảnh khác (了, 吧, câu hỏi phủ định, lược lượng từ…). Mỗi mục
lưu đề gốc, đáp án nguồn, định danh và lý do riêng; chưa có câu/đáp án tương ứng
trong kho live. Độ phủ kiểm tra bằng `(unit, section, number)`, bao gồm cả 17 mục
chờ, không chỉ đếm bản ghi.

## Công cụ và bằng chứng

Payload: [hsk2-new30-baitap.json](../../supabase/library/hsk2-new30-baitap.json).
SHA-256: `7bf87e14bf445c604632799085d0912747fcb1191922f0705b43b46a8e164bee`.

- [import-report.json](import-report.json): đọc lại toàn bộ 773 câu/đáp án sau ghi,
  đối chiếu nội dung, lesson, level, tag và metadata.
- [rerun-plan.json](rerun-plan.json): kế hoạch đọc lại độc lập sau nhập;
  `new_records = 0`, `missing_answers = 0`, không còn câu chờ migration 0051.
- Backup trước ghi nằm trong `work/before-*.json`, được gitignore. Không đưa
  credential, dữ liệu backup live hay PDF gốc vào Git.
- `validate-payload.cjs`: schema, lựa chọn/đáp án, hash, token, không lẫn header,
  790 định danh nguồn không thiếu/trùng và bài mẫu viết tự do.
- `test-migrations.mjs`: PostgreSQL bằng PGlite, migration chạy hai lần, chấm tất
  cả 773 mẫu, câu sai/từng phần, essay chờ chấm, quyền giáo viên, nộp lại và
  kiểm tra bắt đầu/thời gian/một lần nộp.
- `node --test tests/question-schema.test.cjs` và `npm run build` đã qua.

Chạy tại thư mục repo:

```sh
python3 tools/hsk2-import/probe_live.py
python3 tools/hsk2-import/digitize.py
node tools/hsk2-import/validate-payload.cjs
python3 tools/hsk2-import/import_live.py          # kế hoạch, không ghi database
python3 tools/hsk2-import/import_live.py --verify # đọc lại toàn bộ
python3 tools/hsk2-import/import_live.py --apply  # nhập phần thiếu sau preflight
```

`digitize.py` cần Poppler, PDF gốc và `work/live-metadata.json` từ probe. Importer
đọc cấu hình Supabase được phép trong `.env.local`, chia lô 50, phân trang 250,
ghép đáp án bằng UUID xác định; dữ liệu khác nội dung/đáp án sẽ dừng để rà soát.
Không dùng `--supported-only` sau khi đã nhập đầy đủ; tùy chọn này chỉ dành cho
bước nhập các dạng cũ trong lúc chờ áp dụng 0051.
