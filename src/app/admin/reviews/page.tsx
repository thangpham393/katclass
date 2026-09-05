"use client";

import { useMemo, useState } from "react";
import { Award, MessageSquareText, Search, Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ErrorNote, LoadingRows } from "@/components/ui/loading";
import { Field, Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLoad } from "@/lib/use-load";
import { fetchProfilesByRole } from "@/lib/db";
import {
  fetchReviews,
  fetchSessionComments,
  type SessionCommentAdminRow,
  type StudentReviewRow,
} from "@/lib/db-reviews";

/** Mặc định soi 3 tháng gần nhất — đủ dài để thấy GV nào bỏ bê nhận xét. */
function defaultRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - 2, 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(from), to: iso(to) };
}

const vnDate = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("vi-VN");

export default function AdminReviewsPage() {
  const [tab, setTab] = useState<"reviews" | "comments">("reviews");
  const [{ from, to }, setRange] = useState(defaultRange);
  const [teacherId, setTeacherId] = useState("");
  const [q, setQ] = useState("");

  const teachers = useLoad(() => fetchProfilesByRole("teacher"), []);
  const reviews = useLoad(
    () => fetchReviews({ teacherId: teacherId || null, from, to }),
    [teacherId, from, to],
  );
  const comments = useLoad(
    () => fetchSessionComments({ teacherId: teacherId || null, from, to }),
    [teacherId, from, to],
  );

  const needle = q.trim().toLowerCase();
  const shownReviews = useMemo(
    () =>
      (reviews.data ?? []).filter(
        (r) =>
          !needle ||
          (r.student?.name ?? "").toLowerCase().includes(needle) ||
          (r.teacher?.name ?? "").toLowerCase().includes(needle) ||
          r.title.toLowerCase().includes(needle),
      ),
    [reviews.data, needle],
  );
  const shownComments = useMemo(
    () =>
      (comments.data ?? []).filter(
        (c) =>
          !needle ||
          (c.student?.name ?? "").toLowerCase().includes(needle) ||
          (c.teacher?.name ?? "").toLowerCase().includes(needle) ||
          c.content.toLowerCase().includes(needle),
      ),
    [comments.data, needle],
  );

  /* Ai đang viết, ai không — câu hỏi chính của người quản lý chất lượng. */
  const byTeacher = useMemo(() => {
    const map = new Map<string, { name: string; comments: number; reviews: number }>();
    for (const c of comments.data ?? []) {
      if (!c.teacher) continue;
      const e = map.get(c.teacher.id) ?? { name: c.teacher.name, comments: 0, reviews: 0 };
      e.comments++;
      map.set(c.teacher.id, e);
    }
    for (const r of reviews.data ?? []) {
      if (!r.teacher) continue;
      const e = map.get(r.teacher.id) ?? { name: r.teacher.name, comments: 0, reviews: 0 };
      if (r.published_at) e.reviews++;
      map.set(r.teacher.id, e);
    }
    return [...map.values()].sort((a, b) => b.comments - a.comments);
  }, [comments.data, reviews.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Nhận xét học viên</h1>
        <p className="mt-1 text-muted-foreground">
          Toàn bộ nhận xét giáo viên gửi ra ngoài — từng buổi và tổng kết theo kỳ. Đọc lại
          trước khi phụ huynh phản hồi.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4 sm:p-5">
          <Field label="Giáo viên">
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Tất cả giáo viên</option>
              {(teachers.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Từ ngày">
            <Input type="date" value={from} onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))} />
          </Field>
          <Field label="Đến ngày">
            <Input type="date" value={to} onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))} />
          </Field>
          <Field label="Tìm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Tên học viên, giáo viên, nội dung..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </Field>
        </CardContent>
      </Card>

      {byTeacher.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap gap-2 p-4 sm:p-5">
            {byTeacher.map((t) => (
              <span
                key={t.name}
                className="rounded-lg border bg-secondary/40 px-3 py-1.5 text-sm"
              >
                <b>{t.name}</b>
                <span className="ml-2 text-muted-foreground">
                  {t.comments} nhận xét buổi · {t.reviews} tổng kết
                </span>
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {(
          [
            ["reviews", "Tổng kết theo kỳ", shownReviews.length, Award],
            ["comments", "Nhận xét từng buổi", shownComments.length, MessageSquareText],
          ] as const
        ).map(([key, label, count, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
              tab === key
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-input text-muted-foreground hover:bg-secondary",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            <Badge variant={tab === key ? "outline" : "muted"}>{count}</Badge>
          </button>
        ))}
      </div>

      {(reviews.error || comments.error || teachers.error) && (
        <ErrorNote message={reviews.error ?? comments.error ?? teachers.error ?? ""} />
      )}

      <Card>
        <CardContent className="p-4 sm:p-5">
          {(tab === "reviews" ? reviews.loading : comments.loading) ? (
            <LoadingRows rows={5} className="p-0" />
          ) : tab === "reviews" ? (
            shownReviews.length === 0 ? (
              <Empty
                icon={Award}
                title="Chưa có bản tổng kết nào trong kỳ này"
                description="Giáo viên soạn ở mục “Nhận xét tổng kết” trong khu giáo viên."
              />
            ) : (
              <div className="divide-y">
                {shownReviews.map((r) => (
                  <ReviewRow key={r.id} r={r} />
                ))}
              </div>
            )
          ) : shownComments.length === 0 ? (
            <Empty
              icon={MessageSquareText}
              title="Chưa có nhận xét buổi nào"
              description="Nhận xét được ghi khi giáo viên kết thúc buổi trong lớp học."
            />
          ) : (
            <div className="divide-y">
              {shownComments.map((c) => (
                <CommentRow key={c.id} c={c} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3.5 w-3.5",
            n <= value ? "fill-gold-500 text-gold-500" : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

function ReviewRow({ r }: { r: StudentReviewRow }) {
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Avatar name={r.student?.name ?? "?"} src={r.student?.avatar ?? undefined} size={32} />
        <span className="text-sm font-semibold">{r.student?.name}</span>
        <Badge variant={r.published_at ? "jade" : "gold"}>
          {r.published_at ? "Đã phát hành" : "Nháp"}
        </Badge>
        {r.rating != null && <Stars value={r.rating} />}
        <span className="ml-auto text-xs text-muted-foreground">
          {r.teacher?.name} · {vnDate(r.period_start)} – {vnDate(r.period_end)}
          {r.class ? ` · ${r.class.name}` : ""}
        </span>
      </div>
      <div className="mt-1.5 pl-10">
        <div className="text-sm font-semibold">{r.title}</div>
        {r.content && <p className="mt-1 text-sm text-muted-foreground">{r.content}</p>}
        {r.strengths && <p className="mt-1 text-sm">Làm tốt: {r.strengths}</p>}
        {r.improvements && <p className="mt-0.5 text-sm">Cần cải thiện: {r.improvements}</p>}
      </div>
    </div>
  );
}

function CommentRow({ c }: { c: SessionCommentAdminRow }) {
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Avatar name={c.student?.name ?? "?"} src={c.student?.avatar ?? undefined} size={32} />
        <span className="text-sm font-semibold">{c.student?.name}</span>
        {c.rating != null && <Stars value={c.rating} />}
        <span className="ml-auto text-xs text-muted-foreground">
          {c.teacher?.name} · buổi {c.session ? vnDate(c.session.date) : ""}
          {c.session?.class ? ` · ${c.session.class.name}` : ""}
        </span>
      </div>
      <p className="mt-1 pl-10 text-sm">{c.content}</p>
    </div>
  );
}
