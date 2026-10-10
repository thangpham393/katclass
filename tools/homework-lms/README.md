# Sửa luồng bài tập và xem lại bài làm

## Các thay đổi

- Kho, xem trước, chọn giao bài, màn làm bài và xem lại gom tất cả câu cùng dạng thành một phần: trắc nghiệm, điền từ, nối, sắp xếp, dịch… Dạng là khóa gom chính, không phải PDF hoặc mã phần nguồn. Bên trong từng dạng mới sắp theo bài/PDF/phần/số câu nguồn. Mã phần dạng chuỗi như `1-016-2` được so sánh theo thứ tự tự nhiên, không dùng phép trừ. Câu cũ thiếu source giữ thứ tự ổn định trong dạng. Không sửa ID, câu hỏi, điểm hoặc lượt nộp; đề kiểm tra cũng gom dạng trên giao diện, vẫn giữ snapshot và giới hạn nộp/thời gian.
- Một tiêu đề đơn giản cho mỗi dạng và các câu nằm liền dưới tiêu đề đó. Bỏ khối mục lục phía trên và không dùng các mã nguồn làm tiêu đề giao diện. Nhãn số câu gốc vẫn được giữ ở từng câu.
- Hội thoại A/B, 甲/乙 và tên người nói tách thành từng lượt. Câu có tiêu đề “Hoàn thành hội thoại” nhưng thiếu nhãn người nói dùng từng dòng nguồn làm lượt nói, với nhãn hiển thị A/B luân phiên; giữ các câu liên tiếp trong cùng một lượt. Ô điền nằm trong lượt tương ứng; lời đáp cuối bị bỏ trống có ô viết trực tiếp trong bong bóng của người nói. Áp dụng cả câu chọn, điền từ, đọc hiểu, viết và preview.
- Nộp bài thường không yêu cầu hoàn thành hết, kể cả nộp rỗng. Câu/ô đã làm được chấm theo quy tắc từng dạng; câu bỏ trống không có điểm. Bài kiểm tra vẫn có đồng hồ và một lần nộp. Nút tiếp tục/sửa bài giữ các câu trả lời đã nộp.
- Phiên âm dạng ruby trên chữ Hán cho HSK 1–2/YCT. HSK 3 trở lên luôn không có phiên âm kèm chữ và không có nút bật/tắt, kể cả khi xem lại; phương án Pinyin của câu chọn phiên âm đúng vẫn giữ nguyên. Quy tắc theo `level`, có fallback từ tags cho snapshot cũ. Chuỗi cũ dạng `汉字 hànzì` hiển thị phiên âm trên chữ, không còn một dòng phía cạnh. Từ điển thêm 1.053 mục từ từ các giáo trình HSK trong repo; mục đa âm có mâu thuẫn bị bỏ khỏi từ điển mới, có thể dùng `content.pinyin` ghi đè theo ngữ cảnh. Các dạng đang kiểm tra Pinyin không tự hiện đáp án khi làm.
- Xem lại từng câu, từng ô điền, liên kết nối, câu đọc hiểu hoặc phần Hán/Pinyin; phân biệt đúng, sai, đúng một phần, bỏ trống và giáo viên chấm. Lọc câu cần xem lại. Đáp án chữ cái được đổi thành nội dung lựa chọn.
- `question_answers.explanation` lưu giải thích giáo viên riêng với đề bài; có ô soạn/sửa trong ngân hàng câu hỏi. Chỉ giải thích đã biên soạn mới được gọi là giải thích kiến thức. Các câu chưa có giải thích hiện nguyên nhân theo quy tắc chấm và đáp án đối chiếu; không tự bịa lý do ngữ pháp.

## Migration bắt buộc trước khi triển khai giao diện

Chạy [0052_homework_review_and_pinyin.sql](../../supabase/migrations/0052_homework_review_and_pinyin.sql) **sau 0051** trong Supabase SQL Editor. Có thể chạy lại. REST service key đang có trong `.env.local` không cho phép tự chạy SQL/schema; phiên này đã kiểm tra live và xác nhận RPC/cột review chưa có.

