"use client";

/**
 * TRANG XEM CỦA PHỤ HUYNH — /parent/s/<token> (migration 0041).
 *
 * Không đăng nhập, không tài khoản: mở link (hoặc quét QR) → nhập 4 số
 * cuối SĐT đã đăng ký → xem toàn cảnh việc học của con.
 *
 * Bố cục đi theo câu hỏi phụ huynh hỏi, theo đúng thứ tự họ hỏi:
 *   1. Con còn bao nhiêu buổi, đi học đều không → thẻ đầu + 4 ô số liệu;
 *   2. Từng buổi con học cái gì, cô nhận xét sao, được mấy sao →
 *      "Nhật ký buổi học" (phần quan trọng nhất, để ngay dưới);
 *   3. Bài tập / kiểm tra được mấy điểm;
 *   4. Lịch học và học phí đã đóng.
 * Dữ liệu lấy một lần qua /api/parent-portal; trang không giữ phiên nào
 * — đóng tab là phải nhập lại, đúng tinh thần "chỉ để xem".
 */

import { use, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Clock,
  GraduationCap,
  MessageSquareText,
  Phone,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const WEEKDAYS_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

type SessionEntry = {
  date: string;
  start_time: string;
  end_time: string;
  class_name: string | null;
  teacher_name: string | null;
  status: string;
  lessons: { title: string; title_zh: string | null; summary: string | null }[];
  lesson_content: string | null;
  comment: string | null;
  rating: number | null;
  stars: number;
};

type Assignment = {
  title: string;
  kind: string;
  due_at: string | null;
  created_at: string;
  score: number | null;
  status: string;
  submitted_at: string | null;
};

type Review = {
  id: string;
  title: string;
  rating: number | null;
  strengths: string | null;
  improvements: string | null;
  content: string | null;
  stats: Record<string, number | null> | null;
  period_start: string;
  period_end: string;
  teacher_name: string | null;
};

type Portal = {
  student: {
    name: string;
    code: string | null;
    avatar: string | null;
    enrolled_at: string | null;
    study_status: string | null;
    left_at: string | null;
  };
  center: { name: string; phone: string | null } | null;
  viewer: { name: string; relationship: string } | null;
  progress: {
    has_package: boolean;
    total_sessions: number;
    used: number;
    remaining: number;
    packages: { name: string; total_sessions: number }[];
  };
  stats: { attended: number; absent: number; stars: number; avg_score: number | null };
  classes: { name: string; schedules: { weekday: number; start_time: string; end_time: string }[] }[];
  own_schedules: { weekday: number; start_time: string; end_time: string | null }[];
  reviews: Review[];
  sessions: SessionEntry[];
  assignments: Assignment[];
  payments: { amount: number; paid_at: string; receipt_no: string; package_name: string | null }[];
};

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");
const vnDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const weekdayOf = (iso: string) => WEEKDAYS_SHORT[new Date(`${iso.slice(0, 10)}T00:00:00`).getDay()];
const vnMoney = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";

export default function ParentSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [last4, setLast4] = useState("");
  const [data, setData] = useState<Portal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/parent-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, last4 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Không xem được thông tin.");
      setData(json as Portal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xem được thông tin.");
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-lg shadow-brand-900/5">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="text-center text-lg font-bold">Xác minh phụ huynh</h1>
          <p className="mt-1.5 text-center text-sm text-muted-foreground">
            Nhập 4 số cuối số điện thoại phụ huynh để xem tình hình học tập của con.
          </p>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <Input
              id="last4"
              aria-label="4 số cuối điện thoại"
              inputMode="numeric"
              autoFocus
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="h-14 text-center text-2xl font-bold tracking-[0.6em]"
              placeholder="••••"
            />
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
            )}
            <Button type="submit" className="h-11 w-full" disabled={loading || last4.length !== 4}>
              {loading ? "Đang kiểm tra..." : "Xem thông tin"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const { student, center, viewer, progress, stats } = data;
  const pctDone = progress.total_sessions
    ? Math.min(100, Math.round((progress.used / progress.total_sessions) * 100))
    : 0;
  const ended = progress.has_package && progress.remaining <= 0;
  const low = progress.has_package && progress.remaining > 0 && progress.remaining <= 3;
  const attendRate =
    stats.attended + stats.absent > 0
      ? Math.round((stats.attended / (stats.attended + stats.absent)) * 100)
      : null;

  return (
    <div className="min-h-dvh bg-slate-50 pb-12">
      {/* Đầu trang: nền thương hiệu, thẻ học viên đè lên cho gọn màn hình dọc */}
      <header className="bg-gradient-to-br from-brand-700 to-brand-500 px-4 pb-16 pt-7 text-center text-white">
        {center && <p className="text-xs font-medium text-white/70">{center.name}</p>}
        <h1 className="mt-1 text-xl font-bold">
          Xin chào {viewer?.name ? `Anh/Chị ${viewer.name}` : "Anh/Chị"}
        </h1>
        <p className="mt-0.5 text-sm text-white/80">Tình hình học tập của con tại trung tâm</p>
      </header>

      <main className="mx-auto -mt-12 max-w-2xl space-y-4 px-4">
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3.5">
            {student.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={student.avatar} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-xl font-bold text-brand-700">
                {student.name.trim().slice(-1) || "?"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold leading-tight">{student.name}</h2>
                {student.study_status === "left" && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    Đã nghỉ
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {student.code && <>Mã HV {student.code} · </>}
                {student.enrolled_at ? `Nhập học ${vnDate(student.enrolled_at)}` : "Chưa có ngày nhập học"}
              </p>
              {center && <p className="text-xs text-muted-foreground">{center.name}</p>}
            </div>
          </div>

          {progress.has_package ? (
            <div className="mt-4">
              <div className="mb-1.5 flex items-end justify-between text-sm">
                <span className="font-semibold">Tiến độ gói học</span>
                <span className="text-muted-foreground">
                  đã học <b className="text-foreground">{progress.used}</b>/{progress.total_sessions} buổi ·
                  còn <b className="text-brand-700">{progress.remaining}</b>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
                  style={{ width: `${pctDone}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {progress.packages.map((p) => `${p.name} (${p.total_sessions} buổi)`).join(" · ")}
              </p>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-muted-foreground">
              Chưa đăng ký gói buổi nào — liên hệ trung tâm để biết học phí và ưu đãi.
            </p>
          )}
        </section>

        {(ended || low) && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="flex items-start gap-2 text-sm font-bold text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {ended
                ? "Con đã học hết số buổi trong gói rồi ba mẹ ơi! Ba mẹ đăng ký gói tiếp theo để con học liền mạch nhé."
                : `Con chỉ còn ${progress.remaining} buổi — ba mẹ chuẩn bị gia hạn giúp con nhé.`}
            </p>
            {center?.phone && (
              <a
                href={`tel:${center.phone}`}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-3.5 py-2 text-sm font-semibold text-white"
              >
                <Phone className="h-4 w-4" /> Gọi trung tâm {center.phone}
              </a>
            )}
          </section>
        )}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Buổi đã học" value={String(stats.attended)} tone="brand" />
          <Stat
            label="Chuyên cần"
            value={attendRate === null ? "—" : `${attendRate}%`}
            hint={stats.absent ? `${stats.absent} buổi vắng` : "Không vắng buổi nào"}
            tone={attendRate !== null && attendRate < 80 ? "red" : "jade"}
          />
          <Stat label="Sao thưởng" value={String(stats.stars)} icon={<Star className="h-3.5 w-3.5" />} tone="gold" />
          <Stat
            label="Điểm TB bài tập"
            value={stats.avg_score === null ? "—" : String(stats.avg_score)}
            hint={stats.avg_score === null ? "Chưa có điểm" : "thang 10"}
            tone="brand"
          />
        </section>

        <Reviews items={data.reviews ?? []} />

        <SessionJournal sessions={data.sessions} />

        <Assignments items={data.assignments} />

        <Panel icon={<Clock className="h-4 w-4" />} title="Lịch học cố định">
          {data.classes.length === 0 && data.own_schedules.length === 0 ? (
            <Muted text="Chưa có lịch cố định." />
          ) : (
            <ul className="space-y-2.5 text-sm">
              {data.classes.map((c, i) => (
                <li key={`c${i}`} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="font-semibold">{c.name}</p>
                  {c.schedules.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.schedules
                        .map((s) => `${WEEKDAYS[s.weekday]} ${hhmm(s.start_time)}–${hhmm(s.end_time)}`)
                        .join(" · ")}
                    </p>
                  )}
                </li>
              ))}
              {data.own_schedules.map((s, i) => (
                <li key={`o${i}`} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="font-semibold">Ca học riêng</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {WEEKDAYS[s.weekday]} {hhmm(s.start_time)}
                    {s.end_time ? `–${hhmm(s.end_time)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          icon={<GraduationCap className="h-4 w-4" />}
          title="Học phí đã đóng"
          count={data.payments.length}
        >
          {data.payments.length === 0 ? (
            <Muted text="Chưa có thanh toán nào được ghi nhận." />
          ) : (
            <ul className="divide-y text-sm">
              {data.payments.map((p) => (
                <li key={p.receipt_no} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold">{p.package_name ?? "Gói học"}</p>
                    <p className="text-xs text-muted-foreground">
                      {vnDate(p.paid_at)} · biên lai {p.receipt_no}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold text-brand-700">{vnMoney(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Trang xem chỉ đọc dành cho phụ huynh · {center?.name ?? "KAT CLASS"}
          {center?.phone && (
            <>
              {" · "}
              <a href={`tel:${center.phone}`} className="font-semibold text-brand-700">
                {center.phone}
              </a>
            </>
          )}
        </p>
      </main>
    </div>
  );
}

/* ================= Nhật ký từng buổi ================= */

const STATUS_STYLE: Record<string, { label: string; chip: string; dot: string }> = {
  present: { label: "Có mặt", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  makeup: { label: "Học bù", chip: "bg-brand-100 text-brand-700", dot: "bg-brand-500" },
  absent_excused: { label: "Vắng có phép", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  absent_unexcused: { label: "Vắng không phép", chip: "bg-red-100 text-red-700", dot: "bg-red-500" },
};

function SessionJournal({ sessions }: { sessions: SessionEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? sessions : sessions.slice(0, 6);

  return (
    <Panel icon={<CalendarDays className="h-4 w-4" />} title="Nhật ký buổi học" count={sessions.length}>
      {sessions.length === 0 ? (
        <Muted text="Chưa có buổi nào được điểm danh." />
      ) : (
        <>
          <ul className="space-y-3">
            {shown.map((s, i) => {
              const st = STATUS_STYLE[s.status] ?? {
                label: s.status,
                chip: "bg-slate-100 text-slate-700",
                dot: "bg-slate-400",
              };
              return (
                <li key={i} className="rounded-xl border bg-white">
                  <div className="flex items-start gap-3 p-3">
                    <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-slate-50 py-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {weekdayOf(s.date)}
                      </span>
                      <span className="text-base font-bold leading-tight">{s.date.slice(8, 10)}</span>
                      <span className="text-[11px] text-muted-foreground">/{s.date.slice(5, 7)}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.chip}`}>
                          {st.label}
                        </span>
                        {s.stars > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-semibold text-gold-700">
                            <Sparkles className="h-3 w-3" /> +{s.stars} sao
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold">
                        {s.class_name ?? "Buổi học"}
                        <span className="font-normal text-muted-foreground">
                          {" · "}
                          {hhmm(s.start_time)}–{hhmm(s.end_time)}
                        </span>
                      </p>
                      {s.teacher_name && (
                        <p className="text-xs text-muted-foreground">Giáo viên: {s.teacher_name}</p>
                      )}

                      {(s.lessons.length > 0 || s.lesson_content) ? (
                        <div className="mt-2 rounded-lg bg-slate-50 p-2.5">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            <BookOpen className="h-3.5 w-3.5" /> Nội dung học
                          </p>
                          {s.lessons.map((l, k) => (
                            <p key={k} className="mt-1 text-sm">
                              <b>{l.title}</b>
                              {l.title_zh && <span className="font-zh text-muted-foreground"> {l.title_zh}</span>}
                              {l.summary && (
                                <span className="block text-xs text-muted-foreground">{l.summary}</span>
                              )}
                            </p>
                          ))}
                          {s.lesson_content && (
                            <p className="mt-1 whitespace-pre-line text-sm">{s.lesson_content}</p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 rounded-lg border border-dashed p-2.5">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            <BookOpen className="h-3.5 w-3.5" /> Nội dung học
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Giáo viên chưa ghi nội dung buổi này.
                          </p>
                        </div>
                      )}

                      {/* Luôn giữ chỗ khối nhận xét: ẩn hẳn khi cô chưa viết
                          thì phụ huynh tưởng trang không có mục này. */}
                      {s.comment ? (
                        <div className="mt-2 rounded-lg border border-brand-100 bg-brand-50/60 p-2.5">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-700">
                            <MessageSquareText className="h-3.5 w-3.5" /> Nhận xét của giáo viên
                          </p>
                          {s.rating !== null && <Stars value={s.rating} />}
                          <p className="mt-1 whitespace-pre-line text-sm">{s.comment}</p>
                        </div>
                      ) : (
                        <div className="mt-2 rounded-lg border border-dashed p-2.5">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            <MessageSquareText className="h-3.5 w-3.5" /> Nhận xét của giáo viên
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {s.status.startsWith("absent")
                              ? "Con vắng buổi này nên chưa có nhận xét."
                              : "Giáo viên chưa gửi nhận xét cho buổi này."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {sessions.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 w-full rounded-xl border py-2.5 text-sm font-semibold text-brand-700"
            >
              {showAll ? "Thu gọn" : `Xem tất cả ${sessions.length} buổi`}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}

/**
 * Nhận xét tổng kết cả kỳ — để trên nhật ký từng buổi vì phụ huynh mở
 * link thường muốn câu trả lời gọn "kỳ vừa rồi con thế nào" trước, rồi
 * mới soi từng ngày.
 */
function Reviews({ items }: { items: Review[] }) {
  if (!items.length) return null;
  return (
    <Panel icon={<Award className="h-4 w-4" />} title="Nhận xét tổng kết" count={items.length}>
      <div className="space-y-3">
        {items.map((r) => (
          <div key={r.id} className="rounded-xl border border-brand-100 bg-brand-50/50 p-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-bold">{r.title}</span>
              <span className="text-xs text-slate-500">
                {vnDate(r.period_start)} – {vnDate(r.period_end)}
                {r.teacher_name ? ` · ${r.teacher_name}` : ""}
              </span>
            </div>
            {r.rating !== null && <Stars value={r.rating} />}
            {r.content && <p className="mt-2 whitespace-pre-line text-sm">{r.content}</p>}
            {r.strengths && (
              <p className="mt-2 text-sm">
                <b className="text-emerald-700">Con làm tốt:</b> {r.strengths}
              </p>
            )}
            {r.improvements && (
              <p className="mt-1 text-sm">
                <b className="text-amber-700">Cần cải thiện:</b> {r.improvements}
              </p>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="mt-1 flex gap-0.5" aria-label={`${value}/5 sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= value ? "fill-gold-500 text-gold-500" : "text-slate-300"}`}
        />
      ))}
    </span>
  );
}

/* ================= Bài tập & kiểm tra ================= */

function Assignments({ items }: { items: Assignment[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, 6);

  return (
    <Panel icon={<ClipboardCheck className="h-4 w-4" />} title="Bài tập & Kiểm tra" count={items.length}>
      {items.length === 0 ? (
        <Muted text="Chưa có bài tập nào được giao." />
      ) : (
        <>
          <ul className="divide-y">
            {shown.map((a, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        a.kind === "test"
                          ? "bg-gold-100 text-gold-700"
                          : "bg-brand-100 text-brand-700"
                      }`}
                    >
                      {a.kind === "test" ? "Kiểm tra" : "Bài tập"}
                    </span>
                    <p className="text-sm font-semibold">{a.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.status === "missing"
                      ? a.due_at
                        ? `Chưa nộp · hạn ${vnDate(a.due_at)}`
                        : "Chưa nộp"
                      : `Nộp ngày ${vnDate(a.submitted_at ?? a.created_at)}${
                          a.status === "graded" ? " · đã chấm" : " · chờ chấm"
                        }`}
                  </p>
                </div>
                <ScoreChip score={a.score} missing={a.status === "missing"} />
              </li>
            ))}
          </ul>
          {items.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 w-full rounded-xl border py-2.5 text-sm font-semibold text-brand-700"
            >
              {showAll ? "Thu gọn" : `Xem tất cả ${items.length} bài`}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}

function ScoreChip({ score, missing }: { score: number | null; missing: boolean }) {
  if (missing) {
    return (
      <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
        Chưa nộp
      </span>
    );
  }
  if (score === null) {
    return (
      <span className="shrink-0 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-700">
        Chờ chấm
      </span>
    );
  }
  const tone =
    score >= 8 ? "bg-emerald-100 text-emerald-700" : score >= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return (
    <span className={`shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-bold ${tone}`}>
      {score}
      <span className="text-[11px] font-semibold">/10</span>
    </span>
  );
}

/* ================= Mảnh dùng lại ================= */

const STAT_TONE: Record<string, string> = {
  brand: "text-brand-700",
  gold: "text-gold-600",
  jade: "text-emerald-600",
  red: "text-red-600",
};

function Stat({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 flex items-center gap-1 text-xl font-bold ${STAT_TONE[tone]}`}>
        {icon}
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          {icon}
        </span>
        {title}
        {typeof count === "number" && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {count}
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}

function Muted({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
