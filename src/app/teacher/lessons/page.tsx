"use client";

import { useEffect, useState } from "react";
import { BookOpen, Layers, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage, fetchCourses, LEVEL_LABELS } from "@/lib/db";
import {
  createLesson,
  deleteLesson,
  fetchLesson,
  fetchLessons,
  fetchVocabItems,
  lessonSourceLabel,
  setLessonVocab,
  updateLesson,
  type LessonInput,
  type LessonRow,
} from "@/lib/db-content";
import { fetchTextbooks } from "@/lib/db-library";
import { cn } from "@/lib/utils";

export default function TeacherLessonsPage() {
  const lessons = useLoad(() => fetchLessons(), []);
  const courses = useLoad(fetchCourses);
  const textbooks = useLoad(fetchTextbooks);
  const [courseFilter, setCourseFilter] = useState("");
  const [textbookFilter, setTextbookFilter] = useState("");
  const [editing, setEditing] = useState<LessonRow | "new" | null>(null);
  const [pickingVocab, setPickingVocab] = useState<LessonRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = (lessons.data ?? []).filter(
    (l) =>
      (!courseFilter || l.course_id === courseFilter) &&
      (!textbookFilter || l.textbook_id === textbookFilter),
  );

  async function handleDelete(l: LessonRow) {
    if (!confirm(
      `Xóa bài học "${l.title}"?\nBài sẽ bị gỡ khỏi các buổi học đã gán và câu hỏi gắn bài sẽ mất liên kết.`,
    )) return;
    setError(null);
    try {
      await deleteLesson(l.id);
      lessons.reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Bài học</h1>
          <p className="mt-1 text-muted-foreground">
            Soạn nội dung theo khóa học: từ vựng, ngữ pháp, slide — rồi gán vào buổi học để học viên ôn tập.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Soạn bài mới
        </Button>
      </div>

      {error && <ErrorNote message={error} />}
      {lessons.error && <ErrorNote message={lessons.error} />}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-medium text-muted-foreground">Giáo trình:</span>
          <Select className="w-64" value={textbookFilter} onChange={(e) => setTextbookFilter(e.target.value)}>
            <option value="">Tất cả</option>
            {(textbooks.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
          <span className="text-sm font-medium text-muted-foreground">Khóa học:</span>
          <Select className="w-64" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="">Tất cả</option>
            {(courses.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {lessons.loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : list.length === 0 ? (
        <Empty
          icon={BookOpen}
          title="Chưa có bài học nào"
          description="Bấm “Soạn bài mới” — nhập tiêu đề, ngữ pháp, link slide rồi gắn từ vựng."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((l) => (
            <Card key={l.id} className="card-hover flex flex-col">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {l.unit != null && <Badge variant="outline">Bài {l.unit}</Badge>}
                    {l.textbook && <Badge variant="gold">Thư viện</Badge>}
                    {(l.textbook?.level ?? l.course?.level) && (
                      <Badge variant="muted">
                        {LEVEL_LABELS[(l.textbook?.level ?? l.course?.level)!] ?? (l.textbook?.level ?? l.course?.level)}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString("vi-VN")}
                  </span>
                </div>
                {l.title_zh && <div className="zh mt-3 text-3xl font-bold text-brand-700">{l.title_zh}</div>}
                <div className="mt-1 font-semibold">{l.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {lessonSourceLabel(l) ?? "Chưa gắn khóa học"}
                </div>
                {l.summary && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{l.summary}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3 w-3" /> {l.lesson_vocab[0]?.count ?? 0} từ vựng
                  </span>
                  {l.slide_embed_url && <span>· Có slide</span>}
                  {l.grammar && <span>· Có ngữ pháp</span>}
                </div>
                <div className="mt-4 flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(l)}>
                    <Pencil className="h-3.5 w-3.5" /> Sửa
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setPickingVocab(l)}>
                    <Layers className="h-3.5 w-3.5" /> Từ vựng
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={() => handleDelete(l)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <LessonModal
          lesson={editing === "new" ? null : editing}
          courses={courses.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            lessons.reload();
          }}
        />
      )}

      {pickingVocab && (
        <LessonVocabModal
          lesson={pickingVocab}
          onClose={() => setPickingVocab(null)}
          onSaved={() => {
            setPickingVocab(null);
            lessons.reload();
          }}
        />
      )}
    </div>
  );
}

/* ================= Soạn / sửa bài học ================= */

function LessonModal({
  lesson,
  courses,
  onClose,
  onSaved,
}: {
  lesson: LessonRow | null;
  courses: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [courseId, setCourseId] = useState(lesson?.course_id ?? "");
  const [unit, setUnit] = useState(lesson?.unit != null ? String(lesson.unit) : "");
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [titleZh, setTitleZh] = useState(lesson?.title_zh ?? "");
  const [summary, setSummary] = useState(lesson?.summary ?? "");
  const [grammar, setGrammar] = useState(lesson?.grammar ?? "");
  const [slideUrl, setSlideUrl] = useState(lesson?.slide_embed_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    const input: LessonInput = {
      course_id: courseId || null,
      unit: unit.trim() ? Number(unit) : null,
      title: title.trim(),
      title_zh: titleZh.trim() || null,
      summary: summary.trim() || null,
      grammar: grammar.trim() || null,
      slide_embed_url: slideUrl.trim() || null,
    };
    try {
      if (lesson) await updateLesson(lesson.id, input);
      else await createLesson(input, user.id);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={lesson ? `Sửa bài học — ${lesson.title}` : "Soạn bài học mới"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
          <Field label="Khóa học">
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">— Chưa gắn —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Bài số">
            <Input type="number" min={0} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="1" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tiêu đề" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chào hỏi & giới thiệu" required autoFocus />
          </Field>
          <Field label="Tiêu đề tiếng Trung">
            <Input value={titleZh} onChange={(e) => setTitleZh(e.target.value)} placeholder="问候" className="zh" />
          </Field>
        </div>
        <Field label="Tóm tắt bài học">
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="Bài này học cách chào hỏi, tự giới thiệu tên và tuổi..." />
        </Field>
        <Field label="Ngữ pháp & ghi chú" hint="Nội dung hiển thị nguyên văn cho học viên (xuống dòng được giữ nguyên).">
          <Textarea value={grammar} onChange={(e) => setGrammar(e.target.value)} rows={5} placeholder={"Cấu trúc: Chủ ngữ + 喜欢 + Động từ\nVí dụ: 我喜欢学习中文。→ Tôi thích học tiếng Trung."} />
        </Field>
        <Field label="Link nhúng slide (Google Slides / Canva)" hint="Dán link embed — học viên xem slide ngay trong bài học.">
          <Input value={slideUrl} onChange={(e) => setSlideUrl(e.target.value)} placeholder="https://docs.google.com/presentation/d/..." />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : lesson ? "Lưu thay đổi" : "Tạo bài học"}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ================= Gắn từ vựng cho bài học ================= */

function LessonVocabModal({
  lesson,
  onClose,
  onSaved,
}: {
  lesson: LessonRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [q, setQ] = useState("");
  const vocab = useLoad(() => fetchVocabItems(q), [q]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nạp danh sách từ đang gắn với bài (một lần)
  useEffect(() => {
    fetchLesson(lesson.id)
      .then((detail) => {
        setSelected(detail?.vocab.map((v) => v.id) ?? []);
        setLoaded(true);
      })
      .catch((e) => setError(dbErrorMessage(e)));
  }, [lesson.id]);

  function toggle(id: string) {
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await setLessonVocab(lesson.id, selected);
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Từ vựng — ${lesson.title} (${selected.length} từ)`}>
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm trong kho từ vựng..."
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {vocab.loading || !loaded ? (
            <LoadingRows rows={4} className="p-0" />
          ) : (vocab.data?.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {q ? "Không tìm thấy từ phù hợp." : "Kho từ vựng trống — thêm từ ở trang Kho từ vựng trước."}
            </div>
          ) : (
            vocab.data!.map((v) => {
              const picked = selected.includes(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggle(v.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-left transition-all",
                    picked ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-200" : "hover:border-brand-300",
                  )}
                >
                  <div className="zh w-14 shrink-0 text-xl font-bold text-brand-700">{v.hanzi}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium">{v.pinyin}</div>
                    <div className="truncate text-xs text-muted-foreground">{v.meaning}</div>
                  </div>
                  {picked && <Badge variant="jade">✓</Badge>}
                </button>
              );
            })
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving || !loaded}>
            {saving ? "Đang lưu..." : `Lưu ${selected.length} từ`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
