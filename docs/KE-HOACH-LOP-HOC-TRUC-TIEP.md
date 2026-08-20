# Kế hoạch: Chế độ LỚP HỌC TRỰC TIẾP (Live Classroom) — all-in-one cho giáo viên

> Mục tiêu: GV vào lớp chỉ cần đăng nhập → chọn lớp → bấm **Bắt đầu dạy** là có đủ mọi thứ để
> triển khai buổi học: trình chiếu, hoạt động tương tác, cho điểm, giao BTVN, chốt buổi.
> Mọi thao tác trong giờ tự động biến thành dữ liệu cho HV / phụ huynh / bảng công — GV không
> phải nhập lại lần thứ hai.

Ngày soạn: 20/08/2026.
Trạng thái: **P1 (lõi lớp học) + P4 rút gọn (nhật ký buổi cho HV/PH) ĐÃ CODE 20/08/2026**
(migration `0020_classroom.sql`). P2/P3/P5 chưa làm — xem lộ trình mục 7.

---

## 1. Nguyên tắc thiết kế

1. **Một màn hình duy nhất trong giờ dạy.** GV không rời khỏi `/teacher/classroom/[sessionId]`
   suốt buổi. Không mở tab khác, không đi qua lại giữa các trang.
2. **Không nhập liệu hai lần.** Điểm danh, sao thưởng, nội dung đã dạy, nhận xét, BTVN đều ghi
   ngay trong lúc dạy → cuối buổi chỉ xác nhận. Nội dung bài đã dạy tự đẩy sang
   `teaching_logs.lesson_content` (chấm công) thay vì gõ lại.
3. **Chiếu được lên TV/máy chiếu.** Font lớn, tương phản cao, chế độ toàn màn hình, phím tắt.
   Mọi hoạt động đều "trình chiếu được" (không có bảng dữ liệu li ti).
4. **GV-only tuyệt đối (user chốt 20/08/2026).** Trong giờ học viên KHÔNG dùng thiết bị — chỉ
   máy GV nối máy chiếu/TV. HV chỉ đăng nhập ở nhà để theo dõi và làm bài tập. Vì vậy **không
   làm realtime, không có mã vào lớp, không buzzer trên điện thoại HV** ở bất kỳ giai đoạn nào.
   Mọi tương tác trong lớp do GV thao tác trên 1 máy.
5. **Chịu được mất mạng.** State buổi (điểm sao, điểm danh, timer) giữ ở localStorage theo
   `sessionId`, đồng bộ lên Supabase khi có mạng; mất wifi giữa giờ không mất dữ liệu.
6. **Tận dụng hạ tầng đã có**: `sessions`, `attendance`, `session_comments`, `session_lessons`,
   `lessons.slide_embed_url`, `vocab_items`/`lesson_vocab`, `questions`/`question_answers`,
   `homeworks`, `teaching_logs`, `notifications`.

---

## 2. Kiến trúc màn hình

Route mới: `/teacher/classroom/[sessionId]` — **layout riêng, không sidebar/topbar** (giống
trang in biên lai). Vào từ 3 chỗ: trang chủ GV (ca hôm nay), `/teacher/classes/[id]`,
`/teacher/sessions/[id]`.

```
┌──────────────────────────────────────────────────────────┬─────────────┐
│ HSK2-T3 · Buổi 12 · 18:00–19:30   ⏱ 12:34   [Kết thúc]  │  DANH SÁCH  │
├──────────────────────────────────────────────────────────┤  HỌC VIÊN   │
│                                                          │ (rail ẩn/hiện)
│                    SÂN KHẤU (STAGE)                      │ ● An   ★5  │
│         slide / game / bảng trắng / stroke order         │ ● Bình ★3  │
│                                                          │ ○ Chi  vắng│
│                                                          │ ...        │
├──────────────────────────────────────────────────────────┴─────────────┤
│ [Slide] [Gọi tên] [Điểm] [Bấm giờ] [Bảng viết] [Nét chữ] [Game] [BTVN] │
└────────────────────────────────────────────────────────────────────────┘
```

