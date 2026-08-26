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
      <div className="min-w-0 flex-1">
        <TopBar user={user} />
        <main className="container max-w-7xl animate-fade-in px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:pt-6 md:px-8 md:pb-10 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
