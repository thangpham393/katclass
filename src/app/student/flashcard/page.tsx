import Link from "next/link";
import { ArrowRight, Layers, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { decks, classes } from "@/lib/mock-data";

export default function FlashcardList() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Flashcard</h1>
        <p className="mt-1 text-muted-foreground">
          Ôn lại từ vựng theo bộ thẻ — sử dụng Spaced Repetition để nhớ lâu.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {decks.map((d) => {
          const cls = classes.find((c) => c.id === d.classId);
          return (
            <Link key={d.id} href={`/student/flashcard/${d.id}`}>
              <Card className="card-hover overflow-hidden">
                <div className="relative h-36">
                  <img src={d.cover} alt={d.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <Badge className="absolute left-3 top-3" variant="gold">
                    <Layers className="h-3 w-3" /> {d.vocabIds.length} thẻ
                  </Badge>
                  {cls && (
                    <Badge className="absolute right-3 top-3" variant="default">
                      {cls.level}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-5">
                  <div className="text-sm font-bold">{d.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {d.description}
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-brand-600">
                    <Sparkles className="h-3 w-3" /> Bắt đầu ôn{" "}
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
