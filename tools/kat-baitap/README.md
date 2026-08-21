# Số hoá bộ bài tập KAT (PDF → JSON import)

Bộ script chuyển các phiếu ôn tập PDF trong `~/Peking/TÀI LIỆU GIẢNG DẠY KAT`
thành file JSON nạp vào **Thư viện bài tập** của CLASSHUB.

```bash
brew install poppler          # chỉ cần lần đầu (lấy pdftotext)
./pdf_to_txt.sh               # PDF -> tools/kat-baitap/txt/
python3 parse_kat.py          # txt/ -> parsed.json + báo cáo số câu mỗi phiếu
python3 gen_json.py           # parsed.json -> supabase/library/kat-hsk*-baitap.json
```

## Nhận dạng được những dạng nào

| Dạng trong phiếu | Loại câu hỏi trong app |
|---|---|
| Trắc nghiệm A/B/C/D | `multiple_choice` |
| Chọn phiên âm đúng | `pinyin_choice` |
| 选词填空 / điền từ vào chỗ trống | `fill_blank` |
| 句子匹配 / nối câu hỏi – câu trả lời | `matching` (cả phần gộp thành 1 câu) |
| 完成句子 / sắp xếp từ thành câu | `reorder` |
| 判断对错 / đúng – sai | `multiple_choice` 2 phương án |

Các phần **tự luận** (sửa lỗi sai, đặt câu, viết lại câu, trả lời ngắn bằng
tiếng Việt) bị bỏ qua vì hệ thống chấm tự động không xử lý được — đó là lý do
mỗi phiếu 40 câu chỉ ra khoảng 22–43 câu.

Đáp án lấy từ file `ĐÁP ÁN ... - KAT.pdf` đi kèm từng phiếu; câu nào không dò
được đáp án thì bỏ, `parse_kat.py` in thống kê lý do ở cuối.

## Nạp vào hệ thống

1. (Nếu muốn làm lại từ đầu) chạy `supabase/seed/reset_questions.sql`.
2. Vào **Kho học liệu trung tâm → Thư viện bài tập**, bấm *Nhập bài tập (JSON)*
   rồi chọn lần lượt 4 file `supabase/library/kat-hsk{1,2,3,4}-baitap.json`.
   Import lại cùng file vẫn an toàn: câu trùng nội dung tự bỏ qua.