- **Stage**: khu vực chiếu, đổi nội dung theo công cụ đang chọn.
- **Roster rail** (phải, thu gọn được): avatar + trạng thái điểm danh + số sao trong buổi.
  Tap avatar = +1 sao; giữ = menu (lý do / trừ điểm / ghi nhận xét nhanh).
- **Dock** (dưới): các công cụ, có phím tắt (`S` slide, `R` random, `T` timer, `W` whiteboard…).
- **Chế độ 2 màn hình** (giai đoạn sau): mở cửa sổ "Presenter" chỉ hiện Stage để kéo sang TV,
  máy GV giữ dock + roster.

### Luồng vào lớp
1. GV bấm **Bắt đầu dạy** → wizard 15 giây: điểm danh nhanh (lưới avatar, tap để đổi trạng
   thái, nút "Có mặt tất cả") → lưu `attendance` ngay.
2. Hệ thống tự mở slide của bài đã gán cho buổi (`session_lessons` → `lessons.slide_embed_url`).
   Chưa gán bài → gợi ý chọn bài theo giáo trình của lớp (`classes.textbook_id`).
3. Từ đó GV chỉ dùng dock.

---

## 3. Bộ công cụ trong lớp

### 3.1 Trình chiếu học liệu
- Chiếu `slide_embed_url` (Canva / Google Slides) trong iframe toàn màn hình.
- **Kho học liệu buổi**: panel bên trái liệt kê mọi thứ gắn với bài — slide, PDF, ảnh, audio
  của từ vựng, video YouTube — bấm là chiếu. Cho phép GV dán nhanh 1 link ad-hoc trong giờ.
- Nút "Từ vựng bài này" → chiếu lưới thẻ từ (hanzi lớn + pinyin + nghĩa + loa TTS), lật/ẩn
  nghĩa để kiểm tra miệng.

### 3.2 Random gọi tên
- Vòng quay / máy xáo bài với hiệu ứng + âm thanh, chỉ quay trong HV **có mặt**.
- 3 chế độ: ngẫu nhiên thuần · **công bằng** (ưu tiên người ít được gọi nhất trong tháng, lấy
  từ `class_points`/`session_activities`) · loại dần (đã gọi thì bỏ ra khỏi vòng).
- Sau khi trúng: 3 nút to — **Trả lời tốt (+2)** / **Đúng (+1)** / **Cần cố gắng (0)** →
  ghi thẳng vào điểm buổi. Có nút "Gọi thêm 1 bạn" để hỏi tiếp.
- Biến thể: quay chọn **nhóm**, quay chọn số (câu hỏi số mấy), gieo xúc xắc.

### 3.3 Điểm thưởng trong giờ (★)
- Tap avatar +1. Lý do preset: *Phát biểu · Trả lời đúng · Làm bài tốt · Giúp bạn ·
  Nói tiếng Trung · Chuẩn bị bài · Trừ điểm (mất trật tự)*.
- Hiệu ứng ★ bay lên + âm thanh nhỏ (bật/tắt được).
- **Bảng xếp hạng** chiếu được: theo buổi / theo tuần / theo tháng, top 3 có huy chương.
- **Chia đội**: random chia 2–4 đội, điểm đội hiển thị to; điểm cá nhân vẫn cộng song song.
- Dữ liệu vào bảng mới `class_points` → HV và PH xem được, cộng dồn thành "sao tích lũy".

### 3.4 Bấm giờ
- Countdown preset 30s / 1′ / 3′ / 5′ / 10′ + chỉnh tay; đồng hồ số cực lớn, đổi màu khi còn
  10s, chuông báo hết giờ. Có stopwatch cho hoạt động thi đua.
- Timer chạy nền: đổi sang công cụ khác vẫn thấy đồng hồ nhỏ ở header.

### 3.5 Bảng viết tương tác (whiteboard)
- Canvas: bút (3 độ dày), 6 màu, tẩy, undo, xóa hết, nền trắng / **ô 田字格** / ô kẻ ly /
  nền là ảnh slide hiện tại (viết chú thích lên slide).
- Chèn nhanh ô 田字格 cỡ lớn để viết mẫu chữ Hán.
- **Lưu ảnh bảng** vào buổi → hiện trong nhật ký buổi cho HV/PH xem lại (Supabase Storage).

