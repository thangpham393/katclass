"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardX,
  DollarSign,
  GraduationCap,
  Presentation,
  Receipt,
  School,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import {
  fetchDashboardStats,
  fetchClasses,
  formatSchedules,
  CLASS_STATUS_LABELS,
  LEVEL_LABELS,
  todayISO,
} from "@/lib/db";
import { useLoad } from "@/lib/use-load";
import { useAuth } from "@/components/auth/auth-provider";
import { TeachingCard } from "@/components/teaching-card";
import { TeachingLogModal } from "@/components/teaching-log-modal";
import { Select } from "@/components/ui/select";
import { BranchSwitcher } from "@/components/shell/branch-switcher";
import {
  fetchPackageBalances,
  fetchPaymentsTotalSince,
  fetchTeachingSessions,
  firstOfMonthISO,
  fmtVND,
  pickLog,
  type TeachingSessionRow,
} from "@/lib/db-tuition";

/** Ngưỡng "sắp hết buổi" — dưới mức này là phải gọi phụ huynh gia hạn. */
const LOW_SESSIONS = 6;

/**
 * Câu nói trong ngày. Chọn theo số thứ tự ngày trong năm nên cả trung tâm cùng
 * thấy một câu, và mỗi ngày một câu khác — không random để reload không nhảy.
 */
const QUOTES = [
  "学而时习之，不亦说乎 — Học rồi thường xuyên ôn luyện, chẳng phải là niềm vui sao?",
  "Giá trị lớn nhất chúng ta mang lại là sự tiến bộ của học viên.",
  "千里之行，始于足下 — Hành trình ngàn dặm bắt đầu từ một bước chân.",
  "Mỗi ngày 5 từ mới, một năm là 1.800 từ.",
  "温故而知新 — Ôn cũ mà biết mới.",
  "Lớp học tốt là lớp mà học viên dám mở miệng nói sai.",
  "不怕慢，就怕站 — Không sợ chậm, chỉ sợ đứng yên.",
];

function quoteOfToday(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return QUOTES[day % QUOTES.length];
}

