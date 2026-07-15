"use client";

import Link from "next/link";
import { School, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import {
  fetchTeacherClasses,
  formatSchedules,
  CLASS_STATUS_LABELS,
  LEVEL_LABELS,
} from "@/lib/db";
import { useLoad } from "@/lib/use-load";

export default function TeacherClassesPage() {
  const { user } = useAuth();
  const teacherId = user?.id ?? "";
  const classes = useLoad(
    () => (teacherId ? fetchTeacherClasses(teacherId) : Promise.resolve([])),
    [teacherId],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Lớp dạy</h1>
        <p className="mt-1 text-muted-foreground">
          {classes.loading ? "Đang tải..." : `Bạn phụ trách ${classes.data?.length ?? 0} lớp.`}
        </p>
      </div>

      {classes.error && <ErrorNote message={classes.error} />}

      {classes.loading ? (
        <Card><LoadingRows rows={5} /></Card>
      ) : (classes.data?.length ?? 0) === 0 ? (
        <Empty
          icon={School}
          title="Chưa được phân công lớp"
          description="Khi quản lý gán bạn phụ trách lớp, lớp sẽ hiện ở đây."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.data!.map((c) => (
            <Link key={c.id} href={`/teacher/classes/${c.id}`}>
              <Card className="h-full p-5 transition-shadow hover:shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="zh grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700">
                    {c.course?.level ? LEVEL_LABELS[c.course.level] ?? c.course.level : "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.course?.name ?? "Chưa gắn khóa học"}
                    </div>
                  </div>
                  <Badge variant={c.status === "active" ? "jade" : c.status === "planned" ? "gold" : "muted"}>
                    {CLASS_STATUS_LABELS[c.status]}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatSchedules(c.class_schedules)}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <Users className="h-3.5 w-3.5" /> {c.class_students?.[0]?.count ?? 0}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
