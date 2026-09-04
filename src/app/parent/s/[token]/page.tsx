"use client";

/**
 * TRANG XEM CỦA PHỤ HUYNH — /parent/s/<token> (migration 0041).
 *
 * Không đăng nhập, không tài khoản: mở link (hoặc quét QR) → nhập 4 số
 * cuối SĐT đã đăng ký → xem tiến độ, lịch học, điểm danh, học phí của
 * con. Dữ liệu lấy một lần qua /api/parent-portal; trang này không giữ
 * phiên nào — đóng tab là phải nhập lại, đúng tinh thần "chỉ để xem".
 */

import { use, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarX2,
  Clock,
  GraduationCap,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

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
    total_sessions: number;
    used: number;
    remaining: number;
    packages: { name: string; total_sessions: number }[];
  };
  classes: { name: string; schedules: { weekday: number; start_time: string; end_time: string }[] }[];
  own_schedules: { weekday: number; start_time: string; end_time: string | null }[];
  attended: { date: string; start_time: string; end_time: string; class_name: string | null; status: string }[];
  absent: { date: string; start_time: string; end_time: string; class_name: string | null; status: string }[];
  payments: { amount: number; paid_at: string; receipt_no: string; package_name: string | null }[];
};

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");
const vnDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
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
      <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">Xác minh phụ huynh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-0">
            <p className="text-sm text-muted-foreground">
              Nhập 4 số cuối của số điện thoại phụ huynh để xem thông tin học viên.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-sm font-semibold" htmlFor="last4">
                4 số cuối điện thoại
              </label>
              <Input
                id="last4"
                inputMode="numeric"
                autoFocus
                maxLength={4}
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="text-center text-lg tracking-[0.4em]"
                placeholder="••••"
              />
              {error && <p className="text-sm font-medium text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || last4.length !== 4}>
                {loading ? "Đang kiểm tra..." : "Xem thông tin"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { student, center, viewer, progress } = data;
  const pctDone = progress.total_sessions
    ? Math.round((progress.used / progress.total_sessions) * 100)
    : 0;
  const ended = progress.remaining <= 0;
  const lowSessions = !ended && progress.remaining <= 3;

  return (
    <div className="min-h-dvh bg-muted/30 pb-10">
      <header className="border-b bg-white px-4 py-5 text-center">
        {center && <p className="text-xs text-muted-foreground">{center.name}</p>}
        <h1 className="text-lg font-bold">
          Xin chào {viewer?.name ? `Anh/Chị ${viewer.name}` : "Anh/Chị"}
        </h1>
        <p className="text-xs text-muted-foreground">
          Phụ huynh học viên: <b className="text-foreground">{student.name}</b>
        </p>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {(ended || lowSessions) && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="flex items-start gap-2 text-sm font-bold text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {ended
                ? "Khóa học đã kết thúc rồi ba mẹ ơi! Ba mẹ đăng ký khóa tiếp theo cho con nhé."
                : `Con chỉ còn ${progress.remaining} buổi — ba mẹ chuẩn bị gia hạn giúp con nhé.`}
            </p>
            <p className="mt-1.5 text-sm text-red-700">
              Còn lại: <b>{progress.remaining} buổi</b>
            </p>
            {center?.phone && (
              <a
                href={`tel:${center.phone}`}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700"
              >
                <Phone className="h-4 w-4" /> Liên hệ trung tâm {center.phone}
              </a>
            )}
          </div>
        )}

        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              {student.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={student.avatar} alt="" className="h-14 w-14 rounded-xl object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-muted" />
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold">{student.name}</h2>
                  {student.study_status === "left" && <Badge variant="destructive">Đã nghỉ</Badge>}
                  {student.code && <Badge variant="muted">{student.code}</Badge>}
                </div>
                {student.enrolled_at && (
                  <p className="text-xs text-muted-foreground">
                    Ngày nhập học: {vnDate(student.enrolled_at)}
                  </p>
                )}
                {center && (
                  <p className="text-xs text-muted-foreground">Trung tâm: {center.name}</p>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-semibold">Tổng tiến độ</span>
                <span className="text-muted-foreground">
                  {progress.used} / {progress.total_sessions} buổi · còn {progress.remaining}
                </span>
              </div>
              <Progress value={pctDone} />
            </div>

            {progress.packages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa đăng ký gói học nào.</p>
            ) : (
              <ul className="text-sm text-muted-foreground">
                {progress.packages.map((p, i) => (
                  <li key={i}>
                    {p.name} · {p.total_sessions} buổi
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Section icon={<Clock className="h-4 w-4" />} title="Lịch học">
          {data.classes.length === 0 && data.own_schedules.length === 0 ? (
            <Empty text="Chưa có lịch cố định." />
          ) : (
            <ul className="space-y-2 text-sm">
              {data.classes.map((c, i) => (
                <li key={`c${i}`}>
                  <span className="font-semibold">{c.name}</span>
                  {c.schedules.length > 0 && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {c.schedules
                        .map((s) => `${WEEKDAYS[s.weekday]} ${hhmm(s.start_time)}–${hhmm(s.end_time)}`)
                        .join(", ")}
                    </span>
                  )}
                </li>
              ))}
              {data.own_schedules.map((s, i) => (
                <li key={`o${i}`} className="text-muted-foreground">
                  Ca riêng · {WEEKDAYS[s.weekday]} {hhmm(s.start_time)}
                  {s.end_time ? `–${hhmm(s.end_time)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          icon={<CalendarDays className="h-4 w-4" />}
          title={`Ngày đã học (${data.attended.length})`}
        >
          {data.attended.length === 0 ? (
            <Empty text="Chưa có buổi điểm danh." />
          ) : (
            <SessionList rows={data.attended} />
          )}
        </Section>

        <Section
          icon={<CalendarX2 className="h-4 w-4" />}
          title={`Ngày vắng (${data.absent.length})`}
        >
          {data.absent.length === 0 ? (
            <Empty text="Không có ngày vắng." />
          ) : (
            <SessionList rows={data.absent} />
          )}
        </Section>

        <Section
          icon={<GraduationCap className="h-4 w-4" />}
          title={`Học phí đã đóng (${data.payments.length})`}
        >
          {data.payments.length === 0 ? (
            <Empty text="Chưa có thanh toán." />
          ) : (
            <ul className="divide-y text-sm">
              {data.payments.map((p) => (
                <li key={p.receipt_no} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{vnMoney(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {vnDate(p.paid_at)} · {p.package_name ?? "Gói học"} · {p.receipt_no}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Trang xem chỉ đọc dành cho phụ huynh · {center?.name ?? "KAT CLASS"}
        </p>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">{children}</CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

const STATUS_LABEL: Record<string, string> = {
  present: "Có mặt",
  makeup: "Học bù",
  absent_excused: "Vắng có phép",
  absent_unexcused: "Vắng không phép",
};

function SessionList({
  rows,
}: {
  rows: { date: string; start_time: string; end_time: string; class_name: string | null; status: string }[];
}) {
  return (
    <ul className="divide-y text-sm">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="font-semibold">{vnDate(r.date)}</p>
            <p className="text-xs text-muted-foreground">
              {hhmm(r.start_time)}–{hhmm(r.end_time)}
              {r.class_name ? ` · ${r.class_name}` : ""}
            </p>
          </div>
          <Badge variant={r.status === "absent_unexcused" ? "destructive" : "muted"}>
            {STATUS_LABEL[r.status] ?? r.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