export default function AdminHome() {
  const { user, can } = useAuth();
  const stats = useLoad(fetchDashboardStats);
  const classes = useLoad(fetchClasses);

  // Toàn bộ ca dạy hôm nay của mọi giáo viên — hành chính vào hỗ trợ được
  const today = todayISO();
  const todaySessions = useLoad(() => fetchTeachingSessions(today, today), [today]);
  const [teacherFilter, setTeacherFilter] = useState("");
  const [logFor, setLogFor] = useState<TeachingSessionRow | null>(null);

  // Tiền chỉ tải khi vai trò có quyền học phí — kế toán/hành chính không được
  // bật quyền thì RLS trả rỗng, hỏi làm gì cho tốn một vòng mạng.
  const seesMoney = can("tuition.manage");
  const balances = useLoad(
    async () => (seesMoney ? fetchPackageBalances() : []),
    [seesMoney],
  );
  const revenue = useLoad(async () => {
    if (!seesMoney) return null;
    const [month, year] = await Promise.all([
      fetchPaymentsTotalSince(firstOfMonthISO()),
      fetchPaymentsTotalSince(`${new Date().getFullYear()}-01-01`),
    ]);
    return { month, year };
  }, [seesMoney]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of todaySessions.data ?? []) if (s.teacher) map.set(s.teacher.id, s.teacher.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [todaySessions.data]);

  const sessionsToday = useMemo(
    () =>
      (todaySessions.data ?? []).filter((s) => !teacherFilter || s.teacher?.id === teacherFilter),
    [todaySessions.data, teacherFilter],
  );
  const unloggedToday = sessionsToday.filter((s) => !pickLog(s)).length;

  /**
   * Số buổi còn lại tính theo HỌC VIÊN chứ không theo từng gói: một em có thể
   * đang giữ hai gói, gói cũ còn 1 buổi nhưng đã mua gói mới 20 buổi thì không
   * việc gì phải gọi điện nhắc.
   */
  const lowStudents = useMemo(() => {
    const byStudent = new Map<string, { name: string; remaining: number; debt: number }>();
    for (const b of balances.data ?? []) {
      const cur = byStudent.get(b.student_id) ?? { name: b.student_name, remaining: 0, debt: 0 };
      cur.remaining += Number(b.remaining_sessions) || 0;
      cur.debt += Number(b.debt) || 0;
      byStudent.set(b.student_id, cur);
    }
    return [...byStudent.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .filter((s) => s.remaining < LOW_SESSIONS)
      .sort((a, b) => a.remaining - b.remaining);
  }, [balances.data]);

  const totalDebt = useMemo(
    () => (balances.data ?? []).reduce((sum, b) => sum + (Number(b.debt) || 0), 0),
    [balances.data],
  );

  const isEmpty =
    !stats.loading &&
    stats.data &&
    stats.data.students === 0 &&
    stats.data.activeClasses === 0;

  const num = (loading: boolean, v: number | undefined) => (loading ? "…" : v ?? 0);

  return (
    <div className="space-y-5">
      {/* Chi nhánh đang xem — để ngay đầu trang vì mọi con số bên dưới đều đọc
          theo nó; giấu trong thanh trên cùng thì dễ xem nhầm số của cơ sở kia. */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
          <div className="text-sm font-bold">Trung tâm</div>
          <BranchSwitcher className="w-full sm:w-72" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Sparkles className="h-4 w-4 text-gold-600" /> Thông điệp hôm nay
          </div>
          <p className="mt-3 text-lg font-bold leading-snug text-gold-600 sm:text-xl">
            &ldquo;{quoteOfToday()}&rdquo;
          </p>
        </CardContent>
      </Card>

      {isEmpty && <OnboardingChecklist hasClasses={(classes.data?.length ?? 0) > 0} />}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatTile
          label="Học viên đang học"
          value={num(stats.loading, stats.data?.students)}
          icon={Users}
        />
        <StatTile
          label="Lớp đang học"
          value={num(stats.loading, stats.data?.activeClasses)}
          icon={School}
        />
        <StatTile
          label="Giáo viên"
          value={num(stats.loading, stats.data?.teachers)}
          icon={GraduationCap}
        />
        <StatTile
          label={`< ${LOW_SESSIONS} buổi còn lại`}
          value={seesMoney ? (balances.loading ? "…" : lowStudents.length) : "—"}
          icon={AlertTriangle}
        />
        <StatTile
          label="Chờ xếp học bù"
          value={num(stats.loading, stats.data?.pendingMakeups)}
          icon={CalendarClock}
        />

        <StatTile
          label="Doanh thu tháng này"
          value={seesMoney ? (revenue.loading ? "…" : fmtVND(revenue.data?.month ?? 0)) : "—"}
          icon={DollarSign}
          valueClassName="text-xl sm:text-2xl"
        />
        <StatTile
          label="Doanh thu năm nay"
          value={seesMoney ? (revenue.loading ? "…" : fmtVND(revenue.data?.year ?? 0)) : "—"}
          icon={DollarSign}
          valueClassName="text-xl sm:text-2xl"
        />
        <StatTile
          label="Công nợ học phí"
          value={seesMoney ? (balances.loading ? "…" : fmtVND(totalDebt)) : "—"}
          icon={Receipt}
          valueClassName="text-xl sm:text-2xl"
        />
        <StatTile
          label="Ca dạy hôm nay"
          value={todaySessions.loading ? "…" : (todaySessions.data ?? []).length}
          icon={CalendarDays}
          tone="brand"
        />
        <StatTile
          label="Chưa chấm công hôm nay"
          value={todaySessions.loading ? "…" : unloggedToday}
          hint={!todaySessions.loading && unloggedToday === 0 ? "Đã chấm công đủ 🎉" : undefined}
          icon={unloggedToday > 0 ? ClipboardX : CalendarCheck}
          tone={unloggedToday > 0 ? "gold" : "jade"}
        />
      </section>

      {seesMoney && (
        <Card className="border-gold-200">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-gold-700">
                <AlertTriangle className="h-4 w-4" /> Cảnh báo sắp hết buổi
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Học viên có tổng buổi còn lại ít hơn {LOW_SESSIONS}
              </p>
            </div>
            <Link href="/admin/tuition" className="text-xs font-semibold text-gold-700 hover:underline">
              Trang học phí <ArrowRight className="inline h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
            {balances.error ? (
              <ErrorNote message={balances.error} />
            ) : balances.loading ? (
              <LoadingRows rows={2} className="p-0" />
            ) : lowStudents.length === 0 ? (
              <div className="text-sm text-muted-foreground">Tất cả ổn 🎉</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {lowStudents.slice(0, 8).map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/students/${s.id}`}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-gold-300"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.name}</div>
                      {s.debt > 0 && (
                        <div className="text-xs text-gold-700">Còn nợ {fmtVND(s.debt)}</div>
                      )}
                    </div>
                    <Badge variant={s.remaining <= 0 ? "gold" : "muted"}>
                      {s.remaining} buổi
                    </Badge>
                  </Link>
                ))}
                {lowStudents.length > 8 && (
                  <div className="self-center text-xs text-muted-foreground">
                    … và {lowStudents.length - 8} học viên nữa
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Presentation className="h-4 w-4 text-gold-600" /> Lớp học hôm nay
            {!todaySessions.loading && (
              <span className="text-xs font-normal text-muted-foreground">
                {sessionsToday.length} ca
                {unloggedToday > 0 ? ` · ${unloggedToday} chưa chấm công` : " · đã chấm công đủ ✓"}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {teacherOptions.length > 1 && (
              <Select
                wrapClassName="w-full sm:w-auto"
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="h-9 w-full text-xs sm:w-48"
              >
                <option value="">Tất cả giáo viên</option>
                {teacherOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
            <Link href="/admin/timetable" className="text-xs font-semibold text-brand-600 hover:underline">
              Thời khóa biểu <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
          <p className="text-xs text-muted-foreground">
            Bấm vào một ca để dùng đầy đủ chức năng của giáo viên: chuẩn bị bài, vào lớp dạy
            (chiếu máy chiếu), điểm danh học viên và chấm công hộ.
          </p>
          {todaySessions.error && <ErrorNote message={todaySessions.error} />}
          {todaySessions.loading ? (
            <LoadingRows rows={3} className="p-0" />
          ) : sessionsToday.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {teacherFilter
                ? "Giáo viên này hôm nay không có ca dạy nào."
                : "Hôm nay trung tâm không có ca dạy nào."}
            </div>
          ) : (
            sessionsToday.map((s) => (
              <TeachingCard key={s.id} session={s} showTeacher onLog={() => setLogFor(s)} />
            ))
          )}
        </CardContent>
      </Card>

      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Lớp học gần đây</CardTitle>
            <Link href="/admin/classes" className="text-xs font-semibold text-brand-600 hover:underline">
              Tất cả lớp <ArrowRight className="inline h-3 w-3" />
            </Link>
          </CardHeader>
          {classes.error && <ErrorNote message={classes.error} />}
          {classes.loading ? (
            <LoadingRows rows={4} />
          ) : (
            <CardContent className="space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">
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
          <CardContent className="space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">
            {[
              { href: "/admin/courses", icon: BookMarked, label: "Tạo khóa học", desc: "Định nghĩa chương trình HSK, giao tiếp..." },
              { href: "/admin/classes", icon: School, label: "Mở lớp mới", desc: "Chọn khóa, giáo viên, lịch tuần" },
              { href: "/admin/students", icon: Users, label: "Xếp lớp học viên", desc: "Học viên đăng ký sẽ hiện ở đây" },
              { href: "/library/textbooks", icon: BookOpen, label: "Kho học liệu", desc: "Giáo trình, bộ bài tập, ngân hàng câu hỏi" },
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

      <TeachingLogModal
        session={logFor}
        currentUserId={user?.id ?? ""}
        onClose={() => setLogFor(null)}
        onSaved={() => {
          setLogFor(null);
          todaySessions.reload();
        }}
      />
    </div>
  );
}

/**
 * Danh sách việc cần làm khi trung tâm còn trống trơn, kèm thanh tiến độ —
 * người mới mở phần mềm nhìn vào biết ngay còn mấy bước nữa là chạy được.
 */
function OnboardingChecklist({ hasClasses }: { hasClasses: boolean }) {
  const steps = [
    {
      done: true,
      label: "Trung tâm đã tạo",
      desc: "Bạn đã có cơ sở đầu tiên.",
      href: "/admin/settings",
      cta: "Cài đặt",
    },
    {
      done: false,
      label: "Thêm khóa học",
      desc: "Tạo các khóa học để gán cho học viên.",
      href: "/admin/courses",
      cta: "Thêm khóa học",
    },
    {
      done: hasClasses,
      label: "Mở lớp và xếp lịch tuần",
      desc: "Chọn khóa, giáo viên, lịch học hằng tuần.",
      href: "/admin/classes",
      cta: "Mở lớp",
    },
    {
      done: false,
      label: "Nhập học viên",
      desc: "Thêm học viên rồi xếp vào lớp.",
      href: "/admin/students",
      cta: "Đi tới Học viên",
    },
    {
      done: false,
      label: "Mời nhân sự",
      desc: "Mời giáo viên, hành chính cùng vận hành.",
      href: "/admin/teachers",
      cta: "Mời nhân sự",
    },
  ];
  const done = steps.filter((s) => s.done).length;
  const percent = Math.round((done / steps.length) * 100);

  return (
    <Card className="border-brand-200 bg-brand-50/40">
      <CardContent className="p-4 sm:p-5">
        <div className="text-sm font-bold text-brand-800">Cài đặt trung tâm</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Hoàn tất các bước để chạy trung tâm của bạn — có thể quay lại bất cứ lúc nào.
        </p>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-brand-100">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground">
          {done}/{steps.length} bước hoàn tất ({percent}%)
        </div>

        <div className="mt-3 space-y-2">
          {steps.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              {s.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-jade-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              )}
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-semibold ${s.done ? "text-muted-foreground line-through" : ""}`}>
                  {s.label}
                </div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
              {!s.done && (
                <Link
                  href={s.href}
                  className="shrink-0 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  {s.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
