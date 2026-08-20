"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SessionReportView } from "@/components/session-report";
import { useAuth } from "@/components/auth/auth-provider";

export default function StudentSessionReportPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <Link
        href="/student"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Trang chủ
      </Link>
      {user && <SessionReportView sessionId={params.id} studentId={user.id} />}
    </div>
  );
}
