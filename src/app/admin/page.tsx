"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleCheck,
  Clock,
  LogOut,
  Phone,
  Sparkles,
  UserPlus,
  UserRound,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { fetchDashboardStats, fetchPendingMakeupCount, todayISO } from "@/lib/db";
import { fetchPendingRequestCount } from "@/lib/db-requests";
import { fetchPendingAbsenceCount } from "@/lib/db-absence";
import { fetchLowStockCount } from "@/lib/db-supplies";
import { useLoad } from "@/lib/use-load";
import { useAuth } from "@/components/auth/auth-provider";
import { TeachingLogModal } from "@/components/teaching-log-modal";
import { BranchSwitcher } from "@/components/shell/branch-switcher";
import {
  fetchPackageBalances,
  fetchTeachingSessions,
  fmtVND,
  pickLog,
  type TeachingSessionRow,
} from "@/lib/db-tuition";
import { fetchCareRequests } from "@/lib/db-care-requests";
import {
  ABSENT_WARN,
  LOG_GRACE_HOURS,
  MISSING_WARN,
  SCORE_WARN,
  WINDOW_DAYS,
  fetchDashboardData,
  fetchLeadAlerts,
  fetchPaymentsBetween,
  fetchRetention,
  fetchUpcomingGaps,
  isUnmarked,
} from "@/lib/db-dashboard";
import { ACTION_ICONS, ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DebtCard, overdueDebts } from "@/components/dashboard/debt-card";
import { PlanCard } from "@/components/dashboard/plan-card";
import { RetentionCard } from "@/components/dashboard/retention-card";
import { TeacherCard } from "@/components/dashboard/teacher-card";
import {
  ADMIN_LINKS,
  AttentionCard,
  CareCard,
  ClassStatsCard,
  OVERDUE_ANCHOR,
  OverdueCard,
  sessionHref,
  CommentDueCard,
} from "@/components/dashboard/sections";
import { careRowsOf, computeDashboard, commentDueRows } from "@/lib/dashboard-calc";
import { cn } from "@/lib/utils";
import { EmptyRow, Pill, TD, Th, useSort } from "@/components/ui/table-kit";
import {
  KpiTile,
  SCROLL_10,
  SectionHead,
  dmy,
  hm,
  weekdayOf,
} from "@/components/dashboard/kit";

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

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Doanh thu tháng này so với CÙNG KỲ tháng trước (mùng 1 → cùng ngày), không
 * so với cả tháng trước — giữa tháng mà so cả tháng thì tháng nào cũng "giảm".
 */
async function fetchRevenueCompare(): Promise<{ cur: number; prev: number }> {
  const now = new Date();
  const thisFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  let prevTo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1);
  if (prevTo > thisFrom) prevTo = thisFrom; // 31/3 → hết tháng 2 thôi
  const [cur, prev] = await Promise.all([
    fetchPaymentsBetween(isoOf(thisFrom), todayISO(1)),
    fetchPaymentsBetween(isoOf(prevFrom), isoOf(prevTo)),
  ]);
  return { cur, prev };
}

function quoteOfToday(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return QUOTES[day % QUOTES.length];
}

interface LowRow {
  id: string;
  name: string;
  code: string | null;
  phone: string | null;
  className: string;
  remaining: number;
  debt: number;
  /** over = hết buổi mà vẫn đang học; none = đang học mà chưa có gói nào. */
  kind: "low" | "over" | "none";
}

