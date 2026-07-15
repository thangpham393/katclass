"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, HelpCircle, Languages, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useLoad } from "@/lib/use-load";
import { LEVEL_LABELS } from "@/lib/db";
import { fetchLesson, fetchQuestions, questionPreview, QUESTION_TYPE_LABELS } from "@/lib/db-content";
import { fetchTextbook, fetchTextbookLessons, type TextbookLessonRow } from "@/lib/db-library";

export default function AdminTextbookPage() {
  const params = useParams<{ id: string }>();
  const textbook = useLoad(() => fetchTextbook(params.id), [params.id]);
  const lessons = useLoad(() => fetchTextbookLessons(params.id), [params.id]);
  const [previewing, setPreviewing] = useState<TextbookLessonRow | null>(null);

  if (textbook.loading) return <Card><LoadingRows rows={5} /></Card>;
  if (textbook.error) return <ErrorNote message={textbook.error} />;
  if (!textbook.data) {
    return (
      <div className="space-y-4">
        <ErrorNote message="Không tìm thấy giáo trình này." />
        <Link href="/admin/library" className="text-sm font-semibold text-brand-600">← Thư viện giáo trình</Link>
      </div>
    );
  }

  const tb = textbook.data;
  const list = lessons.data ?? [];
  const totalVocab = list.reduce((s, l) => s + (l.lesson_vocab[0]?.count ?? 0), 0);
  const totalQuestions = list.reduce((s, l) => s + (l.questions[0]?.count ?? 0), 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/library"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Thư viện giáo trình
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          {tb.level && <Badge variant="gold">{LEVEL_LABELS[tb.level] ?? tb.level}</Badge>}
          <Badge variant="outline">{list.length} bài học</Badge>
        </div>
        {tb.name_zh && <div className="zh mt-3 text-4xl font-bold text-brand-700">{tb.name_zh}</div>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{tb.name}</h1>
        {tb.description && <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">{tb.description}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: BookOpen, label: "Bài học", value: list.length },
          { icon: Layers, label: "Từ vựng", value: totalVocab },
          { icon: HelpCircle, label: "Câu hỏi luyện tập", value: totalQuestions },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {lessons.error && <ErrorNote message={lessons.error} />}
      {lessons.loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : list.length === 0 ? (
        <Empty icon={BookOpen} title="Giáo trình chưa có bài học" description="Import lại file JSON để nạp bài học." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((l) => (
            <button key={l.id} type="button" onClick={() => setPreviewing(l)} className="text-left">
              <Card className="card-hover h-full">
                <CardContent className="p-5">
                  <Badge variant="outline">Bài {String(l.unit ?? "?").padStart(2, "0")}</Badge>
                  {l.title_zh && <div className="zh mt-3 text-2xl font-bold text-brand-700">{l.title_zh}</div>}
                  <div className="mt-1 font-semibold">{l.title}</div>
                  {l.summary && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{l.summary}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3 w-3" /> {l.lesson_vocab[0]?.count ?? 0} từ
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <HelpCircle className="h-3 w-3" /> {l.questions[0]?.count ?? 0} câu hỏi
                    </span>
                    {l.grammar && (
                      <span className="inline-flex items-center gap-1">
                        <Languages className="h-3 w-3" /> Ngữ pháp
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {previewing && (
        <LessonPreviewModal lesson={previewing} onClose={() => setPreviewing(null)} />
      )}
    </div>
  );
}

/* ============ Xem trước nội dung một bài ============ */

function LessonPreviewModal({
  lesson,
  onClose,
}: {
  lesson: TextbookLessonRow;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"vocab" | "grammar" | "questions">("vocab");
  const detail = useLoad(() => fetchLesson(lesson.id), [lesson.id]);
  const questions = useLoad(() => fetchQuestions({ lessonId: lesson.id }), [lesson.id]);

  const tabs = [
    { key: "vocab" as const, label: `Từ vựng (${lesson.lesson_vocab[0]?.count ?? 0})` },
    { key: "grammar" as const, label: "Ngữ pháp" },
    { key: "questions" as const, label: `Câu hỏi (${lesson.questions[0]?.count ?? 0})` },
  ];

  return (
    <Modal open onClose={onClose} title={`Bài ${lesson.unit ?? "?"} — ${lesson.title}`}>
      <div className="space-y-4">
        <div className="flex gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                tab === t.key
                  ? "rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-96 overflow-y-auto pr-1">
          {tab === "vocab" && (
            detail.loading ? <LoadingRows rows={4} className="p-0" /> :
            detail.error ? <ErrorNote message={detail.error} /> :
            (detail.data?.vocab.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Bài chưa gắn từ vựng.</div>
            ) : (
              <div className="space-y-1.5">
                {detail.data!.vocab.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
                    <div className="zh w-20 shrink-0 text-xl font-bold text-brand-700">{v.hanzi}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium">{v.pinyin}</div>
                      <div className="truncate text-xs text-muted-foreground">{v.meaning}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "grammar" && (
            detail.loading ? <LoadingRows rows={4} className="p-0" /> :
            detail.data?.grammar ? (
              <div className="whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm leading-relaxed">
                {detail.data.grammar}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Bài này không có ghi chú ngữ pháp.</div>
            )
          )}

          {tab === "questions" && (
            questions.loading ? <LoadingRows rows={4} className="p-0" /> :
            questions.error ? <ErrorNote message={questions.error} /> :
            (questions.data?.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Bài chưa có câu hỏi luyện tập.</div>
            ) : (
              <div className="space-y-1.5">
                {questions.data!.map((q) => (
                  <div key={q.id} className="rounded-xl border bg-card p-2.5">
                    <Badge variant="muted">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                    <div className="zh mt-1.5 text-sm">{questionPreview(q)}</div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </Modal>
  );
}
