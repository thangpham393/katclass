import { AppShell } from "@/components/shell/app-shell";
import { users } from "@/lib/mock-data";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const teacher = users.find((u) => u.role === "teacher")!;
  return <AppShell user={teacher}>{children}</AppShell>;
}
