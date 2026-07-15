"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { FlashcardPlayer } from "@/components/flashcard/flashcard-player";
import { useLoad } from "@/lib/use-load";
import { fetchLesson } from "@/lib/db-content";

/** deckId = id bài học — bộ thẻ là toàn bộ từ vựng của bài. */
export default function FlashcardPlayerPage() {
  const params = useParams<{ deckId: string }>();
  const lesson = useLoad(() => fetchLesson(params.deckId), [params.deckId]);

  if (lesson.loading) return <Card><LoadingRows rows={5} /></Card>;
  if (lesson.error) return <ErrorNote message={lesson.error} />;
  if (!lesson.data) {
    return (
      <div className="space-y-4">
        <ErrorNote message="Không tìm thấy bộ thẻ này." />
        <Link href="/student/flashcard" className="text-sm font-semibold text-brand-600">← Tất cả bộ thẻ</Link>
      </div>
    );
  }

  const l = lesson.data;

  return (
    <div className="space-y-6">
      <Link
        href="/student/flashcard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Tất cả bộ thẻ
      </Link>
      <div>
        <div className="text-xs uppercase tracking-widest text-brand-600">Flashcard</div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {l.unit != null ? `Bài ${l.unit} — ` : ""}
          {l.title}
        </h1>
        {l.course && <p className="text-sm text-muted-foreground">{l.course.name}</p>}
      </div>
      {l.vocab.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Bài học này chưa có từ vựng để ôn.
          </CardContent>
        </Card>
      ) : (
        <FlashcardPlayer vocab={l.vocab} />
      )}
    </div>
  );
}
