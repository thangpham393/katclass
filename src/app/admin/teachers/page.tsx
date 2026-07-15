"use client";

import { GraduationCap, Mail, Phone } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { fetchProfilesByRole } from "@/lib/db";
import { useLoad } from "@/lib/use-load";

export default function AdminTeachersPage() {
  const { data: teachers, loading, error } = useLoad(() => fetchProfilesByRole("teacher"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Giáo viên</h1>
        <p className="mt-1 text-muted-foreground">
          {loading ? "Đang tải..." : `${teachers?.length ?? 0} giáo viên đang giảng dạy.`}
        </p>
      </div>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : (teachers?.length ?? 0) === 0 ? (
        <Empty
          icon={GraduationCap}
          title="Chưa có giáo viên"
          description="Giáo viên đăng nhập vào hệ thống, sau đó bạn gán vai trò Giáo viên trong Cài đặt → Phân quyền."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teachers!.map((t) => (
            <Card key={t.id} className="card-hover">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar name={t.name} src={t.avatar ?? undefined} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{t.name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      Tham gia {new Date(t.created_at).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {t.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {t.phone ?? "Chưa có SĐT"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
