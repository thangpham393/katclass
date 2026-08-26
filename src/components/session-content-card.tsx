"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { dbErrorMessage } from "@/lib/db";
import { fetchLessons, fetchSessionLessons, setSessionLessons, type LessonRow } from "@/lib/db-content";
import { useLoad } from "@/lib/use-load";

/** Bài chưa gắn giáo trình nào gom chung một nhóm. */
const NO_TEXTBOOK = "none";
/** Số bài hiện tối đa trước khi bấm "Xem thêm" (chỉ chạm tới khi xem "Tất cả"). */
const PAGE = 30;

const groupKey = (l: LessonRow) => l.textbook_id ?? NO_TEXTBOOK;

/**
 * Nội dung ôn tập của buổi: chọn bài học để học viên xem lại từ vựng /
 * ngữ pháp / slide sau buổi học.
 *
 * Thư viện có hàng trăm bài nên KHÔNG đổ hết ra: lọc theo từng giáo trình
 * (mặc định là giáo trình của lớp, lớp chưa gắn thì lấy giáo trình đầu
 * danh sách) kèm ô tìm bài chạy trên toàn thư viện.
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
  const [tab, setTab] = useState<string | null>(null); // null = chưa chọn → lấy mặc định
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
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

  const all = useMemo(() => lessons.data ?? [], [lessons.data]);
  const current = selected ?? [];

  // Danh sách giáo trình rút từ chính các bài học (giáo trình của lớp lên đầu)
  const groups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const l of all) {
      const id = groupKey(l);
      const g = map.get(id) ?? {
        id,
        name: l.textbook?.name ?? (id === NO_TEXTBOOK ? "Chưa gắn giáo trình" : "Giáo trình"),
        count: 0,
      };
      g.count += 1;
      map.set(id, g);
    }
    return [...map.values()].sort((a, b) => {
      if (textbook) {
        if (a.id === textbook.id) return -1;
        if (b.id === textbook.id) return 1;
      }
      if (a.id === NO_TEXTBOOK) return 1;
      if (b.id === NO_TEXTBOOK) return -1;
      return a.name.localeCompare(b.name, "vi");
    });
  }, [all, textbook]);

  // Tab đang xem: lựa chọn của người dùng → giáo trình lớp → giáo trình đầu tiên
  const activeTab =
    tab ??
    (textbook && groups.some((g) => g.id === textbook.id) ? textbook.id : groups[0]?.id ?? "all");
  const search = q.trim().toLowerCase();

  // Có tìm kiếm thì chạy trên cả thư viện (bỏ qua tab) cho khỏi phải đoán bài nằm ở giáo trình nào
  const shown = useMemo(() => {
    const list = search
      ? all.filter((l) =>
          `bài ${l.unit ?? ""} ${l.title} ${l.title_zh ?? ""} ${l.textbook?.name ?? l.course?.name ?? ""}`
            .toLowerCase()
            .includes(search),
        )
      : all.filter((l) => activeTab === "all" || groupKey(l) === activeTab);
    return [...list].sort(
      (a, b) =>
        (a.textbook?.name ?? "").localeCompare(b.textbook?.name ?? "", "vi") ||
        (a.unit ?? 0) - (b.unit ?? 0) ||
        a.title.localeCompare(b.title, "vi"),
    );
  }, [all, activeTab, search]);

  const visible = shown.slice(0, limit);
  // Bài đã chọn nhưng nằm ngoài bộ lọc hiện tại → vẫn cho bỏ chọn nhanh
  const offscreen = current
    .filter((id) => !visible.some((l) => l.id === id))
    .map((id) => all.find((l) => l.id === id))
    .filter((l): l is LessonRow => !!l);

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
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-brand-600" /> Nội dung ôn tập buổi này
          <Badge variant="muted">{current.length} bài</Badge>
        </CardTitle>
        <span className="text-xs font-semibold text-muted-foreground">
          {saving ? "Đang lưu…" : error ? "" : dirty ? "Chưa lưu" : notice ? "Đã lưu ✓" : "Tự lưu khi chọn"}
        </span>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {error && (
          <div className="mb-3 space-y-2">
            <ErrorNote message={error} />
            <Button size="sm" variant="outline" onClick={() => save(selected ?? [])}>
              Thử lưu lại
            </Button>
          </div>
        )}

        {assigned.loading || lessons.loading ? (
          <LoadingRows rows={2} className="p-0" />
        ) : all.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Chưa có bài học nào trong thư viện — soạn bài ở mục “Bài học” hoặc nhờ admin import giáo trình.
          </div>
        ) : (
          <>
            {/* Lọc theo giáo trình + tìm bài */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-72">
                <Select
                  value={activeTab}
                  onChange={(e) => {
                    setTab(e.target.value);
                    setLimit(PAGE);
                  }}
                  className="h-9 text-sm"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {textbook?.id === g.id ? " (giáo trình của lớp)" : ""} — {g.count} bài
                    </option>
                  ))}
                  {groups.length > 1 && (
                    <option value="all">Tất cả giáo trình — {all.length} bài</option>
                  )}
                </Select>
              </div>
              <div className="relative w-full flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setLimit(PAGE);
                  }}
                  placeholder="Tìm bài trong cả thư viện…"
                  className="h-9 pl-8 text-sm"
                />
              </div>
              {search && (
                <span className="text-xs text-muted-foreground">
                  Đang tìm trong cả thư viện · {shown.length} bài
                </span>
              )}
            </div>

            {/* Bài đã chọn nhưng không nằm trong bộ lọc đang xem */}
            {offscreen.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/50 p-2">
                <span className="text-xs font-semibold text-brand-700">Đã chọn ở giáo trình khác:</span>
                {offscreen.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggle(l.id)}
                    title="Bỏ chọn bài này"
                    className="inline-flex items-center gap-1 rounded-full border border-brand-300 bg-card px-2 py-0.5 text-xs font-medium hover:border-destructive hover:text-destructive"
                  >
                    {l.unit != null ? `Bài ${l.unit}: ` : ""}
                    {l.title}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}

            {shown.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {search
                  ? `Không tìm thấy bài nào khớp “${q.trim()}”.`
                  : "Giáo trình này chưa có bài học nào — chọn giáo trình khác ở trên."}
              </div>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {visible.map((l) => {
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
                            {l.textbook?.name ?? l.course?.name ?? "Chưa gắn khóa"} ·{" "}
                            {l.lesson_vocab[0]?.count ?? 0} từ vựng
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
                {shown.length > visible.length && (
                  <div className="mt-3 text-center">
                    <Button variant="outline" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
                      Xem thêm ({shown.length - visible.length} bài)
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