Migration thêm review snapshot vào bài nộp mới và RPC `get_homework_review(hw_id)`. RPC chỉ trả kết quả lượt nộp của chính học viên đăng nhập, không nhận ID học viên hoặc bộ đáp án giả. Giữ nguyên RLS của đáp án. Mẫu essay không được gửi về như đáp án tự chấm. Snapshot lưu nội dung, đáp án học viên, đáp án được chấp nhận và giải thích ở thời điểm nộp; sửa câu sau đó không thay đổi kết quả xem lại của lượt nộp mới. Lượt nộp cũ hiển thị theo quy tắc cũ và đáp án hiện có, kèm nhãn rõ ràng, không sửa điểm cũ.

Pinyin nhập có dấu/không dấu/thiếu một phần dấu/số thanh đều được chấp nhận, không phân biệt hoa thường, khoảng trắng và dấu câu. `ü`, `v`, `u:` tương đương; `u` vẫn khác `ü`. Không nới lỏng câu *chọn* Pinyin. Không đổi quy tắc dấu tiếng Việt của câu dịch. Câu dịch/sửa câu vẫn chấm theo mẫu được khai báo, chưa chấm theo ngữ nghĩa. Bài điền nhiều ô vẫn cần đúng mọi ô để nhận điểm câu hỏi, nhưng hiển thị kết quả từng ô.

## Rà soát live (chỉ đọc)

`python3 tools/homework-lms/audit-live.py` phân trang 250, chỉ in thống kê, không in tên học viên, bài nộp hoặc credential.

Đối chiếu ngày 09/10/2026:

| Bộ | Câu | Có nguồn/số câu |
|---|---:|---:|
| HSK 1 3.0 | 565 | 565 |
| HSK 2 3.0 | 773 | 773 |
| HSK 3 3.0 | 989 | 989 |
| HSK 3 tiêu chuẩn | 800 | 800 |
| HSK 1 tiêu chuẩn | 339 | 0 |
| HSK 2 tiêu chuẩn | 429 | 0 |
| HSK 4 tiêu chuẩn | 824 | 0 |

Không thay đổi các payload/import HSK đang được chỉnh sửa ngoài phạm vi này.

## Kiểm thử

```sh
node --test tests/question-schema.test.cjs tests/yct-questions.test.cjs tests/homework-lms.test.cjs
node tools/homework-lms/test-migrations.mjs /private/tmp/classhub-lms-tests/node_modules/@electric-sql/pglite/dist/index.js
node tools/homework-lms/test-browser.cjs
npm run build
```

PGlite 0.3.14 cài tạm ngoài repo (`npm install --prefix /private/tmp/classhub-lms-tests @electric-sql/pglite@0.3.14`). Test trình duyệt dùng Playwright đã có trong `/private/tmp/hsk-community-tools/node_modules`, Chrome headless và một route fixture tự xóa khi xong. Toàn bộ HTTP Supabase trong test được thay bằng fixture local, không ghi lên live. Grade/review fixture dùng SQL thật chạy bằng PGlite.

Đã qua 25 kiểm thử Node và build production; SQL chấm/xem lại toàn bộ 5.080 câu HSK trong payload, chạy migration hai lần, kiểm tra Pinyin sai/không dấu/Unicode, nộp thiếu/rỗng, quyền xem lại, snapshot bất biến, essay chờ chấm và giới hạn bài kiểm tra. Trình duyệt qua ở 390px và 1280px: câu cùng dạng nằm liền nhau dù khác PDF/mã phần, không có khối mục lục, hội thoại/ô nhập, ruby trên chữ, bật/tắt phiên âm, nộp chưa hết, xem lại/lọc/tải lại, tiếp tục bài đã nộp, không lỗi JS/tràn ngang. Ảnh kiểm tra trong `work/` (gitignore).

Bản sửa gom dạng ngày 09/10/2026 là thay đổi giao diện/thứ tự hiển thị, không cần migration SQL mới. Kiểm thử hồi quy dựng đúng trường hợp 31 câu với mã `1-014-2`, `1-016-2`…: chỉ có một nhóm cho mỗi dạng, không có 31 phần hoặc khối mục lục.

