"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Field } from "@/components/ui/select";
import { ErrorNote } from "@/components/ui/loading";
import { HomeworkQuestionPicker } from "@/components/homework-question-picker";
import type { TextbookLessonRow } from "@/lib/db-library";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage, fetchClasses, fetchTeacherClasses } from "@/lib/db";
import {
  createHomework,
  HOMEWORK_KIND_LABELS,
  MANUAL_HOMEWORK_OPTIONS,
  type HomeworkKind,
  type QuestionRow,
} from "@/lib/db-content";
import { fetchTestTemplates } from "@/lib/db-tests";
import { cn } from "@/lib/utils";

export default function NewHomeworkPage() {
  const router = useRouter();
  const { user } = useAuth();
  const teacherId = user?.id ?? "";
  const templates = useLoad(fetchTestTemplates);
  const [templateId, setTemplateId] = useState("");

  const classes = useLoad(
    () => (teacherId ? (user?.role === "admin" ? fetchClasses() : fetchTeacherClasses(teacherId)) : Promise.resolve([])),
    [teacherId, user?.role],
  );

  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [kind, setKind] = useState<HomeworkKind>("homework");
  const [timeLimit, setTimeLimit] = useState("15");
  const [openAt, setOpenAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [textbookId, setTextbookId] = useState("");
  const [lessonFilter, setLessonFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [manualTasks, setManualTasks] = useState<string[]>([]);
  const [teacherNote, setTeacherNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [choosingPack, setChoosingPack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("test");
    if (id) { setTemplateId(id); setKind("test"); }
    const params = new URLSearchParams(window.location.search);
    setTextbookId(params.get("textbook") ?? "");
    setLessonFilter(params.get("lesson") ?? "");
  }, []);
  useEffect(() => {
    if (kind !== "test") return;
    const template = templates.data?.find(t => t.id === templateId);
    setSelected(template?.question_ids ?? []);
    if (template) { setTitle(template.title); setTimeLimit(String(template.time_limit_minutes)); }
  }, [templateId, templates.data, kind]);
  function addQuestions(rows: QuestionRow[], lesson: TextbookLessonRow) {
    setSelected(current => [...new Set([...current, ...rows.map(q => q.id)])]);
    setTitle(current => current.trim() ? current : `Luyện tập${lesson.unit != null ? ` Bài ${lesson.unit}` : ""} — ${lesson.title}`);
  }

  function removeQuestions(ids: string[]) {
    const removed = new Set(ids);
    setSelected(current => current.filter(id => !removed.has(id)));
  }

  function changeClass(id: string) {
    setClassId(id);
    const textbook = classes.data?.find(c => c.id === id)?.textbook;
    if (textbook && textbook.id !== textbookId) {
      setTextbookId(textbook.id);
      setLessonFilter("");
    }
  }

  async function handleSubmit() {
    if (!user || choosingPack || saving) return;
    if (!title.trim()) return setError("Nhập tiêu đề bài tập.");
    if (!classId) return setError("Chọn lớp được giao.");
    if (kind === "test" && !templateId) return setError("Chọn đề kiểm tra từ thư viện.");
    if (kind === "test" && !selected.length) return setError("Bài kiểm tra cần có ít nhất 1 câu hỏi trên hệ thống.");
    if (!selected.length && !manualTasks.length && !teacherNote.trim()) {
      return setError("Chọn câu hỏi trên hệ thống hoặc thêm nội dung giao thủ công.");
    }
    const limit = parseInt(timeLimit, 10);
    if (kind === "test" && (!limit || limit <= 0)) {
      return setError("Nhập thời gian làm bài (phút) cho bài kiểm tra.");
    }
    setSaving(true);
    setError(null);
    try {
      const id = await createHomework({
        template_id: kind === "test" ? templateId : null,
        class_id: classId,
        title: title.trim(),
        kind,
        time_limit_minutes: kind === "test" ? limit : null,
        open_at: kind === "test" && openAt ? new Date(openAt).toISOString() : null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        question_ids: selected,
        manual_tasks: kind === "test" ? [] : manualTasks,
        teacher_note: kind === "test" ? "" : teacherNote.trim(),
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
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Giao bài tập mới</h1>
        <p className="mt-1 text-muted-foreground">
          Chọn giáo trình và bộ đề theo bài học — học viên nộp là hệ thống chấm ngay.
        </p>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>1. Thông tin bài tập</CardTitle></CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
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
                  <Select value={classId} onChange={(e) => changeClass(e.target.value)}>
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

          {kind === "test" && <Card><CardHeader><CardTitle>2. Chọn bài kiểm tra từ thư viện</CardTitle></CardHeader><CardContent className="space-y-3 p-5">
            {templates.error && <ErrorNote message={templates.error} />}
            <Select value={templateId} onChange={e => setTemplateId(e.target.value)}><option value="">— Chọn đề kiểm tra —</option>{(templates.data ?? []).map(t => <option key={t.id} value={t.id}>{t.title} · {t.time_limit_minutes} phút</option>)}</Select>
            <Link href="/library/tests" className="text-sm font-semibold text-brand-600">Mở thư viện để tạo hoặc sửa đề →</Link>
            <p className="text-sm text-muted-foreground">Đã chọn {selected.length} câu / phần trong đề.</p>
          </CardContent></Card>}
          {kind === "homework" && <Card>
            <CardHeader>
              <CardTitle>2. Bài tập trên hệ thống ({selected.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
              <HomeworkQuestionPicker
                textbookId={textbookId}
                lessonId={lessonFilter}
                selected={selected}
                onBrowse={(textbook, lesson) => {
                  setTextbookId(textbook);
                  setLessonFilter(lesson);
                }}
                onAdd={addQuestions}
                onRemove={removeQuestions}
                onBusyChange={setChoosingPack}
              />
            </CardContent>
          </Card>}

          {kind === "homework" && <Card>
            <CardHeader>
              <CardTitle>3. Bài tập thủ công</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
              <p className="text-sm text-muted-foreground">
                Chọn các phần học viên cần làm ngoài hệ thống và ghi thêm dặn dò nếu cần.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {MANUAL_HOMEWORK_OPTIONS.map((task) => {
                  const checked = manualTasks.includes(task);
                  return (
                    <label key={task} className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-medium transition-colors",
                      checked ? "border-brand-500 bg-brand-50/60" : "hover:bg-secondary/60",
                    )}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setManualTasks((current) =>
                          checked ? current.filter((item) => item !== task) : [...current, task],
                        )}
                        className="h-4 w-4 accent-brand-600"
                      />
                      {task}
                    </label>
                  );
                })}
              </div>
              <Field label="Dặn dò hoặc bài tập khác" hint="Không bắt buộc">
                <textarea
                  value={teacherNote}
                  onChange={(e) => setTeacherNote(e.target.value)}
                  rows={4}
                  placeholder="Ví dụ: Ôn lại từ vựng bài 6, viết mỗi từ 3 lần…"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand-500"
                />
              </Field>
            </CardContent>
          </Card>}
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <Card>
            <CardHeader><CardTitle className="text-base">Tóm tắt</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 sm:p-6 sm:pt-0 text-sm">
              <SummaryRow label="Loại" value={HOMEWORK_KIND_LABELS[kind]} />
              <SummaryRow label="Lớp" value={activeClasses.find((c) => c.id === classId)?.name ?? "—"} />
              <SummaryRow label="Số câu hỏi" value={selected.length || "—"} />
              <SummaryRow label="Bài thủ công" value={manualTasks.length + (teacherNote.trim() ? 1 : 0) || "—"} />
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

          <Button className="w-full" size="lg" disabled={saving || choosingPack} onClick={handleSubmit}>
            <Send className="h-4 w-4" />
            {saving ? "Đang giao..." : kind === "test" ? "Giao bài kiểm tra" : "Giao bài tập"}
          </Button>
          <Link href="/library/questions" className="block">
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
