import { AuthGuard } from "@/components/auth/auth-guard";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard role="teacher">{children}</AuthGuard>;
}
