# Hướng dẫn setup Supabase cho KAT CLASS

Làm theo thứ tự, mất khoảng 15 phút.

## 1. Tạo project Supabase

1. Vào [supabase.com](https://supabase.com) → đăng nhập (dùng GitHub cho nhanh) → **New project**.
2. Đặt tên project (vd `kat-class`), chọn region **Southeast Asia (Singapore)** cho gần Việt Nam, tạo database password (lưu lại).
3. Đợi ~2 phút để project khởi tạo.

## 2. Lấy khóa API, điền vào `.env.local`

1. Vào **Project Settings → API**.
2. Copy 2 giá trị vào `.env.local`:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3. Tạo bảng profiles

1. Vào **SQL Editor → New query**.
2. Dán toàn bộ nội dung file [`supabase/migrations/0001_profiles.sql`](../supabase/migrations/0001_profiles.sql) → **Run**.

## 4. Bật đăng nhập Google

1. Tạo OAuth Client trên Google Cloud:
   - Vào [console.cloud.google.com](https://console.cloud.google.com) → tạo project (hoặc dùng lại project `kat-class` cũ của Firebase).
   - **APIs & Services → Credentials → Create Credentials → OAuth client ID** → loại **Web application**.
   - Ở **Authorized redirect URIs**, thêm: `https://<project-ref>.supabase.co/auth/v1/callback`
     (lấy đúng URL này trong Supabase: **Authentication → Providers → Google**, mục Callback URL).
2. Trong Supabase: **Authentication → Providers → Google** → bật **Enable**, dán `Client ID` + `Client Secret` từ Google Cloud → Save.

## 5. Khai báo Redirect URLs

Vào **Authentication → URL Configuration**:

- `Site URL`: URL production (vd `https://kat-class.vercel.app`) — tạm thời để `http://localhost:3000`.
- `Redirect URLs`: thêm cả hai:
  - `http://localhost:3000/login`
  - `https://<domain-production>/login`

(Luồng Google login của app redirect về `/login`, thiếu mục này Supabase sẽ chặn.)

## 6. Tạo tài khoản và gán role

- Đăng ký/đăng nhập lần đầu → hồ sơ tự tạo trong bảng `profiles` với role `student`.
- Gán role cho tài khoản quản trị / giáo viên: **Table Editor → profiles** → sửa cột `role` thành `admin` hoặc `teacher`.
- Tạo tài khoản email/password cho học viên (khi chưa có trang đăng ký): **Authentication → Users → Add user** (tick "Auto Confirm User").

## 7. Chạy thử

```bash
pnpm dev
```

Mở `http://localhost:3000/login`:
- Đăng nhập bằng email/password đã tạo ở bước 6 → vào đúng khu vực theo role.
- Đăng nhập Google → lần đầu tạo hồ sơ role `student`, vào khu học viên.

## Khi deploy lên Vercel

Thêm 2 biến môi trường `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` trong **Vercel → Project → Settings → Environment Variables**, và cập nhật `Site URL` + `Redirect URLs` (bước 5) với domain thật.
