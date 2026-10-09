# Số hoá bài tập YCT

Bộ dữ liệu gồm 741 mục bài tập gốc theo 23 bài học: YCT1 bài 1–11 và YCT2 bài 1–12, kèm 585 ảnh WebP được crop từ bản PDF. Bài nối và đọc hiểu có nhiều câu con trong một mục. Không tìm thấy phiếu YCT3 hoặc bài ôn tập YCT1 trong thư mục nguồn; tính năng phiên âm vẫn hỗ trợ YCT1, YCT2 và YCT3.

## Nguồn và đối chiếu bài học

Nguồn: `~/Downloads/BÀI TẬP YCT`, gồm ba PDF scan, tổng 210 trang:

| File | Phạm vi thực tế |
| --- | --- |
| YCT1 từ bài 1 tới bài 7.pdf | YCT1 bài 1–7 |
| YCT 1 bài 8 tới YCT 2 bài 4.pdf | YCT1 bài 8–11; YCT2 bài 1–4 |
| YCT2 bài 5 tới bài 11.pdf | YCT2 bài 5–12, gồm phần ôn tập cuối sách |

Các PDF có đánh số bài lại từ đầu. Import dựa trên tiêu đề tiếng Việt, tiêu đề chữ Hán và chủ đề, đối chiếu với ID bài đang có trong `yct1-standard` / `yct2-standard`; không dùng số “Bài” in riêng trong PDF làm khoá. [lesson-mapping.json](lesson-mapping.json) lưu tiêu đề hệ thống, tiêu đề nguồn, ID bài, trang và SHA-256 nguồn. Riêng bài YCT1 số 8, tiêu đề chữ Hán trong phiếu là “我去商店” nhưng tiếng Việt là “Mẹ đi đến cửa hàng”; nội dung cửa hàng/nơi đến khớp bài “妈妈去商店” trên hệ thống.

| Level | Bài | Tiêu đề trên hệ thống | Mục bài tập |
| --- | ---: | --- | ---: |
| YCT1 | 1 | Xin chào! | 38 |
| YCT1 | 2 | Bạn tên gì? | 31 |
| YCT1 | 3 | Ông ấy là ai? | 26 |
| YCT1 | 4 | Nhà mình có bốn người. | 30 |
| YCT1 | 5 | Mình sáu tuổi. | 25 |
| YCT1 | 6 | Bạn cao thật đấy! | 26 |
| YCT1 | 7 | Đây là con chó của ai? | 33 |
| YCT1 | 8 | Mẹ đi đến cửa hàng. | 29 |
| YCT1 | 9 | Hôm nay là thứ mấy? | 52 |
| YCT1 | 10 | Bây giờ là mấy giờ? | 31 |
| YCT1 | 11 | Con ăn gì? | 33 |
| YCT2 | 1 | Mình có thể ngồi ở đây được không? | 27 |
| YCT2 | 2 | Buổi sáng cậu thức dậy lúc mấy giờ? | 33 |
| YCT2 | 3 | Bút chì của chị đâu? | 31 |
| YCT2 | 4 | Trong cặp có hai quyển sách. | 28 |
| YCT2 | 5 | Chị có biết nấu ăn không? | 36 |
| YCT2 | 6 | Một cái bánh bao có giá bao nhiêu? | 37 |
| YCT2 | 7 | Hôm nay nóng hơn hôm qua. | 38 |
| YCT2 | 8 | Martin lớn hơn con ba tuổi. | 36 |
| YCT2 | 9 | Hôm nay con đã làm gì? | 31 |
| YCT2 | 10 | Con bị sao thế? | 38 |
| YCT2 | 11 | Mình đã đến Bắc Kinh một năm rồi. | 36 |
| YCT2 | 12 | Ôn tập | 16 |

## Dạng bài và ảnh

Đề được nhập thành câu hỏi tương tác, không thay bằng ảnh chụp cả trang. Dạng bài gồm trắc nghiệm, chọn phiên âm, điền từ, sắp xếp từ, nối chữ–nghĩa, nối chữ–phiên âm–tranh, nghe chọn/nối tranh, đếm và viết số/chữ Hán, viết từ theo tranh, dịch câu, sửa câu, đọc hiểu, hội thoại, viết đoạn, luyện nói, luyện viết và tô màu.

Ảnh gắn trực tiếp với câu hỏi/lựa chọn/cột nối; nhãn ảnh chỉ dùng “Tranh” và số, không tiết lộ đáp án. Crop giữ trọn nét màu nhạt, đồng hồ, đầu/tay/chân; các hàng/cột không đều và hình chạm nhau có xử lý riêng. [assets.json](assets.json) ghi nguồn, toạ độ pixel, kích thước, dung lượng, SHA-256 và đường dẫn bất biến. Bucket `workbook-images` cho phép học viên đọc ảnh công khai. Phiếu nguồn và OCR nằm trong `work/`, không đưa vào Git.

Bài luyện viết/tô màu dùng canvas có bút, tẩy và tải ảnh. Bài nói có nghe mẫu và tải bản ghi âm hoặc nhập nội dung đã nói. Ảnh/bản ghi âm nộp tối đa 2 MB; giáo viên xem/nghe và chấm trong trang bài tập. Sắp xếp đoạn văn có nhiều thứ tự hợp lý dùng các câu để chọn thứ tự và giáo viên chấm theo tiêu chí riêng. Các bài mở không có điểm tự động. Đề nghe dùng TTS tiếng Trung của trình duyệt, vì nguồn không kèm file âm thanh.

