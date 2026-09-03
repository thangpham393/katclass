"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import type { User } from "@/lib/types";

const COLLAPSE_KEY = "kat.sidebar.collapsed";

/**
 * Khung ứng dụng: menu trái + thanh trên + vùng nội dung.
 *
 * Menu thu/mở được bằng nút ở đầu thanh trên (như ảnh mẫu) — trang thời khóa
 * biểu và bảng công rộng ngang, thu menu lại là thêm 250px cho bảng. Lựa chọn
 * nhớ trong localStorage nên không phải bấm lại mỗi lần vào.
 */
export function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Đọc sau khi mount để server và client render giống nhau (tránh hydration mismatch).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* trình duyệt chặn localStorage thì cứ để mở */
    }
  }, []);

  function toggle() {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1");
      } catch {
        /* không lưu được thì thôi, vẫn thu/mở được trong phiên */
      }
      return !v;
    });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {!collapsed && <Sidebar />}
      <div className="min-w-0 flex-1">
        <TopBar user={user} onToggleSidebar={toggle} sidebarCollapsed={collapsed} />
        <main className="container max-w-7xl animate-fade-in px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:pt-6 md:px-8 md:pb-10 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
