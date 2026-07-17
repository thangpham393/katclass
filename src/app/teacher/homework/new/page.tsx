"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Field } from "@/components/ui/select";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage, fetchTeacherClasses } from "@/lib/db";
import {
  createHomework,
  fetchLessons,
  fetchQuestions,
  questionPreview,
  HOMEWORK_KIND_LABELS,
  QUESTION_TYPE_LABELS,
  type HomeworkKind,
  type QuestionRow,
  type QuestionType,
} from "@/lib/db-content";
import { cn } from "@/lib/utils";

export default function NewHomeworkPage() {
  const router = useRouter();
  const { user } = useAuth();
  const teacherId = user?.id ?? "";

  const classes = useLoad(
    () => (teacherId ? fetchTeacherClasses(teacherId) : Promise.resolve([])),
    [teacherId],
  );
  const lessons = useLoad(() => fetchLessons(), []);

  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [kind, setKind] = useState<HomeworkKind>("homework");
  const [timeLimit, setTimeLimit] = useState("15");
  const [openAt, setOpenAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [typeFilter, setTypeFilter] = useState<QuestionType | "">("");
  const [lessonFilter, setLessonFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questions = useLoad(
    () => fetchQuestions({ type: typeFilter, lessonId: lessonFilter || undefined }),
    [typeFilter, lessonFilter],
  );
  const [onlyClassTextbook, setOnlyClassTextbook] = useState(true);

  const questionById = useMemo(() => {
    const map = new Map<string, QuestionRow>();
    for (const q of questions.data ?? []) map.set(q.id, q);
    return map;
  }, [questions.data]);

  // Giáo trình của lớp đang chọn — mặc định chỉ hiện bài học / câu hỏi thuộc giáo trình đó
  const classTextbook = (classes.data ?? []).find((c) => c.id === classId)?.textbook ?? null;
  const textbookFilterOn = Boolean(classTextbook) && onlyClassTextbook;
  const lessonOptions = (lessons.data ?? []).filter(
    (l) => !textbookFilterOn || l.textbook_id === classTextbook!.id,
  );
  const visibleQuestions = (questions.data ?? []).filter(
    (q) =>
      !textbookFilterOn ||
      lessonFilter !== "" || // đã lọc theo 1 bài cụ thể thì giữ nguyên
      q.lesson?.textbook_id === classTextbook!.id,
  );

  function toggle(id: string) {
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  /** Chọn nguyên bộ câu hỏi đang hiện (giữ câu đã chọn, không trùng). */
  function selectAllVisible() {
    const ids = visibleQuestions.map((q) => q.id);
    setSelected((cur) => [...cur, ...ids.filter((id) => !cur.includes(id))]);
    // Chưa đặt tiêu đề + đang lọc theo 1 bài → tự điền "Luyện tập Bài N"
    if (!title.trim() && lessonFilter) {
      const l = (lessons.data ?? []).find((x) => x.id === lessonFilter);
      if (l) setTitle(`Luyện tập${l.unit != null ? ` Bài ${l.unit}` : ""} — ${l.title}`);
    }
  }

  async function handleSubmit() {
    if (!user) return;
    if (!title.trim()) return setError("Nhập tiêu đề bài tập.");
    if (!classId) return setError("Chọn lớp được giao.");
    if (!selected.length) return setError("Chọn ít nhất 1 câu hỏi.");
    const limit = parseInt(timeLimit, 10);
    if (kind === "test" && (!limit || limit <= 0)) {
      return setError("Nhập thời gian làm bài (phút) cho bài kiểm tra.");
    }
    setSaving(true);
    setError(null);
    try {
      const id = await createHomework({
        class_id: classId,
        title: title.trim(),
        kind,
        time_limit_minutes: kind === "test" ? limit : null,
        open_at: kind === "test" && openAt ? new Date(openAt).toISOString() : null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        question_ids: selected,
        created_by: user.id,
      });
      router.replace(`/teacher/homework/${id}`);
    } catch (e) {
      setError(dbErrorMessage(e));
      setSaving(false);
    }
  }

  const activeClasses = (classes.data ?? []).filter((c) => c.status === "active");

  return (
    <div className="space-y-6">
      <Link
        href="/teacher/homework"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Bài tập
      </Link>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Giao bài tập mới</h1>
        <p className="mt-1 text-muted-foreground">
          Chọn câu hỏi từ ngân hàng — học viên nộp là hệ thống chấm ngay.
        </p>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>1. Thông tin bài tập</CardTitle></CardHeader>
            <CardContent className="space-y-4 p-6 pt-0">
              <Field label="Loại" required>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(HOMEWORK_KIND_LABELS) as HomeworkKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                        kind === k
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {HOMEWORK_KIND_LABELS[k]}
                      <span className="block text-[11px] font-normal">
                        {k === "homework" ? "Làm lại được, không giới hạn giờ" : "Có giờ, chỉ nộp 1 lần"}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Tiêu đề" required>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={kind === "test" ? "Kiểm tra giữa kỳ — Bài 1–5" : "Ôn tập Bài 6 — Từ vựng & ngữ pháp"}
                  autoFocus
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Lớp được giao" required>
                  <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                    <option value="">— Chọn lớp —</option>
                    {activeClasses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={kind === "test" ? "Hạn chót vào làm (không bắt buộc)" : "Hạn nộp (không bắt buộc)"}>
                  <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                </Field>
              </div>
              {kind === "test" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Thời gian làm bài (phút)" required>
                    <Input
                      type="number"
                      min={1}
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Giờ mở đề (không bắt buộc)"
                    hint="Để trống = làm được ngay. Học viên chỉ thấy đề sau khi bấm Bắt đầu."
                  >
                    <Input type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} />
                  </Field>
                </div>
              )}
              {!classes.loading && activeClasses.length === 0 && (
                <p className="text-xs text-gold-700">
                  Bạn chưa phụ trách lớp active nào — liên hệ quản trị để được gán lớp.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Chọn câu hỏi ({selected.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6 pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  className="w-44"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as QuestionType | "")}
                >
                  <option value="">Mọi dạng câu</option>
                  {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                    <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
                  ))}
                </Select>
                <Select className="w-56" value={lessonFilter} onChange={(e) => setLessonFilter(e.target.value)}>
                  <option value="">Mọi bài học</option>
                  {lessonOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.textbook ? `${l.textbook.name} — ` : ""}
                      {l.unit != null ? `Bài ${l.unit}: ` : ""}{l.title}
                    </option>
                  ))}
                </Select>
                {classTextbook && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={onlyClassTextbook}
                      onChange={(e) => setOnlyClassTextbook(e.target.checked)}
                      className="h-3.5 w-3.5 accent-brand-600"
                    />
                    Chỉ giáo trình của lớp ({classTextbook.name})
                  </label>
                )}
              </div>

              {/* Chọn nguyên bộ: lấy toàn bộ câu hỏi đang hiện (vd. cả bộ luyện tập của 1 bài) */}
              {!questions.loading && visibleQuestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={selectAllVisible}>
                    <Plus className="h-3.5 w-3.5" />
                    Chọn cả bộ ({visibleQuestions.length} câu{lessonFilter ? " của bài này" : ""})
                  </Button>
                  {selected.length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setSelected([])}>
                      Bỏ chọn tất cả
                    </Button>
                  )}
                  {lessonFilter && (
                    <span className="text-xs text-muted-foreground">
                      Chọn bài học rồi bấm “Chọn cả bộ” — khỏi tích tay từng câu.
                    </span>
                  )}
                </div>
              )}

              {questions.loading ? (
                <LoadingRows rows={4} className="p-0" />
              ) : visibleQuestions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {textbookFilterOn && (questions.data?.length ?? 0) > 0 ? (
                    <>Giáo trình của lớp chưa có câu hỏi phù hợp — bỏ chọn “Chỉ giáo trình của lớp” để xem tất cả.</>
                  ) : (
                    <>
                      Không có câu hỏi phù hợp —{" "}
                      <Link href="/teacher/questions" className="font-semibold text-brand-600 hover:underline">
                        tạo ở Ngân hàng câu hỏi
                      </Link>
                      .
                    </>
                  )}
                </div>
              ) : (
                <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                  {visibleQuestions.map((q) => {
                    const picked = selected.includes(q.id);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => toggle(q.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-left transition-all",
                          picked ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-200" : "hover:border-brand-300",
                        )}
                      >
                        <Badge variant="outline" className="w-24 shrink-0 justify-center text-[10px]">
                          {QUESTION_TYPE_LABELS[q.type]}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="zh truncate text-sm">{questionPreview(q) || "(chưa có đề bài)"}</div>
                          {q.lesson && (
                            <div className="truncate text-xs text-muted-foreground">
                              {q.lesson.unit != null ? `Bài ${q.lesson.unit}: ` : ""}{q.lesson.title}
                            </div>
                          )}
                        </div>
                        {picked && (
                          <Badge variant="jade">#{selected.indexOf(q.id) + 1}</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <Card>
            <CardHeader><CardTitle className="text-base">Tóm tắt</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-6 pt-0 text-sm">
              <SummaryRow label="Loại" value={HOMEWORK_KIND_LABELS[kind]} />
              <SummaryRow label="Lớp" value={activeClasses.find((c) => c.id === classId)?.name ?? "—"} />
              <SummaryRow label="Số câu hỏi" value={selected.length || "—"} />
              {kind === "test" && (
                <>
                  <SummaryRow label="Thời gian làm" value={timeLimit ? `${timeLimit} phút` : "—"} />
                  <SummaryRow
                    label="Mở đề"
                    value={openAt ? new Date(openAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Ngay khi giao"}
                  />
                </>
              )}
              <SummaryRow
                label={kind === "test" ? "Hạn chót vào làm" : "Hạn nộp"}
                value={dueAt ? new Date(dueAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Không đặt"}
              />
              <SummaryRow label="Chấm điểm" value="Tự động (thang 10)" />
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" disabled={saving} onClick={handleSubmit}>
            <Send className="h-4 w-4" />
            {saving ? "Đang giao..." : kind === "test" ? "Giao bài kiểm tra" : "Giao bài tập"}
          </Button>
          <Link href="/teacher/questions" className="block">
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4" /> Tạo thêm câu hỏi
            </Button>
          </Link>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
