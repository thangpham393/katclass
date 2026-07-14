import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import type { User } from "@/lib/types";

export function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      <div className="flex-1 min-w-0">
        <TopBar user={user} />
        <main className="container max-w-7xl px-4 py-8 md:px-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
