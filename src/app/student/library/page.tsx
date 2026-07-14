import Link from "next/link";
import { ArrowRight, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { lessons, vocab } from "@/lib/mock-data";

export default function LibraryPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Thư viện</h1>
        <p className="mt-1 text-muted-foreground">
          Toàn bộ bài giảng và từ vựng bạn có thể truy cập.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Bài giảng</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {lessons.map((l) => (
            <Link key={l.id} href={`/student/lesson/${l.id}`}>
              <Card className="card-hover">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="zh grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-100 to-gold-100 text-2xl font-bold text-brand-700">
                    {l.titleZh.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge variant="outline">Bài {l.unit}</Badge>
                    <div className="mt-1 truncate font-semibold">{l.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.slides.length} slide · {l.vocabIds.length} từ vựng
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Tất cả từ vựng ({vocab.length})</h2>
        <Card>
          <div className="divide-y">
            {vocab.map((v) => (
              <div key={v.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30">
                <div className="zh w-16 text-3xl font-bold text-brand-700">{v.hanzi}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{v.pinyin}</div>
                  <div className="text-xs text-muted-foreground">{v.meaning}</div>
                </div>
                <Badge variant="outline">{v.level}</Badge>
                <button className="text-muted-foreground hover:text-brand-500">
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
