import { AuthGuard } from "@/components/auth/auth-guard";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard role="parent">{children}</AuthGuard>;
}
