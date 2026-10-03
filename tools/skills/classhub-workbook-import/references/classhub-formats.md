# Định dạng bài tập và các điểm tích hợp CLASSHUB

Các đường dẫn dưới đây tính từ root repo CLASSHUB. Đọc file hiện tại trước khi
dùng; đây là quy ước sau bổ sung HSK 1, không phải cam kết schema live đã cập nhật.

## Các file cần tra

- `src/lib/question-schema.ts`: `QuestionType`, `QuestionContent`,
  `QuestionAnswer`, `validateQuestionDefinition`, `questionIsAnswered`,
  `questionAnswerPreview`; validator không phụ thuộc React/Supabase.
- `src/lib/db-content.ts`: CRUD, preview, tải câu và đáp án theo lô/trang.
- `src/lib/db-library.ts`: `TextbookImportPayload` và importer giáo trình.
  Importer này có cập nhật metadata và vocab nếu khai báo; không mặc định dùng
  cho tác vụ chỉ thêm bài tập mà chưa kiểm tra payload.
- `src/components/library/question-modal.tsx`: giao diện soạn/sửa.
- `src/app/library/exercises/page.tsx`, `src/app/library/questions/page.tsx`,
  `src/app/library/tests/page.tsx`: xem kho và chọn câu.
- `src/app/teacher/homework/new/page.tsx`: giao bài theo câu/lesson.
- `src/app/student/homework/[id]/page.tsx`: các ô trả lời của học viên.
- `supabase/migrations/0048_test_library.sql`: thư viện đề, snapshot khi giao đề.
- `supabase/migrations/0049_written_exercise_types.sql`: constraint loại câu và
  chấm điểm trong `submit_homework`. Trước thêm migration, tìm định nghĩa mới
  nhất của RPC; giữ điều kiện thành viên lớp, bắt đầu thi, thời hạn và một lần nộp.

## JSON cho level mới

```json
{
  "textbook": { "code": "code-da-xac-minh", "name": "Ten hien co" },
  "lessons": [{
    "unit": 1,
    "title": "Ten bai hien co",
    "questions": [{
      "type": "translation",
      "content": {
        "prompt": "Câu tiếng Việt cần dịch",
        "source": { "file": "ten-nguon.pdf", "sha256": "hash-nguon", "unit": 1, "section": 5, "numbers": [41] }
      },
      "answer": ["中文答案。"]
    }]
  }]
}
```

Đây là ví dụ cấu trúc, không import trực tiếp. `answer` đi vào
`question_answers(question_id, answer)`, không lưu trong `questions.content`.
`questions.lesson_id` trỏ đúng bài của giáo trình; `is_test_snapshot=false` là
câu chọn từ kho. Không thay RLS để học viên đọc bảng đáp án.

| type | content cần dùng | Đáp án mẫu riêng | Học viên gửi |
| --- | --- | --- | --- |
| `multiple_choice` | `prompt`, `options` (2–6) | `"A"` … `"F"` | chữ cái hoa |
| `pinyin_choice` | `hanzi`, `options` (2–6) | chữ cái hoa | chữ cái hoa |
| `listening` | `tts` hoặc `audio_url`, `options` | chữ cái hoa | chữ cái hoa |
| `fill_blank` | `prompt` có mỗi `___` là một ô | `string[]` theo thứ tự ô | `string[]` |
| `translation` | `prompt`, `hint?` | `string[]` bản dịch được chấp nhận | một `string` |
| `hanzi_pinyin` | `prompt`, `hint?` | `{ "hanzi": "你好", "pinyin": "Nǐ hǎo" }` | cùng hai khóa |
| `matching` | `left`, `right` | `{ "0": "b", "1": "a" }` | map chỉ số trái → chữ cái thường |
| `multi_matching` | `left`, `columns` (Pinyin, nghĩa) | `{ "0:0": "a", "0:1": "b", … }` | map `row:column` → chữ cái thường |
| `reorder` | `tokens` đã xáo, `translation?` | `string[]` đúng thứ tự | `string[]` đã xếp |
| `reorder` có Pinyin | thêm `require_pinyin: true` | `{ "hanzi": "你好！", "pinyin": "Nǐ hǎo!", "order": "[\"你\",\"好\",\"！\"]" }` | cùng ba khóa; `order` là chuỗi JSON |
| `reading` | `passage`, `items` câu con | `{ "0": "A", "1": "câu trả lời", … }` | map chỉ số câu con → string |

Chỉ số bắt đầu từ 0. Bài nối dùng A–Z trên giao diện, a–z trong đáp án, tối đa 26
mục/cột; `multi_matching.columns` có đúng hai cột `{label, options}`. Trắc nghiệm
vẫn A–F. Khối sắp xếp phải khớp cả số lần xuất hiện, kể cả token lặp và dấu câu;
không để nguyên thứ tự đáp án. Reading item gồm `{prompt, type, options?}` với
type `multiple_choice` hoặc `short_answer`. Không tách mỗi câu con làm mất ngữ cảnh.

Chấm theo 0049: câu dịch chấp nhận một trong các mẫu; chữ Hán/Pinyin chuẩn hóa
NFKC, chữ hoa, khoảng trắng và dấu câu, giữ thanh điệu. Cặp Hán-Pinyin và sắp xếp
kèm Pinyin có hai phần điểm; nối/đọc hiểu tính từng liên kết/câu con. Điền từ,
sắp xếp thường và trắc nghiệm giữ JSON equality. Câu dịch chưa có chấm ngữ nghĩa;
reading short_answer vẫn cần đúng chuỗi mẫu.

## Tài nguyên HSK 1 để tham khảo

- `tools/hsk1-import/digitize.py`: parser layout/raw/cột, dựng JSON và manifest.
  Có giả định riêng về source, số bài, loại bài; phải điều chỉnh sau kiểm kê level mới.
- `tools/hsk1-import/import_live.py`: REST plan/apply/verify, UUID xác định,
  ghép đáp án tường minh, bảo vệ metadata và chặn nhập bản cũ. Cố định code
  `hsk1-new30` và bỏ Bài 7; không dùng nguyên trạng cho level khác.
- `tools/hsk1-import/corrections.json`, `manifest.json`, `README.md`: hiệu chỉnh
  nguồn và kiểm chứng. Work text/ảnh/backup nằm trong `work/` và bị gitignore.
- `tools/hsk1-import/prepare_native_upgrade.py`, `native-upgrade-template.sql`,
  `supabase/migrations/0050_hsk1_native_exercises.sql`: chuyển dữ liệu có snapshot,
  kiểm tra trạng thái cũ/mới trước ghi. 0050 chỉ dành cho các ID HSK 1 đã nhập.
- `tests/question-schema.test.cjs`: kiểm tra validator/độ phủ, không kết nối live.
- `tools/hsk1-import/test-migrations.mjs`: kiểm thử PostgreSQL trong bộ nhớ bằng
  PGlite. Cách cài tạm và chạy có trong README của bộ HSK 1.

Các con số **chỉ để đối chiếu HSK 1**: 14 phiếu (1–6, 8–15), 785 số câu nguồn,
584 bản ghi ở lần nhập đầu; bản native chuẩn bị có 565 mục và 805 phần điểm.
Bài 7 trùng byte với Bài 9, đã được người dùng chọn bỏ. Chủ đề PDF Bài 11–15 khác
tên giáo trình; lần đó giữ tên bài và gắn theo số. Không áp dụng các ngoại lệ này
cho level khác. Báo cáo verify 584 mục không chứng minh 0049/0050 đã được áp dụng;
kiểm tra trạng thái live trước khi nhập hoặc báo hoàn tất.
