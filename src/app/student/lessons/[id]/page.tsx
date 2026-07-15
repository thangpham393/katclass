"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Languages, Presentation, Sparkles, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { FlashcardPlayer } from "@/components/flashcard/flashcard-player";
import { useLoad } from "@/lib/use-load";
import { fetchLesson, type VocabRow } from "@/lib/db-content";
import { LEVEL_LABELS } from "@/lib/db";

function speakVocab(v: VocabRow) {
  if (v.audio_url) {
    new Audio(v.audio_url).play().catch(() => {});
    return;
  }
  const u = new SpeechSynthesisUtterance(v.hanzi);
  u.lang = "zh-CN";
  u.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export default function StudentLessonPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const lesson = useLoad(() => fetchLesson(params.id), [params.id]);

  if (lesson.loading) return <Card><LoadingRows rows={6} /></Card>;
  if (lesson.error) return <ErrorNote message={lesson.error} />;
  if (!lesson.data) {
    return (
      <div className="space-y-4">
        <ErrorNote message="Không tìm thấy bài học này." />
        <Link href="/student/library" className="text-sm font-semibold text-brand-600">← Thư viện</Link>
      </div>
    );
  }

  const l = lesson.data;

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </button>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          {l.unit != null && <Badge variant="gold">Bài {l.unit}</Badge>}
          {(l.textbook ?? l.course) && (
            <Badge variant="outline">
              {(l.textbook ?? l.course)!.name}
              {(l.textbook ?? l.course)!.level
                ? ` · ${LEVEL_LABELS[(l.textbook ?? l.course)!.level!] ?? (l.textbook ?? l.course)!.level}`
                : ""}
            </Badge>
          )}
        </div>
        {l.title_zh && <div className="zh mt-3 text-4xl font-bold text-brand-700 md:text-5xl">{l.title_zh}</div>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{l.title}</h1>
        {l.summary && <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">{l.summary}</p>}
      </div>

      {/* Slide */}
      {l.slide_embed_url && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Presentation className="h-5 w-5 text-brand-600" /> Slide bài giảng
          </h2>
          <Card className="overflow-hidden">
            <div className="relative aspect-video w-full bg-muted">
              <iframe
                src={l.slide_embed_url}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; fullscreen"
                allowFullScreen
                title={`Slide ${l.title}`}
              />
            </div>
          </Card>
        </section>
      )}

      {/* Ngữ pháp */}
      {l.grammar && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Languages className="h-5 w-5 text-brand-600" /> Ngữ pháp & ghi chú
          </h2>
          <Card>
            <CardContent className="p-6">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{l.grammar}</div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Từ vựng */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <BookOpen className="h-5 w-5 text-brand-600" /> Từ vựng trong bài ({l.vocab.length})
        </h2>
        {l.vocab.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Bài học chưa có từ vựng.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {l.vocab.map((v) => (
              <Card key={v.id} className="card-hover">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="zh text-4xl font-bold text-brand-700">{v.hanzi}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{v.pinyin}</span>
                      <button
                        onClick={() => speakVocab(v)}
                        className="text-muted-foreground hover:text-brand-500"
                        title="Nghe phát âm"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-sm">{v.meaning}</div>
                    {v.example && (
                      <div className="mt-2 rounded-lg bg-muted/60 p-2 text-xs">
                        <div className="zh">{v.example.zh}</div>
                        {v.example.pinyin && <div className="text-muted-foreground">{v.example.pinyin}</div>}
                        <div className="text-muted-foreground">→ {v.example.vi}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Flashcard */}
      {l.vocab.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-gold-500" /> Ôn nhanh bằng flashcard
          </h2>
          <Card>
            <CardContent className="p-4 md:p-6">
              <FlashcardPlayer vocab={l.vocab} />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