### 3.6 Nét chữ Hán (stroke order)
- Dùng `hanzi-writer` (đã có trong package.json, chưa dùng).
- Gõ / chọn chữ từ từ vựng bài → xem animation từng nét, tốc độ chỉnh được, hiện số thứ tự nét.
- **Chế độ đố**: HV lên viết trực tiếp trên màn hình cảm ứng, hanzi-writer chấm đúng/sai từng nét.
- Nút loa TTS zh-CN + hiện pinyin, nghĩa, ví dụ (lấy từ `vocab_items`).

### 3.7 Game từ vựng (nguồn từ = `lesson_vocab` của bài đang dạy, hoặc chọn tay)
| Game | Cách chơi | Ghi chú |
|---|---|---|
| **Lật thẻ trí nhớ** | ghép hanzi ↔ nghĩa / hanzi ↔ pinyin | 8–16 thẻ, tính giờ |
| **Ai nhanh hơn** | chiếu nghĩa, các đội chọn hanzi đúng | GV bấm đội thắng → +điểm đội |
| **Vòng quay từ vựng** | quay trúng từ nào → HV đọc/đặt câu | kết hợp gọi tên |
| **Đập chuột / bắt từ** | từ chạy trên màn hình, bấm đúng từ theo nghĩa | luyện nhận mặt chữ |
| **Bingo** | lưới 4×4 từ ngẫu nhiên, GV đọc, HV đánh dấu | in được cho HV |
| **Nghe đoán chữ** | TTS đọc, chọn 1 trong 4 hanzi | dùng lại giọng zh-CN sẵn có |
| **Đoán chữ theo nét** | hanzi-writer vẽ dần, ai đoán trước được điểm | rất "ăn tiền" với lớp trẻ em |
| **Quiz nhanh** | lấy câu từ **ngân hàng câu hỏi** (`questions`) theo bài | chiếu câu to, GV bấm Đúng/Sai → cộng điểm ngay |

Mọi game đều có nút "Cộng điểm cho…" nối thẳng vào roster → không rời màn hình.

### 3.8 Tiện ích nhỏ khác
- **Tra từ nhanh**: ô search kho `vocab_items` (hanzi/pinyin/nghĩa) + phát âm — GV cần giải
  thích từ ngoài bài là có ngay.
- **Máy đọc TTS**: gõ câu tiếng Trung bất kỳ → phát, tốc độ chậm/nhanh (luyện nghe).
- **Ghi chú buổi**: ô ghi nhanh nội dung đã dạy trong lúc dạy → cuối buổi tự điền vào chấm công.
- **Đèn giao thông / mức ồn**, hẹn giờ nghỉ giải lao, chọn số ngẫu nhiên.
- **Nút SOS**: gọi hành chính (tạo notification cho staff) khi thiếu thiết bị / sự cố lớp.

---

## 4. Kết thúc buổi — wizard 4 bước (mấu chốt "all in one")

Bấm **Kết thúc buổi** → 4 bước, mỗi bước đã điền sẵn từ dữ liệu trong giờ:

1. **Điểm danh**: xác nhận lại (đã tick từ đầu giờ), sửa được.
2. **Đánh giá HV**: mỗi HV hiện sẵn số sao + số lần phát biểu trong buổi; nhận xét gợi ý tự
   sinh ("Hôm nay phát biểu 3 lần, đạt 5 sao, cần luyện thêm thanh điệu") + preset câu nhận
   xét + rating 1–5 → ghi `session_comments` (đang dùng cho PH xem).
3. **Giao BTVN**: chọn bộ câu hỏi theo bài (đã có nút "Chọn cả bộ" ở `/teacher/homework/new`),
   hạn nộp mặc định = trước buổi kế tiếp 2 tiếng → 1 click là xong; hoặc BTVN dạng mô tả
   (làm trong sách trang X) cho PH nhắc con.
4. **Chốt buổi & chấm công**: nội dung đã dạy (điền sẵn từ ghi chú + tên bài), giờ thực tế
   (mặc định giờ vào lớp → giờ bấm kết thúc) → ghi `teaching_logs` (trigger tự chuyển
   session `completed`, tự tính công + lương theo migration 0018/0019).

