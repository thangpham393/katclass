"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookMarked, BookOpen, GraduationCap, Library, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage, LEVEL_LABELS } from "@/lib/db";
import {
  SERIES_DESCRIPTIONS,
  SERIES_LABELS,
  TextbookCover,
  textbookSeries,
  type TextbookSeries,
} from "@/components/library/textbook-cover";
import {
  deleteTextbook,
  fetchTextbooks,
  importTextbook,
  type TextbookImportPayload,
  type TextbookImportResult,
  type TextbookRow,
} from "@/lib/db-library";

/** Thứ tự các mục trên trang + icon của mục. */
const SERIES_ORDER: TextbookSeries[] = ["HSK30", "HSK", "YCT", "OTHER"];
const SERIES_ICONS: Record<TextbookSeries, typeof BookOpen> = {
  HSK30: BookMarked,
  HSK: GraduationCap,
  YCT: Sparkles,
  OTHER: Library,
};

export default function TextbookLibraryPage() {
  const { user, can } = useAuth();
  // Xem chung kho, nhưng nhập / xóa giáo trình theo quyền được bật.
  const canManage = can("textbooks.manage");
  const textbooks = useLoad(fetchTextbooks);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<TextbookImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  /** Lọc theo ô tìm kiếm rồi chia thành các mục HSK / YCT / khác. */
  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (textbooks.data ?? []).filter((tb) =>
      !needle ||
      [tb.name, tb.name_zh, tb.code, tb.level, tb.description]
        .some((v) => v?.toLowerCase().includes(needle)),
    );
    return SERIES_ORDER.map((series) => ({
      series,
      items: list.filter((tb) => textbookSeries(tb) === series),
    })).filter((s) => s.items.length > 0);
  }, [textbooks.data, q]);

  async function handleFile(file: File) {
    if (!user) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      let payload: TextbookImportPayload;
      try {
        payload = JSON.parse(await file.text());
      } catch {
        throw new Error("File không phải JSON hợp lệ.");
      }
      const r = await importTextbook(payload, user.id, setProgress);
      setResult(r);
      textbooks.reload();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : dbErrorMessage(e));
    } finally {
      setImporting(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(tb: TextbookRow) {
    const lessonCount = tb.lessons[0]?.count ?? 0;
    if (!confirm(
      `Xóa giáo trình "${tb.name}"?\n${lessonCount} bài học của giáo trình sẽ bị xóa theo (bài đã gán vào buổi học sẽ bị gỡ, câu hỏi luyện tập mất liên kết bài).`,
    )) return;
    setError(null);
    try {
      await deleteTextbook(tb.id);
      textbooks.reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  const total = textbooks.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Thư viện giáo trình</h1>
          <p className="mt-1 text-muted-foreground">
            Kho giáo trình nạp sẵn từ vựng, ngữ pháp, bài tập theo từng bài — giáo viên chỉ việc chọn và gán vào buổi học.
          </p>
        </div>
        {canManage && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4" />
            {importing ? (progress ?? "Đang import...") : "Nhập giáo trình (JSON)"}
          </Button>
        </div>
        )}
      </div>

      {error && <ErrorNote message={error} />}
      {textbooks.error && <ErrorNote message={textbooks.error} />}
      {result && (
        <div className="rounded-xl border border-jade-200 bg-jade-50 px-4 py-3 text-sm text-jade-800">
          Import xong: {result.lessonsCreated} bài mới, {result.lessonsUpdated} bài cập nhật ·{" "}
          {result.vocabCreated} từ vựng thêm vào kho, {result.vocabReused} từ có sẵn cập nhật lại ·{" "}
          {result.questionsCreated} câu hỏi thêm mới{result.questionsSkipped ? `, ${result.questionsSkipped} câu trùng bỏ qua` : ""}.
        </div>
      )}

      {total > 0 && (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm giáo trình theo tên, mã, cấp độ..."
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {textbooks.loading ? (
        <Card><LoadingRows rows={3} /></Card>
      ) : total === 0 ? (
        <Empty
          icon={Library}
          title="Chưa có giáo trình nào"
          description={
            canManage
              ? "Bấm “Nhập giáo trình (JSON)” và chọn file trong thư mục supabase/library/ của dự án (vd. hsk1-standard.json)."
              : "Ban quản lý sẽ nhập giáo trình vào kho — khi có, bạn sẽ thấy ngay tại đây."
          }
        />
      ) : sections.length === 0 ? (
        <Empty
          icon={Search}
          title="Không tìm thấy giáo trình"
          description={`Không có giáo trình nào khớp với “${q}”.`}
        />
      ) : (
        <div className="space-y-8">
          {sections.map(({ series, items }) => {
            const Icon = SERIES_ICONS[series];
            return (
              <section key={series}>
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-brand-600" />
                    <h2 className="text-lg font-bold">{SERIES_LABELS[series]}</h2>
                    <Badge variant="muted">{items.length}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{SERIES_DESCRIPTIONS[series]}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((tb) => (
                    <Card key={tb.id} className="card-hover flex flex-col overflow-hidden">
                      <CardContent className="flex flex-1 gap-4 p-4 sm:p-5">
                        <Link href={`/library/textbooks/${tb.id}`} className="w-24 shrink-0">
                          <TextbookCover
                            name={tb.name}
                            name_zh={tb.name_zh}
                            level={tb.level}
                            code={tb.code}
                            cover_url={tb.cover_url}
                          />
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {tb.name_zh && (
                                <div className="zh truncate text-base font-bold text-brand-700">{tb.name_zh}</div>
                              )}
                              <div className="truncate text-base font-semibold" title={tb.name}>{tb.name}</div>
                            </div>
                            {tb.level && (
                              <Badge variant="gold" className="shrink-0">{LEVEL_LABELS[tb.level] ?? tb.level}</Badge>
                            )}
                          </div>
                          {tb.description && (
                            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                              {tb.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <BookOpen className="h-3.5 w-3.5" /> {tb.lessons[0]?.count ?? 0} bài học
                          </div>
                          <div className="mt-auto flex gap-2 pt-3">
                            <Link href={`/library/textbooks/${tb.id}`} className="flex-1">
                              <Button variant="secondary" size="sm" className="w-full">
                                Xem bài học <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            {canManage && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-rose-600 hover:bg-rose-50"
                                onClick={() => handleDelete(tb)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {canManage && (
      <Card>
        <CardContent className="p-4 sm:p-5 text-sm leading-relaxed text-muted-foreground">
          <div className="font-semibold text-foreground">Cách import giáo trình</div>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            <li>Chuẩn bị file JSON theo mẫu trong <code className="rounded bg-muted px-1">supabase/library/</code> (đã có sẵn bộ <code className="rounded bg-muted px-1">hsk1–3-standard.json</code>, <code className="rounded bg-muted px-1">yct1–4-standard.json</code>, <code className="rounded bg-muted px-1">msutong-1–4.json</code>).</li>
            <li>Bấm <b>Nhập giáo trình (JSON)</b> và chọn file. Import lại cùng file để cập nhật — bài khớp theo số bài, từ vựng dùng lại kho chung, câu hỏi trùng tự bỏ qua.</li>
            <li>Muốn có ảnh bìa thật, thêm <code className="rounded bg-muted px-1">&quot;cover_url&quot;</code> vào phần <code className="rounded bg-muted px-1">textbook</code> của file JSON; chưa có thì trang tự vẽ bìa theo bộ HSK / YCT.</li>
            <li>Sau khi import, giáo viên thấy bài học ở mục <b>Bài học</b> để gán vào buổi, và lọc được câu hỏi theo bài khi giao bài tập.</li>
          </ol>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
