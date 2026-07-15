"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, GraduationCap, School } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { formatSchedules, CLASS_STATUS_LABELS, LEVEL_LABELS } from "@/lib/db";
import { fetchMyClasses } from "@/lib/db-student";

export default function MyClassesPage() {
  const { user } = useAuth();
  const studentId = user?.id ?? "";
  const classes = useLoad(
    () => (studentId ? fetchMyClasses(studentId) : Promise.resolve([])),
    [studentId],
  );

  const list = (classes.data ?? []).filter((c) => c.class);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Lớp của tôi</h1>
        <p className="mt-1 text-muted-foreground">
          {classes.loading ? "Đang tải..." : `${list.length} lớp đang theo học tại KAT Education.`}
        </p>
      </div>

      {classes.error && <ErrorNote message={classes.error} />}

      {classes.loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : list.length === 0 ? (
        <Empty
          icon={School}
          title="Chưa được xếp lớp"
          description="Trung tâm sẽ xếp bạn vào lớp phù hợp — liên hệ KAT Education nếu cần hỗ trợ."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((cs) => {
            const c = cs.class!;
            return (
              <Link key={cs.class_id} href={`/student/classes/${c.id}`}>
                <Card className="card-hover h-full overflow-hidden">
                  <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white">
                    <div className="flex items-center justify-between gap-2">
                      {c.course?.level ? (
                        <Badge variant="gold">{LEVEL_LABELS[c.course.level] ?? c.course.level}</Badge>
                      ) : <span />}
                      <Badge
                        variant="default"
                        className="border-white/0 bg-white/20 text-white"
                      >
                        {CLASS_STATUS_LABELS[c.status as keyof typeof CLASS_STATUS_LABELS] ?? c.status}
                      </Badge>
                    </div>
                    <div className="mt-3 text-lg font-bold">{c.name}</div>
                    {c.course && <div className="text-xs text-white/80">{c.course.name}</div>}
                  </div>
                  <CardContent className="space-y-2.5 p-5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4 shrink-0 text-brand-600" />
                      {formatSchedules(c.class_schedules)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GraduationCap className="h-4 w-4 shrink-0 text-brand-600" />
                      GV: {c.teacher?.name ?? "Chưa phân công"}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-1 text-sm font-semibold text-brand-600">
                      Vào lớp <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