export default function AdminHome() {
  const { user, can } = useAuth();
  const stats = useLoad(fetchDashboardStats);
  const dash = useLoad(fetchDashboardData);
  const care = useLoad(() => fetchCareRequests({ openOnly: true }));

  // Ca hôm nay nạp kiểu đầy đủ để mở được hộp chấm công hộ giáo viên
  const today = todayISO();
  const todaySessions = useLoad(
    () => fetchTeachingSessions(today, today, { includeCancelled: true }),
    [today],
  );
  const [teacher, setTeacher] = useState("");

  // Học phí chỉ tải khi vai trò có quyền — không có quyền thì RLS trả rỗng
  const seesMoney = can("tuition.manage");
  const balances = useLoad(async () => (seesMoney ? fetchPackageBalances() : []), [seesMoney]);
  const [logFor, setLogFor] = useState<TeachingSessionRow | null>(null);

  // Mỗi khối tự tải theo quyền của vai trò; không có quyền thì khỏi hỏi server
  const canRequests = can("requests.manage");
  const canMakeup = can("makeup.manage");
  const canStudents = can("students.manage");
  const canSupplies = can("supplies.manage");
  const gaps = useLoad(fetchUpcomingGaps);
  const pending = useLoad(async () => {
    const [requests, absences, makeups] = await Promise.all([
      canRequests ? fetchPendingRequestCount() : undefined,
      canMakeup ? fetchPendingAbsenceCount() : undefined,
      canMakeup ? fetchPendingMakeupCount() : undefined,
    ]);
    return { requests, absences, makeups };
  }, [canRequests, canMakeup]);
  const leads = useLoad(async () => (canStudents ? fetchLeadAlerts() : null), [canStudents]);
  const retention = useLoad(async () => (canStudents ? fetchRetention() : null), [canStudents]);
  const lowStock = useLoad(async () => (canSupplies ? fetchLowStockCount() : null), [canSupplies]);
  const revenue = useLoad(async () => (seesMoney ? fetchRevenueCompare() : null), [seesMoney]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of dash.data?.classes ?? []) if (c.teacher) map.set(c.teacher.id, c.teacher.name);
    for (const s of dash.data?.sessions ?? []) if (s.teacher) map.set(s.teacher.id, s.teacher.name);
    for (const s of todaySessions.data ?? []) if (s.teacher) map.set(s.teacher.id, s.teacher.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [dash.data, todaySessions.data]);

  const d = useMemo(
    () => (dash.data ? computeDashboard(dash.data, { today, teacher }) : null),
    [dash.data, teacher, today],
  );

  const commentRows = useMemo(
    () => (d ? commentDueRows(d.sessions, today) : []),
    [d, today],
  );

  /* Chăm sóc đang mở: phiếu Mới / Đang xử lý (lọc GV theo lớp gắn với phiếu) */
  const careRows = useMemo(
    () => careRowsOf(care.data ?? [], teacher && d ? d.classIds : null, today),
    [care.data, teacher, d, today],
  );

  /**
   * Số buổi còn lại tính theo HỌC VIÊN chứ không theo từng gói: một em có thể
   * đang giữ hai gói, gói cũ còn 1 buổi nhưng đã mua gói mới 20 buổi thì không
   * việc gì phải gọi điện nhắc.
   */
  const lowRows = useMemo<LowRow[]>(() => {
    const byStudent = new Map<string, LowRow>();
    for (const b of balances.data ?? []) {
      const cur = byStudent.get(b.student_id) ?? {
        id: b.student_id,
        name: b.student_name,
        code: b.student_code,
        phone: b.student_phone,
        className: d?.classOfStudent.get(b.student_id) ?? "—",
        remaining: 0,
        debt: 0,
        kind: "low",
      };
      cur.remaining += Number(b.remaining_sessions) || 0;
      cur.debt += Number(b.debt) || 0;
      byStudent.set(b.student_id, cur);
    }
    for (const r of byStudent.values()) {
      if (r.remaining <= 0 && d?.studentInfo.has(r.id)) r.kind = "over";
    }
    // Trung tâm có dùng gói học phí thì em đang học mà chưa có gói nào là học chùa
    if ((balances.data?.length ?? 0) > 0) {
      for (const [id, info] of d?.studentInfo ?? []) {
        if (byStudent.has(id)) continue;
        byStudent.set(id, {
          id,
          name: info.name,
          code: info.code,
          phone: null,
          className: info.className,
          remaining: 0,
          debt: 0,
          kind: "none",
        });
      }
    }
    return [...byStudent.values()].filter(
      (s) => s.remaining < LOW_SESSIONS && (!teacher || d?.classOfStudent.has(s.id)),
    );
  }, [balances.data, d, teacher]);

  const overLimit = lowRows.filter((r) => r.kind !== "low").length;
  const debts = useMemo(() => {
    const all = overdueDebts(balances.data ?? []);
    return teacher ? all.filter((r) => d?.classOfStudent.has(r.studentId)) : all;
  }, [balances.data, teacher, d]);
  const debtTotal = debts.reduce((sum, r) => sum + r.debt, 0);

  const unmarkedSessions = (d?.overdue ?? []).filter(isUnmarked);

  const actionItems: ActionItem[] = [
    {
      key: "gaps",
      label: "Buổi 7 ngày tới chưa có GV",
      hint: "Xếp giáo viên trước khi học viên đến",
      count: gaps.loading ? null : gaps.data?.length ?? 0,
      href: "/admin/timetable",
      icon: ACTION_ICONS.gaps,
      tone: "red",
    },
    {
      key: "requests",
      label: "GV xin nghỉ / đổi buổi",
      hint: "Đơn chờ duyệt",
      count: !canRequests ? undefined : pending.loading ? null : pending.data?.requests ?? 0,
      href: "/admin/requests",
      icon: ACTION_ICONS.requests,
      tone: "red",
    },
    {
      key: "absences",
      label: "Học viên xin nghỉ",
      hint: "Đơn chờ duyệt",
      count: !canMakeup ? undefined : pending.loading ? null : pending.data?.absences ?? 0,
      href: "/admin/makeup",
      icon: ACTION_ICONS.absences,
      tone: "amber",
    },
    {
      key: "makeup",
      label: "Chờ xếp học bù",
      hint: "Lượt bù chưa có buổi",
      count: !canMakeup ? undefined : pending.loading ? null : pending.data?.makeups ?? 0,
      href: "/admin/makeup",
      icon: ACTION_ICONS.makeup,
      tone: "amber",
    },
    {
      key: "unmarked",
      label: "Đã dạy chưa điểm danh",
      hint: `Đã chấm công, ${WINDOW_DAYS} ngày qua`,
      count: dash.loading ? null : d?.unmarked ?? 0,
      // Một buổi → mở thẳng buổi đó để điểm danh; nhiều buổi → cuộn xuống bảng
      // "Buổi học chưa cập nhật" (trang Điểm danh chỉ mở theo ngày hôm nay)
      href:
        unmarkedSessions.length === 1 ? sessionHref(unmarkedSessions[0].id) : `#${OVERDUE_ANCHOR}`,
      icon: ACTION_ICONS.unmarked,
      tone: "red",
    },
    {
      key: "overLimit",
      label: "Hết buổi vẫn đang học",
      hint: "Hết gói hoặc chưa có gói",
      count: !seesMoney ? undefined : balances.loading || dash.loading ? null : overLimit,
      href: "/admin/tuition",
      icon: ACTION_ICONS.overLimit,
      tone: "red",
    },
    {
      key: "leads",
      label: "Khách mới chưa liên hệ",
      hint: `Quá ${LOG_GRACE_HOURS} giờ chưa ai ghi chú`,
      count: !canStudents ? undefined : leads.loading ? null : leads.data?.untouched.length ?? 0,
      href: "/admin/leads",
      icon: ACTION_ICONS.leads,
      tone: "amber",
    },
    {
      key: "supplies",
      label: "Học cụ sắp hết",
      hint: "Dưới mức tồn tối thiểu",
      count: !canSupplies ? undefined : lowStock.loading ? null : lowStock.data ?? 0,
      href: "/admin/supplies",
      icon: ACTION_ICONS.supplies,
      tone: "amber",
    },
  ];

  const todayRows = useMemo(
    () =>
      (todaySessions.data ?? [])
        .filter((s) => !teacher || s.teacher?.id === teacher)
        .slice()
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [todaySessions.data, teacher],
  );

  const lowSort = useSort(
    lowRows,
    {
      name: (r) => r.name,
      className: (r) => r.className,
      remaining: (r) => r.remaining,
      debt: (r) => r.debt,
    },
    ["remaining", 1],
  );
  const isEmpty =
    !stats.loading && stats.data && stats.data.students === 0 && stats.data.activeClasses === 0;

  const careNew = careRows.filter((r) => r.status === "new").length;
  const careLate = careRows.filter((r) => r.overdue).length;
  const dots = (loading: boolean) => (loading ? "…" : null);

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Bảng điều khiển</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Số liệu cập nhật ngay khi giáo viên lưu. Ngưỡng cảnh báo: nghỉ từ {ABSENT_WARN} buổi, thiếu
          bài từ {MISSING_WARN} lần trong {WINDOW_DAYS} ngày, điểm trung bình dưới {SCORE_WARN}, chấm
          công trong {LOG_GRACE_HOURS} giờ.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <BranchSwitcher className="w-full sm:w-56" />
        <div className="relative w-full sm:w-56">
          <UserRound className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />
          <select
            aria-label="Lọc theo giáo viên"
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            className="h-9 w-full appearance-none truncate rounded-lg border bg-card pl-8 pr-8 text-sm font-semibold shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Mọi giáo viên</option>
            {teacherOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Sparkles className="h-4 w-4 text-gold-600" /> Thông điệp hôm nay
        </div>
        <p className="mt-2 text-lg font-bold leading-snug text-gold-600 sm:text-xl">
          &ldquo;{quoteOfToday()}&rdquo;
        </p>
      </Card>

      {isEmpty && <OnboardingChecklist hasClasses={(stats.data?.activeClasses ?? 0) > 0} />}

      {dash.error && <ErrorNote message={dash.error} />}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Chăm sóc đang mở"
          value={dots(care.loading) ?? careRows.length}
          hint={care.error ? "Không tải được" : `${careNew} chưa ai nhận, ${careLate} quá hạn`}
          icon={Phone}
          tone="rose"
        />
        <KpiTile
          label="Buổi học chưa cập nhật"
          value={dots(dash.loading) ?? d?.overdue.length ?? 0}
          hint={`Chưa chấm công quá ${LOG_GRACE_HOURS} giờ, hoặc chưa điểm danh`}
          icon={Clock}
          tone="red"
        />
        <KpiTile
          label="Học viên cần chú ý"
          value={dots(dash.loading) ?? d?.attention.length ?? 0}
          hint="Nghỉ nhiều, kết quả yếu, thiếu bài"
          icon={AlertTriangle}
          tone="amber"
        />
        <KpiTile
          label={`Chuyên cần ${WINDOW_DAYS} ngày`}
          value={dots(dash.loading) ?? (d?.attendanceRate === null || !d ? "—" : `${d.attendanceRate}%`)}
          hint={`${d?.classCount ?? 0} lớp đang học, ${d?.studentCount ?? 0} học viên`}
          icon={CircleCheck}
          tone="brand"
        />
      </section>

      {(seesMoney || canStudents) && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {seesMoney && (
            <KpiTile
              label="Doanh thu tháng này"
              value={revenue.loading ? "…" : fmtVND(revenue.data?.cur ?? 0)}
              hint={
                revenue.data
                  ? revenue.data.prev > 0
                    ? `${revenue.data.cur >= revenue.data.prev ? "▲" : "▼"} ${Math.abs(
                        Math.round(((revenue.data.cur - revenue.data.prev) / revenue.data.prev) * 100),
                      )}% so với cùng kỳ tháng trước (${fmtVND(revenue.data.prev)})`
                    : `Cùng kỳ tháng trước: ${fmtVND(revenue.data.prev)}`
                  : revenue.error ?? ""
              }
              icon={Banknote}
              tone="green"
            />
          )}
          {seesMoney && (
            <KpiTile
              label="Công nợ quá hạn"
              value={balances.loading ? "…" : fmtVND(debtTotal)}
              hint={`${debts.length} gói chưa đóng đủ`}
              icon={AlertTriangle}
              tone="red"
            />
          )}
          {canStudents && (
            <KpiTile
              label="Đăng ký mới tháng này"
              value={leads.loading ? "…" : leads.data?.registeredThisMonth ?? 0}
              hint="Khách tiềm năng chuyển Đã đăng ký"
              icon={UserPlus}
              tone="brand"
            />
          )}
          {canStudents && (
            <KpiTile
              label="Nghỉ học tháng này"
              value={retention.loading ? "…" : retention.data?.leftThisMonth.length ?? 0}
              hint="Xem lý do ở khối Giữ chân học viên"
              icon={LogOut}
              tone="amber"
            />
          )}
        </section>
      )}

      <ActionItems
        items={actionItems}
        gaps={gaps.data ?? []}
        gapsLoading={gaps.loading}
        gapsError={gaps.error}
      />

      {/* Lớp học hôm nay */}
      <Card className="overflow-hidden">
        <SectionHead
          title="Lớp học hôm nay"
          desc={`${weekdayOf(today)} ${dmy(today)}, theo lịch học của lớp. Bấm tình trạng để chấm công hộ giáo viên.`}
          action={
            <Link href="/admin/timetable" className="text-xs font-semibold text-brand-600 hover:underline">
              Thời khóa biểu →
            </Link>
          }
        />
        {todaySessions.error && <ErrorNote message={todaySessions.error} />}
        {todaySessions.loading ? (
          <LoadingRows rows={3} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <Th>Giờ</Th>
                  <Th>Lớp</Th>
                  <Th>Giáo viên</Th>
                  <Th>Tình trạng</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {todayRows.length === 0 ? (
                  <EmptyRow cols={4}>
                    {teacher ? "Giáo viên này hôm nay không có ca dạy nào." : "Hôm nay không có ca dạy nào."}
                  </EmptyRow>
                ) : (
                  todayRows.map((s) => (
                    <tr key={s.id} className="hover:bg-brand-50/40">
                      <td className={cn(TD, "whitespace-nowrap font-semibold")}>
                        {hm(s.start_time)} - {hm(s.end_time)}
                      </td>
                      <td className={TD}>
                        {s.class ? (
                          <Link href={`/admin/classes/${s.class.id}`} className="font-semibold text-brand-600 hover:underline">
                            {s.class.name}
                          </Link>
                        ) : (
                          <span className="font-semibold">Buổi học bù</span>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {s.room?.name ?? "Chưa xếp phòng"}
                          {s.type === "makeup" && s.class ? " · Học bù" : ""}
                        </div>
                      </td>
                      <td className={TD}>{s.teacher?.name ?? "—"}</td>
                      <td className={TD}>
                        {s.status === "cancelled" ? (
                          <Pill tone="muted">Lớp nghỉ</Pill>
                        ) : pickLog(s) ? (
                          <Pill tone="green" onClick={() => setLogFor(s)}>Đã ghi</Pill>
                        ) : (
                          <Pill tone="amber" onClick={() => setLogFor(s)}>Chưa ghi</Pill>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CommentDueCard
        rows={commentRows}
        loading={dash.loading}
        links={ADMIN_LINKS}
        showTeacher={true}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <OverdueCard rows={d?.overdue ?? []} loading={dash.loading} today={today} links={ADMIN_LINKS} />
        <AttentionCard rows={d?.attention ?? []} loading={dash.loading} links={ADMIN_LINKS} />
      </section>

      <CareCard
        rows={careRows}
        loading={care.loading}
        error={care.error}
        links={ADMIN_LINKS}
        careHref="/admin/care"
      />

      {/* Học phí: sắp hết buổi + công nợ quá hạn */}
      {seesMoney && (
        <section className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <SectionHead
            title="Học viên sắp hết buổi"
            desc={`Tổng buổi còn lại dưới ${LOW_SESSIONS}, hết buổi mà vẫn đang học, hoặc đang học chưa có gói — gọi phụ huynh gia hạn.`}
            action={
              <Link
                href="/admin/tuition"
                className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-secondary"
              >
                Mở trang Học phí
              </Link>
            }
          />
          {balances.error && <ErrorNote message={balances.error} />}
          {balances.loading ? (
            <LoadingRows rows={2} />
          ) : (
            <div className={SCROLL_10}>
              <table className="w-full min-w-[520px] text-sm">
                <thead className="sticky top-0 z-10 border-b bg-card">
                  <tr>
                    <Th k="name" {...lowSort}>Học viên</Th>
                    <Th k="className" {...lowSort}>Lớp</Th>
                    <Th k="remaining" {...lowSort} align="right">Buổi còn lại</Th>
                    <Th k="debt" {...lowSort} align="right">Còn nợ</Th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lowSort.sorted.length === 0 ? (
                    <EmptyRow cols={4}>Không có học viên nào sắp hết buổi 🎉</EmptyRow>
                  ) : (
                    lowSort.sorted.map((r) => (
                      <tr key={r.id} className="hover:bg-brand-50/40">
                        <td className={TD}>
                          <Link href={`/admin/students/${r.id}`} className="font-semibold text-brand-600 hover:underline">
                            {r.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {[r.code, r.phone].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </td>
                        <td className={TD}>{r.className}</td>
                        <td className={cn(TD, "whitespace-nowrap text-right")}>
                          {r.kind === "none" ? (
                            <Pill tone="red">Chưa có gói</Pill>
                          ) : r.kind === "over" ? (
                            <Pill tone="red">Hết buổi, vẫn học</Pill>
                          ) : (
                            <Pill tone="amber">{r.remaining} buổi</Pill>
                          )}
                        </td>
                        <td className={cn(TD, "whitespace-nowrap text-right", r.debt > 0 && "font-semibold text-rose-600")}>
                          {r.debt > 0 ? fmtVND(r.debt) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <DebtCard rows={debts} loading={balances.loading} error={balances.error} />
        </section>
      )}

      {/* Kế hoạch lớp + giữ chân học viên */}
      <section className={cn("grid gap-4", canStudents && "lg:grid-cols-2")}>
        <PlanCard
          classes={d?.classes ?? []}
          progress={dash.data?.progressByClass ?? {}}
          loading={dash.loading}
        />
        {canStudents && (
          <RetentionCard data={retention.data} loading={retention.loading} error={retention.error} />
        )}
      </section>

      <TeacherCard
        sessions={d?.sessions ?? []}
        loading={dash.loading}
      />

      <ClassStatsCard
        rows={d?.classRows ?? []}
        loading={dash.loading}
        links={ADMIN_LINKS}
        today={today}
        emptyText={teacher ? "Giáo viên này không phụ trách lớp nào đang học." : "Chưa có lớp nào đang học."}
      />

      <TeachingLogModal
        session={logFor}
        currentUserId={user?.id ?? ""}
        onClose={() => setLogFor(null)}
        onSaved={() => {
          setLogFor(null);
          todaySessions.reload();
          dash.reload();
          gaps.reload();
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