Bản sửa hội thoại không nhãn ngày 09/10/2026 kiểm tra trực tiếp bốn câu điền từ trong payload YCT. Hai câu trong ảnh được dựng trên màn làm bài thật: giữ 4/3 lượt nguồn và 3/2 ô điền, cập nhật đúng từng ô, phiên âm trên chữ Hán, không tràn ngang ở 390px/1280px. Không cần SQL mới.


## Ôn tập riêng và ngân hàng từ (10/10/2026)

[workbook-layout-audit.json](workbook-layout-audit.json) ghi kết quả đọc live, không ghi dữ liệu: 2.665 câu HSK 3+ và toàn bộ 1.097 câu điền từ ở các cấp. Cả 20 phần nhắc lại kiến thức của HSK 3 2.0 được tách trên giao diện khỏi câu 1, thành khối mở/thu gọn trước các dạng bài. Giữ dòng/cột nguồn khi trình bày, không biến phần ôn tập thành một câu được chấm. Bộ đề, bài đã giao và review snapshot đều dùng cách hiển thị này. Khi lọc kết quả, phần ôn tập vẫn được giữ riêng. Đoạn văn của bài đọc hiểu không bị tách.

Có 614 câu thuộc 84 ngân hàng từ/nhóm lựa chọn được nhận diện từ dữ liệu đề công khai: HSK 1 (130), HSK 2 (30), HSK 3 2.0/3.0 (376), YCT 1 (31), YCT 2 (47). Nhận cả danh sách chữ Hán phân cách `、`, dạng `Từ cho sẵn`, `Chọn từ phù hợp`, danh sách khung từ và các lựa chọn ngữ pháp đã ghi rõ như 又/再, 才/就. Không dựng ngân hàng từ từ đáp án riêng hay từ một gợi ý ngữ pháp không có lựa chọn.

Một khung từ nằm trên nhóm câu dùng chung trong cùng bài/PDF/phần, thay cho gợi ý lặp ở dưới mỗi câu. Học viên kéo thả trên máy tính hoặc chọn từ rồi chạm/tab đến ô trên điện thoại/bàn phím. Có thể thay/xóa từ. Quy tắc mỗi từ dùng một lần chỉ áp dụng khi nguồn nói rõ, theo cả nhóm câu; nhóm cho phép lặp giữ khả năng lặp. Từ đã dùng đổi trạng thái, xóa/thay trả từ về ngân hàng. Xem lại chỉ đọc; tiếp tục bài giữ các giá trị đã nộp và trạng thái từ dùng. ID câu, kiểu đáp án, chấm điểm và snapshot dữ liệu không đổi. Không cần SQL hoặc import lại dữ liệu cho thay đổi giao diện này.

Dữ liệu mới có thể khai báo `content.word_bank` cho `fill_blank`:

```json
{"words": ["学习", "工作"], "instruction": "Chọn từ thích hợp.", "reuse": false, "group": "phan-2"}
```

`group` tách các ngân hàng trong cùng nguồn; `reuse` mặc định cho phép lặp nếu không có quy định nguồn. Bản nhập cũ được đọc trực tiếp từ hint, không cập nhật lại question/answer để tránh tạo ID trùng hoặc làm đổi câu đã giao. Các câu nguồn mơ hồ đã chuyển sang giáo viên chấm vẫn giữ loại/chấm thủ công.

```sh
python3 tools/homework-lms/audit-workbook-intros.py
node tools/homework-lms/audit-layout.cjs
```

Script Python chỉ đọc Supabase, xuất câu công khai vào `work/` bị gitignore; script Node dùng đúng parser hiển thị để đối chiếu mọi câu đã đọc. Không đọc/lưu thông tin hay bài làm học viên. Các fixture tại `tests/fixtures/workbook-layout.json` lưu 20 phần ôn tập, Bài 10 và các mẫu ngân hàng nguồn, để kiểm thử không phụ thuộc payload/importer đang chỉnh sửa ở task khác. Kiểm thử Node đối chiếu thêm toàn bộ payload native nếu có trong checkout. Kiểm thử browser dùng màn học viên thật, SQL grading thật trong PGlite và HTTP mock, không ghi live.
