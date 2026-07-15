import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Client dùng phía trình duyệt, khởi tạo lười để không chạy lúc build/prerender
 * (khi đó có thể chưa có env). Session lưu trong cookie (thay vì localStorage)
 * để sau này Server Components / Route Handlers đọc được cùng một phiên đăng nhập.
 */
export function getSupabase(): SupabaseClient {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
