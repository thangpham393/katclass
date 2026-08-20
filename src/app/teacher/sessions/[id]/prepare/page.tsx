"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ClipboardList,
  ExternalLink,
  ListChecks,
  Presentation,
  Volume2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { SessionContentCard } from "@/components/session-content-card";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  dbErrorMessage,
  fetchSession,
  sessionClassLabel,
} from "@/lib/db";
import { fetchLesson, fetchQuestions, type LessonDetail } from "@/lib/db-content";
import { saveSessionPrep, speakZh, toEmbedUrl } from "@/lib/db-classroom";
import { useLoad } from "@/lib/use-load";

/**
 * Chuẩn bị trước buổi dạy: chọn bài theo giáo trình của lớp, xem lại bộ từ vựng
 * sẽ dạy, đặt sẵn link slide cho buổi và ghi chú. Vào lớp là chiếu được ngay —
 * nhưng trong giờ giáo viên vẫn dán được link khác nếu đổi slide phút chót.
 */
export default function PrepareSessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const session = useLoad(() => fetchSession(sessionId), [sessionId]);

  /**
   * Bài đang chọn — thẻ chọn bài báo lên ngay khi bấm (đã tự lưu), nên từ vựng
   * và checklist bên dưới cập nhật tức thì chứ không đợi tải lại trang.
   */
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const idKey = lessonIds.join(",");

  // Nạp bản đầy đủ của bài đang chọn: từ vựng + link slide sẵn có của bài
  const lessons = useLoad<LessonDetail[]>(async () => {
    if (!lessonIds.length) return [];
    const rows = await Promise.all(lessonIds.map((id) => fetchLesson(id)));
    return rows.filter(Boolean) as LessonDetail[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  // Ngân hàng câu hỏi của các bài này — để biết cuối buổi có bộ nào giao BTVN
  const questionCount = useLoad<number>(async () => {
    if (!lessonIds.length) return 0;
    const rows = await Promise.all(lessonIds.map((id) => fetchQuestions({ lessonId: id })));
    return rows.flat().length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  const [slide, setSlide] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.data) return;
    setSlide(session.data.slide_url ?? "");
    setNote(session.data.prep_note ?? "");
  }, [session.data]);

  if (session.loading) return <Card><LoadingRows rows={5} /></Card>;
  if (session.error) return <ErrorNote message={session.error} />;
  if (!session.data) {
    return (
      <div className="space-y-4">
        <ErrorNote message="Không tìm thấy buổi học này (hoặc bạn không phụ trách buổi)." />
        <Link href="/teacher" className="text-sm font-semibold text-brand-600">← Trang chủ</Link>
      </div>
    );
  }

  const s = session.data;
  const d = new Date(s.date + "T00:00:00");
  const lessonList = lessons.data ?? [];
  const loadingContent = lessons.loading && lessonIds.length > 0;
  const vocab = lessonList.flatMap((l) => l.vocab);
  const lessonSlide = lessonList.find((l) => l.slide_embed_url)?.slide_embed_url ?? "";
  const effectiveSlide = slide || lessonSlide;

  const checklist = [
    {
      done: lessonIds.length > 0,
      label: lessonIds.length > 0 ? `Đã chọn ${lessonIds.length} bài học` : "Chưa chọn bài học",
    },
    {
      done: !!effectiveSlide,
      label: slide ? "Slide riêng cho buổi" : lessonSlide ? "Dùng slide của bài học" : "Chưa có slide",
    },
    {
      done: vocab.length > 0,
      label: vocab.length > 0
        ? `${vocab.length} từ vựng sẵn cho lớp`
        : loadingContent
          ? "Đang lấy từ vựng…"
          : lessonIds.length === 0
            ? "Chọn bài để lấy từ vựng"
            : "Bài chưa có từ vựng",
    },
    {
      done: (questionCount.data ?? 0) > 0,
      label:
        (questionCount.data ?? 0) > 0
          ? `${questionCount.data} câu hỏi để giao bài về nhà`
          : questionCount.loading && lessonIds.length > 0
            ? "Đang đếm câu hỏi…"
            : "Chưa có câu hỏi để giao BTVN",
    },
  ];

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveSessionPrep(sessionId, { slide_url: slide.trim(), prep_note: note.trim() });
      setSaved(true);
      session.reload();
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/teacher/sessions/${sessionId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Buổi học
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Chuẩn bị buổi dạy — {sessionClassLabel(s)}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")}
            </span>
            <span>{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span>
            {s.session_no && <span>· Buổi {s.session_no}</span>}
            {s.class?.textbook && <Badge variant="gold">{s.class.textbook.name}</Badge>}
          </div>
        </div>
        <Link href={`/classroom/${sessionId}`}>
          <Button>
            <Presentation className="h-4 w-4" /> Vào lớp dạy
          </Button>
        </Link>
      </div>

      {/* Checklist chuẩn bị */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-brand-600" /> Đã chuẩn bị tới đâu
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <div
                key={c.label}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                  c.done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-dashed text-muted-foreground",
                )}
              >
                {c.done ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {c.label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bước 1: chọn bài theo giáo trình */}
      <SessionContentCard
        sessionId={sessionId}
        courseId={s.class?.course?.id ?? null}
        textbook={s.class?.textbook ?? null}
        onChange={setLessonIds}
      />

      {/* Bước 2: slide cho buổi */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Presentation className="h-4 w-4 text-brand-600" /> Slide cho buổi này
          </CardTitle>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu…" : saved ? "Đã lưu ✓" : "Lưu chuẩn bị"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          {error && <ErrorNote message={error} />}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={slide}
              onChange={(e) => setSlide(e.target.value)}
              placeholder="Dán link Google Slides / Drive / Canva / YouTube (hoặc cả mã <iframe…>)"
              className="min-w-0 flex-1"
            />
            {lessonSlide && (
              <Button variant="outline" size="sm" onClick={() => setSlide(lessonSlide)}>
                Dùng slide của bài học
              </Button>
            )}
            {slide && (
              <>
                <a
                  href={slide}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold hover:bg-secondary"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Mở thử
                </a>
                <Button variant="ghost" size="sm" onClick={() => setSlide("")}>
                  Xoá
                </Button>
              </>
            )}
          </div>

          {effectiveSlide ? (
            <div className="overflow-hidden rounded-xl border bg-muted">
              <iframe
                src={toEmbedUrl(effectiveSlide)}
                className="aspect-video w-full"
                title="Xem trước slide"
                allow="fullscreen"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Chưa có slide. Dán link vào ô trên để xem trước ngay tại đây — vào lớp là chiếu
              được luôn, khỏi mất thời gian tìm link giữa giờ.
            </div>
          )}

          <div>
            <div className="mb-1 text-sm font-semibold">Ghi chú chuẩn bị</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Đồ dùng cần mang, hoạt động dự kiến, phần cần nhấn mạnh…"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Trong giờ dạy vẫn dán được link khác ở khung trình chiếu (ưu tiên: link dán tạm →
            slide của buổi → slide của bài học), nên đổi slide phút chót vẫn thoải mái.
          </p>
        </CardContent>
      </Card>

      {/* Bước 3: từ vựng sẽ dạy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brand-600" /> Từ vựng của buổi
            <Badge variant="muted">{vocab.length} từ</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {loadingContent ? (
            <LoadingRows rows={2} className="p-0" />
          ) : vocab.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {lessonIds.length === 0
                ? "Chọn bài học ở khung trên — từ vựng của bài tự hiện ra đây."
                : "Bài đã chọn chưa có từ vựng — gắn từ cho bài ở mục “Bài học”."}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {vocab.map((v) => (
                <div key={v.id} className="flex items-center gap-2 rounded-xl border p-2.5">
                  <span className="zh text-2xl font-bold">{v.hanzi}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-brand-700">{v.pinyin}</div>
                    <div className="truncate text-xs text-muted-foreground">{v.meaning}</div>
                  </div>
                  <button
                    onClick={() => speakZh(v.hanzi)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-secondary hover:bg-brand-100"
                    title="Nghe thử"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Bộ từ này dùng cho lưới từ vựng, trò chơi và công cụ luyện nét chữ trong lớp học.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gold-600" /> Bài tập về nhà
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 text-sm text-muted-foreground">
          {(questionCount.data ?? 0) > 0 ? (
            <>
              Ngân hàng có <b className="text-foreground">{questionCount.data} câu</b> theo bài đã
              chọn — cuối buổi bấm “Kết thúc buổi” là giao cả bộ chỉ bằng một cú nhấp.
            </>
          ) : (
            <>
              Bài đã chọn chưa có câu hỏi trong ngân hàng. Soạn ở mục “Ngân hàng câu hỏi” hoặc
              nhờ admin import bộ bài tập của giáo trình để cuối buổi giao được ngay.
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
