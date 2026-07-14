"use client";

import { useRouter } from "next/navigation";
import { Bell, Search, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { signOut } from "@/lib/auth";
import type { User } from "@/lib/types";

const roleLabel = {
  student: "Học viên",
  teacher: "Giáo viên",
  admin: "Quản lý",
};

export function TopBar({ user }: { user: User }) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/70 bg-white/70 px-4 backdrop-blur-xl md:px-6">
      <div className="relative hidden flex-1 md:block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Tìm bài học, từ vựng, lớp..."
          className="pl-9 bg-muted/50 border-transparent"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <button className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-white hover:bg-muted transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white" />
        </button>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-2 py-1.5">
          <Avatar name={user.name} src={user.avatar} size={32} />
          <div className="hidden md:block leading-tight text-left">
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="gold" className="px-1.5 py-0">
                {roleLabel[user.role]}
              </Badge>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          title="Đăng xuất"
          className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-white text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
