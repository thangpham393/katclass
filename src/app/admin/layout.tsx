import { AuthGuard } from "@/components/auth/auth-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard role={["admin", "staff"]}>{children}</AuthGuard>;
}
