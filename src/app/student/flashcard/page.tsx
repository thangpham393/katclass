"use client";

import Link from "next/link";
import { ArrowRight, Layers, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useLoad } from "@/lib/use-load";
import { fetchLessons } from "@/lib/db-content";
import { LEVEL_LABELS } from "@/lib/db";

export default function FlashcardList() {
  const lessons = useLoad(() => fetchLessons(), []);
  const decks = (lessons.data ?? []).filter((l) => (l.lesson_vocab[0]?.count ?? 0) > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Flashcard</h1>
        <p className="mt-1 text-muted-foreground">
          Ôn từ vựng theo từng bài học — nhấn vào bộ thẻ để bắt đầu.
        </p>
      </div>

      {lessons.error && <ErrorNote message={lessons.error} />}

      {lessons.loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : decks.length === 0 ? (
        <Empty
          icon={Layers}
          title="Chưa có bộ thẻ nào"
          description="Khi giáo viên thêm từ vựng vào bài học, bộ thẻ ôn tập sẽ hiện ở đây."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {decks.map((l) => (
            <Link key={l.id} href={`/student/flashcard/${l.id}`}>
              <Card className="card-hover h-full overflow-hidden">
                <div className="relative bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white">
                  <Badge variant="gold">
                    <Layers className="h-3 w-3" /> {l.lesson_vocab[0]?.count ?? 0} thẻ
                  </Badge>
                  {l.title_zh && <div className="zh mt-3 text-3xl font-bold">{l.title_zh}</div>}
                </div>
                <CardContent className="p-5">
                  <div className="text-sm font-bold">
                    {l.unit != null ? `Bài ${l.unit} — ` : ""}
                    {l.title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {l.course
                      ? `${l.course.name}${l.course.level ? ` · ${LEVEL_LABELS[l.course.level] ?? l.course.level}` : ""}`
                      : "Chưa gắn khóa học"}
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-brand-600">
                    <Sparkles className="h-3 w-3" /> Bắt đầu ôn <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
