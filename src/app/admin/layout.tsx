import { AppShell } from "@/components/shell/app-shell";
import { users } from "@/lib/mock-data";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = users.find((u) => u.role === "admin")!;
  return <AppShell user={admin}>{children}</AppShell>;
}
