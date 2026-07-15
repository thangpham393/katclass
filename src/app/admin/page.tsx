"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  CalendarClock,
  GraduationCap,
  School,
  Users,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import {
  fetchDashboardStats,
  fetchClasses,
  formatSchedules,
  CLASS_STATUS_LABELS,
  LEVEL_LABELS,
} from "@/lib/db";
import { useLoad } from "@/lib/use-load";

export default function AdminHome() {
  const stats = useLoad(fetchDashboardStats);
  const classes = useLoad(fetchClasses);

  const isEmpty =
    !stats.loading &&
    stats.data &&
    stats.data.students === 0 &&
    stats.data.activeClasses === 0;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Tổng quan trung tâm</h1>
          <p className="mt-1 text-muted-foreground">
            Theo dõi vận hành — học viên, lớp học, lịch dạy và học bù.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Học viên"
          value={stats.loading ? "…" : stats.data?.students ?? 0}
          icon={Users}
          accent="brand"
        />
        <StatCard
          label="Giáo viên"
          value={stats.loading ? "…" : stats.data?.teachers ?? 0}
          icon={GraduationCap}
          accent="gold"
        />
        <StatCard
          label="Lớp đang học"
          value={stats.loading ? "…" : stats.data?.activeClasses ?? 0}
          icon={School}
          accent="jade"
        />
        <StatCard
          label="Chờ xếp học bù"
          value={stats.loading ? "…" : stats.data?.pendingMakeups ?? 0}
          icon={CalendarClock}
          accent="sky"
        />
      </section>

      {isEmpty && <OnboardingChecklist hasClasses={(classes.data?.length ?? 0) > 0} />}

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lớp học gần đây</CardTitle>
            <Link href="/admin/classes" className="text-xs font-semibold text-brand-600 hover:underline">
              Tất cả lớp <ArrowRight className="inline h-3 w-3" />
            </Link>
          </CardHeader>
          {classes.error && <ErrorNote message={classes.error} />}
          {classes.loading ? (
            <LoadingRows rows={4} />
          ) : (
            <CardContent className="space-y-2 p-5 pt-0">
              {(classes.data ?? []).slice(0, 6).map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/classes/${c.id}`}
                  className="flex items-center gap-4 rounded-lg border bg-card p-3.5 transition-colors hover:border-brand-300"
                >
                  <div className="zh grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">
                    {c.course?.level ? LEVEL_LABELS[c.course.level] ?? c.course.level : "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatSchedules(c.class_schedules)}
                      {c.teacher ? ` · GV: ${c.teacher.name}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-sm font-bold">
                    {c.class_students?.[0]?.count ?? 0}
                    <span className="block text-[10px] font-normal text-muted-foreground">học viên</span>
                  </div>
                  <Badge variant={c.status === "active" ? "jade" : c.status === "planned" ? "gold" : "muted"}>
                    {CLASS_STATUS_LABELS[c.status]}
                  </Badge>
                </Link>
              ))}
              {(classes.data?.length ?? 0) === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Chưa có lớp nào. <Link href="/admin/classes" className="font-semibold text-brand-600">Tạo lớp đầu tiên →</Link>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thao tác nhanh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-5 pt-0">
            {[
              { href: "/admin/courses", icon: BookMarked, label: "Tạo khóa học", desc: "Định nghĩa chương trình HSK, giao tiếp..." },
              { href: "/admin/classes", icon: School, label: "Mở lớp mới", desc: "Chọn khóa, giáo viên, lịch tuần" },
              { href: "/admin/students", icon: Users, label: "Xếp lớp học viên", desc: "Học viên đăng ký sẽ hiện ở đây" },
              { href: "/admin/settings", icon: GraduationCap, label: "Phân quyền", desc: "Gán vai trò giáo viên / hành chính" },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-brand-700">
                  <a.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{a.desc}</div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function OnboardingChecklist({ hasClasses }: { hasClasses: boolean }) {
  const steps = [
    { done: false, label: "Tạo khóa học đầu tiên (vd: HSK 1 cơ bản)", href: "/admin/courses" },
    { done: hasClasses, label: "Mở lớp và xếp lịch tuần", href: "/admin/classes" },
    { done: false, label: "Mời học viên đăng nhập rồi xếp vào lớp", href: "/admin/students" },
  ];
  return (
    <Card className="border-brand-200 bg-brand-50/50">
      <CardContent className="p-5">
        <div className="text-sm font-bold text-brand-800">Bắt đầu vận hành trung tâm</div>
        <div className="mt-3 space-y-2">
          {steps.map((s) => (
            <Link key={s.label} href={s.href} className="flex items-center gap-2.5 text-sm hover:underline">
              {s.done ? (
                <CheckCircle2 className="h-4 w-4 text-brand-600" />
              ) : (
                <Circle className="h-4 w-4 text-brand-300" />
              )}
              <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
