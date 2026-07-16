"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  HeartHandshake,
  MessageSquareText,
  School,
  Star,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { PackageSummaryCard } from "@/components/package-summary";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import {
  fetchStudentAttendanceSummary,
  ATTENDANCE_LABELS,
  WEEKDAY_LABELS,
  type AttendanceStatus,
} from "@/lib/db";
import { fetchHomeworksForStudent } from "@/lib/db-content";
import {
  fetchChildrenOfParent,
  fetchMyAttendance,
  fetchMyClasses,
  fetchMyComments,
  fetchMyUpcomingSessions,
  RELATIONSHIP_LABELS,
} from "@/lib/db-student";
import { pct, cn } from "@/lib/utils";

const ATTENDANCE_BADGE: Record<AttendanceStatus, "jade" | "gold" | "destructive" | "default"> = {
  present: "jade",
  absent_excused: "gold",
  absent_unexcused: "destructive",
  makeup: "default",
};

export default function ParentHome() {
  const { user } = useAuth();
  const parentId = user?.id ?? "";

  const children = useLoad(
    () => (parentId ? fetchChildrenOfParent(parentId) : Promise.resolve([])),
    [parentId],
  );
  const [childId, setChildId] = useState("");

  // Tự chọn con đầu tiên khi dữ liệu về
  useEffect(() => {
    if (!childId && children.data?.length) {
      setChildId(children.data[0].student_id);
    }
  }, [children.data, childId]);

  const classes = useLoad(
    () => (childId ? fetchMyClasses(childId) : Promise.resolve([])),
    [childId],
  );
  const classIds = (classes.data ?? []).map((c) => c.class_id);
  const classKey = classIds.join(",");

  const upcoming = useLoad(
    () =>
      childId && classes.data
        ? fetchMyUpcomingSessions(childId, classIds, 14)
        : Promise.resolve([]),
    [childId, classKey, !!classes.data],
  );
  const summary = useLoad(
    () =>
      childId
        ? fetchStudentAttendanceSummary(childId)
        : Promise.resolve({ total: 0, byStatus: { present: 0, absent_excused: 0, absent_unexcused: 0, makeup: 0 } }),
    [childId],
  );
  const attendance = useLoad(
    () => (childId ? fetchMyAttendance(childId) : Promise.resolve([])),
    [childId],
  );
  const comments = useLoad(
    () => (childId ? fetchMyComments(childId, 6) : Promise.resolve([])),
    [childId],
  );
  const homeworks = useLoad(
    () =>
      childId && classes.data
        ? fetchHomeworksForStudent(classIds, childId)
        : Promise.resolve([]),
    [childId, classKey, !!classes.data],
  );

  const child = useMemo(
    () => (children.data ?? []).find((c) => c.student_id === childId) ?? null,
    [children.data, childId],
  );
  const attended = (summary.data?.byStatus.present ?? 0) + (summary.data?.byStatus.makeup ?? 0);
  const pendingHw = (homeworks.data ?? []).filter((h) => h.submissions.length === 0);
  const doneHw = (homeworks.data ?? []).filter((h) => h.submissions.length > 0);

  if (children.loading) {
    return <Card><LoadingRows rows={5} /></Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Cổng phụ huynh</h1>
        <p className="mt-1 text-muted-foreground">
          Theo dõi lịch học, chuyên cần, nhận xét và bài tập của con tại KAT Education.
        </p>
      </div>

      {children.error && <ErrorNote message={children.error} />}

      {(children.data?.length ?? 0) === 0 ? (
        <Empty
          icon={HeartHandshake}
          title="Chưa liên kết với học viên nào"
          description="Liên hệ trung tâm KAT Education để liên kết tài khoản của bạn với hồ sơ của con."
        />
      ) : (
        <>
          {/* Chọn con */}
          {(children.data?.length ?? 0) > 1 && (
            <div className="flex flex-wrap gap-2">
              {children.data!.map((c) => (
                <button
                  key={c.student_id}
                  onClick={() => setChildId(c.student_id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                    childId === c.student_id
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-input bg-card text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <Avatar name={c.student?.name ?? "?"} src={c.student?.avatar ?? undefined} size={22} />
                  {c.student?.name}
                </button>
              ))}
            </div>
          )}

          {child && (
            <div className="flex items-center gap-3 rounded-2xl border bg-gradient-to-br from-brand-50 to-gold-50 p-4">
              <Avatar name={child.student?.name ?? "?"} src={child.student?.avatar ?? undefined} size={48} />
              <div>
                <div className="font-bold">{child.student?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {child.student?.student_code && (
                    <span className="font-mono font-medium text-brand-700">{child.student.student_code}</span>
                  )}
                  {" · "}
                  {RELATIONSHIP_LABELS[child.relationship] ?? child.relationship} của bé
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <StatCard label="Lớp đang học" value={classes.data?.length ?? "—"} icon={School} accent="brand" />
            <StatCard label="Buổi 14 ngày tới" value={upcoming.data?.length ?? "—"} icon={CalendarClock} accent="sky" />
            <StatCard
              label="Chuyên cần"
              value={summary.data && summary.data.total > 0 ? `${pct(attended, summary.data.total)}%` : "—"}
              icon={CheckCircle2}
              accent="jade"
            />
            <StatCard label="Bài tập chưa làm" value={pendingHw.length} icon={ClipboardList} accent="gold" />
          </section>

          {/* Gói buổi còn lại của con (chỉ hiện khi đã mua gói) */}
          {childId && <PackageSummaryCard studentId={childId} forParent />}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Lịch học */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-brand-600" /> Lịch học sắp tới
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {upcoming.loading || classes.loading ? (
                  <LoadingRows rows={3} className="p-0" />
                ) : (upcoming.data?.length ?? 0) === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Không có buổi học nào trong 14 ngày tới.
                  </div>
                ) : (
                  <div className="divide-y">
                    {upcoming.data!.slice(0, 6).map((s) => {
                      const d = new Date(s.date + "T00:00:00");
                      return (
                        <div key={s.id} className="flex items-center gap-3 py-2.5">
                          <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-brand-50 py-1.5 text-brand-700">
                            <span className="text-[10px] font-bold uppercase">{WEEKDAY_LABELS[d.getDay()]}</span>
                            <span className="text-lg font-extrabold leading-none">{d.getDate()}</span>
                            <span className="text-[10px]">Th{d.getMonth() + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{s.class?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                              {s.room && ` · Phòng ${s.room.name}`}
                            </div>
                          </div>
                          {s.isMakeupForMe && <Badge variant="jade">Học bù</Badge>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Điểm danh gần đây */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-600" /> Điểm danh gần đây
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {attendance.loading ? (
                  <LoadingRows rows={3} className="p-0" />
                ) : (attendance.data?.length ?? 0) === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Chưa có lượt điểm danh nào.
                  </div>
                ) : (
                  <div className="divide-y">
                    {attendance.data!.slice(0, 6).map((a) => (
                      <div key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <span className="w-20 shrink-0 text-xs text-muted-foreground">
                          {a.session
                            ? new Date(a.session.date + "T00:00:00").toLocaleDateString("vi-VN")
                            : "—"}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{a.session?.class?.name}</span>
                        <Badge variant={ATTENDANCE_BADGE[a.status]}>{ATTENDANCE_LABELS[a.status]}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Nhận xét của giáo viên */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-brand-600" /> Nhận xét của giáo viên sau buổi học
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {comments.loading ? (
                <LoadingRows rows={2} className="p-0" />
              ) : (comments.data?.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Chưa có nhận xét nào — giáo viên sẽ nhận xét sau mỗi buổi học.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {comments.data!.map((c) => (
                    <div key={c.id} className="rounded-xl border bg-gradient-to-br from-brand-50/60 to-gold-50/60 p-4">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{c.teacher?.name ?? "Giáo viên"}</span>
                        <span>
                          {c.session?.date
                            ? new Date(c.session.date + "T00:00:00").toLocaleDateString("vi-VN")
                            : ""}
                        </span>
                      </div>
                      {c.rating ? (
                        <div className="mt-1 flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              className={`h-3.5 w-3.5 ${n <= (c.rating ?? 0) ? "fill-gold-500 text-gold-500" : "text-muted-foreground/30"}`}
                            />
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-sm leading-relaxed">{c.content}</p>
                      <div className="mt-2 text-xs text-muted-foreground">{c.session?.class?.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bài tập của con */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-brand-600" /> Bài tập về nhà
                <Badge variant="muted">{homeworks.data?.length ?? 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {homeworks.loading || classes.loading ? (
                <LoadingRows rows={2} className="p-0" />
              ) : (homeworks.data?.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Giáo viên chưa giao bài tập nào.
                </div>
              ) : (
                <div className="divide-y">
                  {[...pendingHw, ...doneHw].map((h) => {
                    const sub = h.submissions[0];
                    const overdue = !sub && h.due_at ? new Date(h.due_at) < new Date() : false;
                    return (
                      <div key={h.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{h.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {h.class?.name}
                            {h.due_at &&
                              ` · Hạn ${new Date(h.due_at).toLocaleDateString("vi-VN")}`}
                          </div>
                        </div>
                        {sub ? (
                          <Badge variant="jade">Đã nộp · {sub.score ?? "—"}/10</Badge>
                        ) : overdue ? (
                          <Badge variant="destructive">Quá hạn</Badge>
                        ) : (
                          <Badge variant="gold">Chưa làm</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