Xong → bắn thông báo **"Báo cáo buổi học hôm nay"** cho HV + PH (bảng `notifications` sẵn có).

---

## 5. Phía học viên & phụ huynh

### 5.1 Nhật ký buổi học (`/student/sessions/[id]`, `/parent`)
- Hôm nay con học **bài gì** (bài + từ vựng mới + ngữ pháp), **được mấy sao**, **phát biểu mấy
  lần**, **nhận xét của GV**, **ảnh bảng viết** trong giờ.
- **BTVN**: đề bài, hạn nộp, trạng thái (chưa làm / đã nộp / điểm), nút "Nhắc con làm bài"
  (tạo notification cho HV).
- Thẻ tóm tắt trên trang chủ PH: "Buổi 20/08: 5★, phát biểu 3 lần, BTVN hạn 22/08".

### 5.2 Động lực học tập
- **Sao tích lũy** theo tuần/tháng/khóa, huy hiệu (chuyên cần, phát biểu nhiều nhất, tiến bộ
  nhất) — chiếu bảng vàng đầu buổi sau.
- **Kho thưởng** (tùy chọn, giai đoạn sau): admin cấu hình phần thưởng (bút, sổ, voucher học
  phí…) theo số sao; HV/PH thấy tiến độ; GV/hành chính duyệt đổi thưởng.

---

## 6. Schema mới (migration `0020_classroom.sql`)

```sql
-- Điểm thưởng trong giờ
create table public.class_points (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  points smallint not null,                 -- có thể âm
  reason text not null default 'speak',     -- speak|correct|homework|help|chinese|prepare|behavior|bonus
  team text,                                -- nếu chơi theo đội
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.class_points (session_id);
create index on public.class_points (student_id, created_at desc);

-- Nhật ký hoạt động đã chạy trong buổi (để làm báo cáo + gợi ý lần sau)
create table public.session_activities (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  kind text not null,        -- slide|vocab|game|whiteboard|quiz|timer|stroke|random
  ref_id uuid,               -- lesson_id / homework_id / vocab_id…
  payload jsonb not null default '{}'::jsonb,  -- {game:'memory', duration:180, board_url:'...'}
  created_at timestamptz not null default now()
);

-- Giáo án buổi (chuẩn bị trước, chạy tuần tự trong lớp) — giai đoạn 4
create table public.lesson_plans (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,  -- [{kind,title,minutes,ref_id}]
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- View tổng sao cho HV/PH
create view public.student_points_summary ...  -- security_invoker, tổng theo student + tháng
```

- **Storage**: bucket `boards` cho ảnh bảng viết (đường dẫn `session_id/uuid.png`).
- **RLS**: GV dạy buổi (`teaches_session`) ghi/sửa; HV đọc điểm của mình; PH đọc theo con
  (dùng `parent_students` như các bảng khác); staff toàn quyền.
- **Trigger**: khi có `teaching_logs` mới (chốt buổi) → notification "Báo cáo buổi học" cho
  HV active của lớp + PH.
- `homeworks` thêm cột `description`-style BTVN không câu hỏi? → dùng `kind='offline'` +
  `instructions text` (BTVN làm trong sách, không tự chấm).

---

## 7. Lộ trình triển khai (chia nhỏ để chạy được sớm)

