"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, Send, Star, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ErrorNote, LoadingRows } from "@/components/ui/loading";
import { Modal } from "@/components/ui/modal";
import { Field, Select } from "@/components/ui/select";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import { dbErrorMessage, fetchClassStudents, fetchTeacherClasses } from "@/lib/db";
import {
  deleteReview,
  fetchReviews,
  saveReview,
  suggestReview,
  summarizePeriod,
  type ReviewStats,
  type StudentReviewRow,
} from "@/lib/db-reviews";

/** Đầu và cuối tháng hiện tại — kỳ mặc định, cũng là kỳ hay dùng nhất. */
function thisMonth() {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const iso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { from: iso(first), to: iso(last) };
}

function periodLabel(from: string, to: string) {
  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T00:00:00");
  return `${f.toLocaleDateString("vi-VN")} – ${t.toLocaleDateString("vi-VN")}`;
}

export default function TeacherReviewsPage() {
  const { user } = useAuth();
  const teacherId = user?.id ?? "";
  const [{ from, to }, setPeriod] = useState(thisMonth);
  const [classId, setClassId] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const classes = useLoad(
    () => (teacherId ? fetchTeacherClasses(teacherId) : Promise.resolve([])),
    [teacherId],
  );
  useEffect(() => {
    if (!classId && classes.data?.length) setClassId(classes.data[0].id);
  }, [classes.data, classId]);

  const students = useLoad(
    () => (classId ? fetchClassStudents(classId) : Promise.resolve([])),
    [classId],
  );
  const reviews = useLoad(
    () => (classId ? fetchReviews({ classId, from, to }) : Promise.resolve([])),
    [classId, from, to],
  );

  const byStudent = useMemo(() => {
    const map = new Map<string, StudentReviewRow>();
    for (const r of reviews.data ?? []) {
      // Trùng kỳ thì lấy bản mới nhất — danh sách đã sắp theo created_at giảm dần.
      if (!map.has(r.student_id)) map.set(r.student_id, r);
    }
    return map;
  }, [reviews.data]);

  const active = (students.data ?? []).filter((s) => s.status === "active");
  const done = active.filter((s) => byStudent.get(s.student_id)?.published_at).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Nhận xét tổng kết</h1>
        <p className="mt-1 text-muted-foreground">
          Bản tổng kết cả kỳ gửi phụ huynh — khác nhận xét từng buổi. Soạn nháp thoải mái,
          chỉ khi bấm <b>Phát hành</b> thì nhà mới nhận được.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          <Field label="Lớp">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {(classes.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {!classes.data?.length && <option value="">Chưa có lớp nào</option>}
            </Select>
          </Field>
          <Field label="Từ ngày">
            <Input
              type="date"
              value={from}
              onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
            />
          </Field>
          <Field label="Đến ngày">
            <Input
              type="date"
              value={to}
              onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
            />
          </Field>
        </CardContent>
      </Card>

      {(classes.error || students.error || reviews.error) && (
        <ErrorNote message={classes.error ?? students.error ?? reviews.error ?? ""} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Học viên
            <Badge variant="muted" className="ml-2">{done}/{active.length} đã phát hành</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {students.loading || reviews.loading ? (
            <LoadingRows rows={5} className="p-0" />
          ) : !active.length ? (
            <Empty
              icon={FileText}
              title="Lớp chưa có học viên"
              description="Chọn lớp khác hoặc xếp học viên vào lớp trước đã."
            />
          ) : (
            <div className="divide-y">
              {active.map((s) => {
                const r = byStudent.get(s.student_id);
                return (
                  <div key={s.student_id} className="flex flex-wrap items-center gap-3 py-3">
                    <Avatar name={s.student.name} src={s.student.avatar ?? undefined} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.student.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r
                          ? r.published_at
                            ? `Đã phát hành ${new Date(r.published_at).toLocaleDateString("vi-VN")}`
                            : "Bản nháp — chưa gửi phụ huynh"
                          : "Chưa có nhận xét cho kỳ này"}
                      </div>
                    </div>
                    {r?.rating != null && (
                      <span className="flex items-center gap-0.5 text-sm font-bold text-gold-700">
                        <Star className="h-4 w-4 fill-gold-500 text-gold-500" />
                        {r.rating}
                      </span>
                    )}
                    <Badge
                      variant={r?.published_at ? "jade" : r ? "gold" : "muted"}
                    >
                      {r?.published_at ? "Đã phát hành" : r ? "Nháp" : "Chưa viết"}
                    </Badge>
                    <Button
                      size="sm"
                      variant={r ? "outline" : "default"}
                      onClick={() => setEditing({ id: s.student_id, name: s.student.name })}
                    >
                      {r ? "Mở lại" : "Viết"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && teacherId && (
        <ReviewModal
          student={editing}
          classId={classId}
          teacherId={teacherId}
          from={from}
          to={to}
          existing={byStudent.get(editing.id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reviews.reload();
          }}
        />
      )}
    </div>
  );
}

function ReviewModal({
  student,
  classId,
  teacherId,
  from,
  to,
  existing,
  onClose,
  onSaved,
}: {
  student: { id: string; name: string };
  classId: string;
  teacherId: string;
  from: string;
  to: string;
  existing?: StudentReviewRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const published = !!existing?.published_at;
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [title, setTitle] = useState(existing?.title ?? `Tổng kết ${periodLabel(from, to)}`);
  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [strengths, setStrengths] = useState(existing?.strengths ?? "");
  const [improvements, setImprovements] = useState(existing?.improvements ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [busy, setBusy] = useState<"draft" | "publish" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Số liệu kỳ + dàn ý gợi ý — chỉ điền vào ô còn trống, không đè bản GV đã viết. */
  useEffect(() => {
    let cancelled = false;
    summarizePeriod(student.id, from, to)
      .then((s) => {
        if (cancelled) return;
        setStats(s);
        if (existing) return;
        const g = suggestReview(student.name, s);
        setStrengths((v) => v || g.strengths);
        setImprovements((v) => v || g.improvements);
        setContent((v) => v || g.content);
        if (s.avg_rating != null) setRating((v) => v || Math.round(s.avg_rating!));
      })
      .catch((e) => setError(dbErrorMessage(e)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, from, to]);

  async function submit(publish: boolean) {
    if (!title.trim()) {
      setError("Đặt tên cho bản tổng kết (ví dụ: Tổng kết tháng 9).");
      return;
    }
    if (publish && !content.trim() && !strengths.trim()) {
      setError("Viết ít nhất phần nhận xét chung hoặc điểm làm tốt trước khi phát hành.");
      return;
    }
    setBusy(publish ? "publish" : "draft");
    setError(null);
    try {
      await saveReview({
        id: existing?.id,
        student_id: student.id,
        class_id: classId || null,
        teacher_id: teacherId,
        period_start: from,
        period_end: to,
        title: title.trim(),
        rating: rating || null,
        strengths: strengths.trim() || null,
        improvements: improvements.trim() || null,
        content: content.trim() || null,
        stats,
        publish,
      });
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      await deleteReview(existing!.id);
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
      setBusy(null);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Tổng kết — ${student.name}`}>
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}

        {published && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
            Đã phát hành — sửa ở đây là nhà thấy bản mới ngay, nhưng không báo lại lần nữa.
          </div>
        )}

        {/* Số liệu kỳ: GV nhìn số rồi viết lời, khỏi mở lại trang chuyên cần */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border bg-secondary/40 p-3 sm:grid-cols-4">
          {[
            ["Buổi có mặt", stats ? `${stats.present}/${stats.sessions}` : "…"],
            ["Vắng", stats ? String(stats.absent) : "…"],
            ["Sao trong giờ", stats ? `${stats.stars}★` : "…"],
            ["Điểm buổi TB", stats?.avg_rating != null ? `${stats.avg_rating}/5` : "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-base font-bold">{value}</div>
            </div>
          ))}
        </div>

        <Field label="Tên bản tổng kết" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <div>
          <span className="text-sm font-medium">Xếp loại cả kỳ</span>
          <div className="mt-1.5 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n === rating ? 0 : n)}
                className="p-0.5"
                title={`${n} sao`}
              >
                <Star
                  className={cn(
                    "h-7 w-7 transition-colors",
                    n <= rating ? "fill-gold-500 text-gold-500" : "text-muted-foreground/40",
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <Field label="Làm tốt">
          <ReviewTextarea value={strengths} onChange={setStrengths} rows={2} />
        </Field>
        <Field label="Cần cải thiện">
          <ReviewTextarea value={improvements} onChange={setImprovements} rows={2} />
        </Field>
        <Field label="Nhận xét chung & lời dặn" hint="Phụ huynh đọc phần này đầu tiên.">
          <ReviewTextarea value={content} onChange={setContent} rows={4} />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {existing && !published ? (
            <Button variant="ghost" onClick={remove} disabled={busy !== null}>
              <Trash2 className="h-4 w-4" /> Xóa nháp
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => submit(false)} disabled={busy !== null}>
              {busy === "draft" ? "Đang lưu…" : "Lưu nháp"}
            </Button>
            <Button onClick={() => submit(true)} disabled={busy !== null}>
              <Send className="h-4 w-4" />
              {busy === "publish" ? "Đang gửi…" : published ? "Cập nhật" : "Phát hành"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ReviewTextarea({
  value,
  onChange,
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}
