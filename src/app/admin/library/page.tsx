"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Library, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage, LEVEL_LABELS } from "@/lib/db";
import {
  deleteTextbook,
  fetchTextbooks,
  importTextbook,
  type TextbookImportPayload,
  type TextbookImportResult,
  type TextbookRow,
} from "@/lib/db-library";

export default function AdminLibraryPage() {
  const { user } = useAuth();
  const textbooks = useLoad(fetchTextbooks);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<TextbookImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Thư viện giáo trình</h1>
          <p className="mt-1 text-muted-foreground">
            Kho giáo trình nạp sẵn từ vựng, ngữ pháp, bài tập theo từng bài — giáo viên chỉ việc chọn và gán vào buổi học.
          </p>
        </div>
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
      </div>

      {error && <ErrorNote message={error} />}
      {textbooks.error && <ErrorNote message={textbooks.error} />}
      {result && (
        <div className="rounded-xl border border-jade-200 bg-jade-50 px-4 py-3 text-sm text-jade-800">
          Import xong: {result.lessonsCreated} bài mới, {result.lessonsUpdated} bài cập nhật ·{" "}
          {result.vocabCreated} từ vựng thêm vào kho, {result.vocabReused} từ dùng lại ·{" "}
          {result.questionsCreated} câu hỏi thêm mới{result.questionsSkipped ? `, ${result.questionsSkipped} câu trùng bỏ qua` : ""}.
        </div>
      )}

      {textbooks.loading ? (
        <Card><LoadingRows rows={3} /></Card>
      ) : (textbooks.data?.length ?? 0) === 0 ? (
        <Empty
          icon={Library}
          title="Chưa có giáo trình nào"
          description="Bấm “Nhập giáo trình (JSON)” và chọn file trong thư mục supabase/library/ của dự án (vd. msutong-4.json)."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {textbooks.data!.map((tb) => (
            <Card key={tb.id} className="card-hover flex flex-col">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="zh grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-100 to-gold-100 text-2xl font-bold text-brand-700">
                    {(tb.name_zh ?? tb.name).slice(0, 1)}
                  </div>
                  {tb.level && (
                    <Badge variant="gold">{LEVEL_LABELS[tb.level] ?? tb.level}</Badge>
                  )}
                </div>
                {tb.name_zh && <div className="zh mt-3 text-xl font-bold text-brand-700">{tb.name_zh}</div>}
                <div className="mt-0.5 text-lg font-semibold">{tb.name}</div>
                {tb.description && (
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{tb.description}</p>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" /> {tb.lessons[0]?.count ?? 0} bài học
                </div>
                <div className="mt-4 flex gap-2 pt-1">
                  <Link href={`/admin/library/${tb.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      Xem bài học <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={() => handleDelete(tb)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-5 text-sm leading-relaxed text-muted-foreground">
          <div className="font-semibold text-foreground">Cách import giáo trình</div>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            <li>Chuẩn bị file JSON theo mẫu trong <code className="rounded bg-muted px-1">supabase/library/</code> (đã có sẵn <code className="rounded bg-muted px-1">msutong-4.json</code>, <code className="rounded bg-muted px-1">hsk1-standard.json</code>).</li>
            <li>Bấm <b>Nhập giáo trình (JSON)</b> và chọn file. Import lại cùng file để cập nhật — bài khớp theo số bài, từ vựng dùng lại kho chung, câu hỏi trùng tự bỏ qua.</li>
            <li>Sau khi import, giáo viên thấy bài học ở mục <b>Bài học</b> để gán vào buổi, và lọc được câu hỏi theo bài khi giao bài tập.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