| Phần | Nội dung | Kết quả dùng được ngay |
|---|---|---|
| **P1 — Lõi lớp học** ✅ | Route + layout fullscreen, điểm danh nhanh, roster ★, random gọi tên, bấm giờ, chiếu slide, lưới từ vựng + TTS, wizard kết thúc buổi (nối attendance / session_comments / teaching_logs / homework). Migration 0020 (`class_points`, `session_activities`). | GV dạy trọn buổi trong 1 màn hình |
| **P2 — Công cụ tiếng Trung** | Bảng viết 田字格 + lưu ảnh bảng, stroke order (hanzi-writer), tra từ + TTS nhanh, chiếu lưới từ vựng | Dạy viết chữ không cần app ngoài |
| **P3 — Game & thi đua** | Chia đội, bảng xếp hạng chiếu, 4 game đầu (lật thẻ, ai nhanh hơn, nghe đoán chữ, quiz nhanh từ ngân hàng câu hỏi) | Lớp sôi động, HV tương tác |
| **P4 — HV & phụ huynh** 🟡 | ✅ Nhật ký buổi học (`/student/sessions/[id]` + thẻ buổi gần nhất ở trang chủ HV và cổng PH) + thông báo "Báo cáo buổi học" khi chốt buổi. ⏳ Còn: sao tích lũy + huy hiệu, nút nhắc làm BTVN, thống kê tham gia theo tháng cho GV | PH theo dõi được "hôm nay con học thế nào" |
| **P5 — Tùy chọn** | Giáo án chuẩn bị trước (`lesson_plans`), presenter 2 màn hình, kho thưởng đổi sao | Nâng cấp chất lượng, vẫn GV-only |

Ưu tiên: **P1 → P4 → P2 → P3 → P5** (P4 đẩy lên sớm vì giá trị với phụ huynh lớn nhất và
không phụ thuộc các công cụ nặng).

**Đã bỏ khỏi phạm vi** (user chốt 20/08/2026): HV vào lớp bằng mã trên điện thoại, buzzer,
trả lời quiz realtime — HV không dùng thiết bị trong giờ.

---

## 8. Rủi ro & lưu ý kỹ thuật

- **iframe slide**: Canva/Google Slides cần link "nhúng"; một số link chặn iframe → cần hướng
  dẫn GV lấy đúng link + nút "mở tab mới" dự phòng.
- **Wake lock**: giữ màn hình không tắt trong giờ dạy (`navigator.wakeLock`).
- **Âm thanh/TTS**: cần user gesture đầu tiên để mở audio context; giọng zh-CN phụ thuộc máy
  → chuẩn bị fallback dùng `vocab_items.audio_url`.
- **Canvas trên máy chiếu cảm ứng**: hỗ trợ pointer events (bút + chạm), tránh chỉ mouse.
- **Hiệu năng**: game và roster giữ state cục bộ, chỉ ghi DB theo lô (debounce 2–3s) để tránh
  spam request giữa giờ.
- **Quyền**: buổi bù riêng (`class_id NULL`) — roster lấy từ `attendance`/makeup thay vì
  `class_students`.


---

## 9. Đã code (20/08/2026) — bản đồ file

| File | Vai trò |
|---|---|
| `supabase/migrations/0020_classroom.sql` | `class_points`, `session_activities`, view `student_points_summary`, type thông báo `session_report` + trigger `notify_session_report` (bắn khi insert `teaching_logs`) |
| `src/lib/db-classroom.ts` | Data layer: điểm ★ (kèm hàng chờ localStorage khi mất mạng), nhật ký hoạt động, `fetchSessionReport`, `fetchLatestReportedSession`, `speakZh` |
| `src/app/classroom/layout.tsx` | Layout toàn khung (AuthGuard `bare` — không sidebar/topbar) |
| `src/app/classroom/[sessionId]/page.tsx` | Màn điểm danh đầu giờ → màn dạy (header + stage + dock + roster), wake lock, phím tắt 1–4, toàn màn hình |
| `src/components/classroom/roster-rail.tsx` | Cột học viên: chọn lý do rồi chạm để cộng ★, hoàn tác, cảnh báo điểm chờ đồng bộ |
| `src/components/classroom/stages.tsx` | 4 công cụ: `SlideStage`, `VocabStage`, `RandomStage`, `TimerStage` |
| `src/components/classroom/wrap-up-modal.tsx` | Wizard 4 bước kết thúc buổi (mỗi bước lưu ngay) |
| `src/components/session-report.tsx` | `SessionReportView` + `LatestSessionReport` cho HV/PH |
| `src/app/student/sessions/[id]/page.tsx` | Trang nhật ký buổi của học viên (đích của thông báo) |

Lối vào chế độ lớp học: trang chủ GV (ca hôm nay/hôm qua), `/teacher/classes/[id]` (banner buổi
hôm nay), `/teacher/sessions/[id]` (nút "Vào lớp dạy").
