"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { dbErrorMessage } from "@/lib/db";
import { fetchLessons, fetchSessionLessons, setSessionLessons } from "@/lib/db-content";
import { useLoad } from "@/lib/use-load";

/**
 * Nội dung ôn tập của buổi: chọn bài học để học viên xem lại từ vựng /
 * ngữ pháp / slide sau buổi học. Lớp đã gán giáo trình thì mặc định chỉ
 * hiện bài của giáo trình đó (bật "Tất cả bài học" để chọn ngoài).
 */
export function SessionContentCard({
  sessionId,
  courseId,
  textbook,
  onChange,
}: {
  sessionId: string;
  courseId: string | null;
  textbook: { id: string; name: string } | null;
  /** Báo ngay danh sách bài đang chọn để trang cha cập nhật từ vựng/checklist. */
  onChange?: (lessonIds: string[]) => void;
}) {
  const assigned = useLoad(() => fetchSessionLessons(sessionId), [sessionId]);
  const lessons = useLoad(() => fetchLessons(), []);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (assigned.data && selected === null) {
      const ids = assigned.data.map((sl) => sl.lesson.id);
      setSelected(ids);
      onChange?.(ids);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigned.data, selected]);

  const all = lessons.data ?? [];
  const current = selected ?? [];
  // Lớp có giáo trình: mặc định chỉ bài của giáo trình đó (+ bài đã gán sẵn)
  const visible =
    textbook && !showAll
      ? all.filter((l) => l.textbook_id === textbook.id || current.includes(l.id))
      : all;
  // Bài của giáo trình lớp / khóa của lớp lên trước
  const sorted = [...visible].sort((a, b) => {
    const rank = (l: (typeof all)[number]) =>
      textbook && l.textbook_id === textbook.id ? 0 : l.course_id === courseId ? 1 : 2;
    return rank(a) - rank(b) || (a.unit ?? 0) - (b.unit ?? 0);
  });
  const dirty =
    selected !== null &&
    assigned.data !== null &&
    JSON.stringify([...current].sort()) !==
      JSON.stringify(assigned.data.map((sl) => sl.lesson.id).sort());

  /** Bấm bài nào là lưu luôn bài đó — không bắt giáo viên nhớ bấm nút lưu. */
  function toggle(id: string) {
    setNotice(null);
    const cur = selected ?? [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setSelected(next);
    onChange?.(next);
    void save(next);
  }

  async function save(ids: string[]) {
    setSaving(true);
    setError(null);
    try {
      await setSessionLessons(sessionId, ids);
      assigned.reload();
      setNotice("Đã lưu ✓");
      window.setTimeout(() => setNotice(null), 2000);
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-brand-600" /> Nội dung ôn tập buổi này
          <Badge variant="muted">{current.length} bài</Badge>
        </CardTitle>
        <span className="text-xs font-semibold text-muted-foreground">
          {saving ? "Đang lưu…" : error ? "" : dirty ? "Chưa lưu" : notice ? "Đã lưu ✓" : "Tự lưu khi chọn"}
        </span>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {error && (
          <div className="mb-3 space-y-2">
            <ErrorNote message={error} />
            <Button size="sm" variant="outline" onClick={() => save(selected ?? [])}>
              Thử lưu lại
            </Button>
          </div>
        )}
        {textbook && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Giáo trình của lớp: <span className="font-semibold text-foreground">{textbook.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="font-semibold text-brand-600 hover:underline"
            >
              {showAll ? "← Chỉ hiện bài của giáo trình lớp" : "Hiện tất cả bài học →"}
            </button>
          </div>
        )}
        {assigned.loading || lessons.loading ? (
          <LoadingRows rows={2} className="p-0" />
        ) : sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {all.length === 0
              ? "Chưa có bài học nào trong thư viện — soạn bài ở mục “Bài học” hoặc nhờ admin import giáo trình."
              : "Giáo trình của lớp chưa có bài học nào — bấm “Hiện tất cả bài học” để chọn ngoài giáo trình."}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {sorted.map((l) => {
              const picked = current.includes(l.id);
              const inTextbook = textbook != null && l.textbook_id === textbook.id;
              const inCourse = l.course_id === courseId;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggle(l.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all",
                    picked ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-200" : "hover:border-brand-300",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {l.unit != null ? `Bài ${l.unit}: ` : ""}
                      {l.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {l.textbook?.name ?? l.course?.name ?? "Chưa gắn khóa"} · {l.lesson_vocab[0]?.count ?? 0} từ vựng
                    </div>
                  </div>
                  {inTextbook ? (
                    <Badge variant="gold">GT lớp</Badge>
                  ) : inCourse ? (
                    <Badge variant="gold">Khóa này</Badge>
                  ) : null}
                  {picked && <Badge variant="jade">✓</Badge>}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
