import { AppShell } from "@/components/shell/app-shell";
import { users } from "@/lib/mock-data";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const student = users.find((u) => u.role === "student")!;
  return <AppShell user={student}>{children}</AppShell>;
}
