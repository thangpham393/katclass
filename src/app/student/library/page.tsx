"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Search, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useLoad } from "@/lib/use-load";
import { fetchLessons, fetchVocabItems, type VocabRow } from "@/lib/db-content";
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

export default function LibraryPage() {
  const [q, setQ] = useState("");
  const lessons = useLoad(() => fetchLessons(), []);
  const vocab = useLoad(() => fetchVocabItems(q), [q]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Thư viện</h1>
        <p className="mt-1 text-muted-foreground">
          Toàn bộ bài học và kho từ vựng của trung tâm.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Bài học ({lessons.data?.length ?? 0})</h2>
        {lessons.error && <ErrorNote message={lessons.error} />}
        {lessons.loading ? (
          <Card><LoadingRows rows={3} /></Card>
        ) : (lessons.data?.length ?? 0) === 0 ? (
          <Empty
            icon={BookOpen}
            title="Chưa có bài học"
            description="Giáo viên sẽ đưa nội dung bài học lên đây."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {lessons.data!.map((l) => (
              <Link key={l.id} href={`/student/lessons/${l.id}`}>
                <Card className="card-hover h-full">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="zh grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-100 to-gold-100 text-2xl font-bold text-brand-700">
                      {(l.title_zh ?? l.title).slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {l.unit != null && <Badge variant="outline">Bài {l.unit}</Badge>}
                        {(l.textbook?.level ?? l.course?.level) && (
                          <Badge variant="muted">
                            {LEVEL_LABELS[(l.textbook?.level ?? l.course?.level)!] ?? (l.textbook?.level ?? l.course?.level)}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 truncate font-semibold">{l.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.textbook?.name ?? l.course?.name ?? "Chưa gắn khóa"} · {l.lesson_vocab[0]?.count ?? 0} từ vựng
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Kho từ vựng</h2>
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm Hán tự, pinyin, nghĩa..."
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
        {vocab.error && <ErrorNote message={vocab.error} />}
        {vocab.loading ? (
          <Card className="mt-3"><LoadingRows rows={4} /></Card>
        ) : (
          <Card className="mt-3">
            <div className="divide-y">
              {(vocab.data ?? []).map((v) => (
                <div key={v.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30">
                  <div className="zh w-16 shrink-0 text-3xl font-bold text-brand-700">{v.hanzi}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{v.pinyin}</div>
                    <div className="text-xs text-muted-foreground">{v.meaning}</div>
                  </div>
                  {v.level && <Badge variant="outline">{v.level}</Badge>}
                  <button
                    onClick={() => speakVocab(v)}
                    className="text-muted-foreground hover:text-brand-500"
                    title="Nghe phát âm"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {(vocab.data?.length ?? 0) === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {q ? "Không tìm thấy từ phù hợp." : "Kho từ vựng đang trống."}
                </div>
              )}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