YCT1–3 có nút **Ẩn phiên âm / Hiện phiên âm**, mặc định hiện chữ ruby phía trên chữ Hán. Chọn phiên âm, nối với phiên âm, viết phiên âm, viết từ bằng chữ Hán theo tranh/phiên âm và các câu có `pinyin_mode: hidden` không nhận gợi ý ruby. Câu chọn phiên âm YCT cũng không có nút nghe chữ Hán gợi đáp án. Giáo viên có thể chọn chế độ phiên âm và cách nộp bài trong trình sửa câu hỏi. Khi sửa câu nối, lựa chọn gây nhiễu và ảnh được giữ cùng lựa chọn tương ứng.

## Đáp án, độ phủ và mục chưa nhập

Nguồn không có phụ lục đáp án. Nội dung và đáp án đóng đã được đọc lại từ scan và đối chiếu chữ Hán, hình, ngữ pháp, từ vựng; không lấy đáp án từ OCR tự động. Bài mở có tiêu chí chấm riêng cho giáo viên. Đáp án trên hệ thống chỉ lưu trong `question_answers`, không nằm trong `questions.content`.

[inventory.json](inventory.json) liệt kê 316 phần trên 166 trang bài tập. [manifest.json](manifest.json) ghi trạng thái từng phần: đã số hoá, chờ xử lý, từ vựng tham khảo, tiêu đề chung hoặc phần tiếp nối. Câu mẫu có đáp án in sẵn được bỏ khỏi câu hỏi chấm điểm; từ vựng mở rộng giữ trong đối chiếu nguồn.

[pending.json](pending.json) giữ **24 nhóm, tương ứng 28 số câu gốc**, chưa đưa lên hệ thống: phiên âm in trùng, khối từ thiếu/dư, hình mục tiêu thiếu/trùng, không có lựa chọn đúng duy nhất, bài điền/đọc thiếu ngữ cảnh, hoặc cả ba cột bị sao chép lệch. Không tự chọn một đáp án đoán. [corrections.json](corrections.json) ghi 10 chỉnh sửa có căn cứ, gồm từ/phiên âm bị đổi hàng, nghĩa thiếu hoặc trùng và đại từ/tên nhân vật không nhất quán.

## Chạy lại và xác minh

Yêu cầu macOS với PDFKit/Vision cho OCR; Python 3.14 + Pillow cho crop/import; Node và dependency dự án cho kiểm tra schema. `.env.local` chứa Supabase URL và service role; script không in khoá. Cần có bản scan, OCR và `work/live-metadata.json` để tái tạo payload.

```sh
python3 tools/yct-import/probe_live.py
python3 tools/yct-import/inventory.py
python3 tools/yct-import/digitize.py
python3 tools/yct-import/audit_crops.py
node tools/yct-import/validate-payload.cjs
node --test tests/question-schema.test.cjs tests/yct-questions.test.cjs
python3 tools/yct-import/import_live.py --grade-only
python3 tools/yct-import/import_live.py
python3 tools/yct-import/import_live.py --apply
python3 tools/yct-import/import_live.py --verify
python3 tools/yct-import/import_live.py
```

`--grade-only` kiểm tra cả đáp án đúng và câu trả lời rỗng cho toàn bộ 741 mục bằng RPC chấm thực tế, ghi [grading-report.json](grading-report.json). Chạy không tham số chỉ lập kế hoạch. Trước mọi lần ghi, script sao lưu giáo trình, bài học, từ vựng, câu hỏi và đáp án cũ trong `work/before-*.json`.

Import giữ UUID ban đầu trong [question-ids.json](question-ids.json), gắn với ID bài và số câu nguồn để việc chỉnh crop không tạo câu hỏi mới. Script kiểm tra trùng số câu nguồn, upload ảnh bất biến và đọc lại byte/hash qua cả truy cập có quyền lẫn URL công khai. Câu hỏi mới tạm ẩn cho đến khi đủ đáp án riêng; chỉ kích hoạt sau khi đọc lại và khớp. `--verify` so từng nội dung, đáp án, level, tag và ảnh; kiểm tra metadata/từ vựng không đổi. [import-report.json](import-report.json) lưu lần nhập đầu, [verification-report.json](verification-report.json) lưu kiểm tra bộ dữ liệu cuối, [rerun-plan.json](rerun-plan.json) xác nhận lần chạy lại không tạo thêm câu hay đáp án.

Khi chỉnh crop, chạy kế hoạch với `--refresh-crops`, sau đó `--apply --refresh-crops`. Chế độ này chỉ cho phép thay URL ảnh trong bucket YCT; ID, nội dung chữ, lựa chọn, nguồn, đáp án và bài học phải khớp hoàn toàn. Script sao lưu trước khi ghi, xác minh tất cả ảnh trước khi thay URL và đọc lại toàn bộ dữ liệu sau cập nhật. [crop-refresh-report.json](crop-refresh-report.json) ghi lần cập nhật crop; ảnh cũ vẫn được giữ để bản sao lưu có thể sử dụng.

`node tools/yct-import/test-browser.cjs` thử component thật trên Chrome tại 390 px và 1280 px, dùng ảnh crop cục bộ, không ghi dữ liệu live. Script tạo và dọn route thử tạm; chạy `npm run build` sau thử nghiệm để tái tạo type route của Next.js. [browser-report.json](browser-report.json) ghi kết quả phiên âm, ảnh, nối, nghe, vẽ, âm thanh, xếp đoạn và tràn ngang.
