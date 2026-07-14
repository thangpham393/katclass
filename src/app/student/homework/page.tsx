import Link from "next/link";
import { Calendar, CheckCircle2, ClipboardList, Clock, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { classes, homeworks, users } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

const typeLabel = {
  flashcard: "Flashcard",
  quiz: "Quiz",
  writing: "Viết Hán tự",
  listening: "Nghe hiểu",
  mixed: "Tổng hợp",
};

export default function StudentHomeworkPage() {
  const me = users.find((u) => u.role === "student")!;
  const myHomeworks = homeworks.filter((h) => me.classIds?.includes(h.classId));
  const active = myHomeworks.filter((h) => h.status !== "graded");
  const done = myHomeworks.filter((h) => h.status === "graded");

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Bài tập về nhà</h1>
          <p className="mt-1 text-muted-foreground">
            Hoàn thành để duy trì streak và nhận huy hiệu!
          </p>
        </div>
        <Badge variant="gold" className="text-sm">
          <Trophy className="h-3.5 w-3.5" /> Tuần này: {done.length} hoàn thành
        </Badge>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Đang chờ ({active.length})
        </h2>
        {active.length === 0 ? (
          <Empty icon={CheckCircle2} title="Tuyệt vời!" description="Bạn đã hoàn thành mọi bài tập." />
        ) : (
          <div className="grid gap-3">
            {active.map((h) => {
              const cls = classes.find((c) => c.id === h.classId);
              const overdue = new Date(h.dueDate) < new Date();
              return (
                <Card key={h.id} className="card-hover">
                  <CardContent className="flex flex-wrap items-center gap-4 p-5">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-gold-50 text-brand-600">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{h.title}</h3>
                        <Badge variant="outline">{typeLabel[h.type]}</Badge>
                        {h.status === "in-progress" && (
                          <Badge variant="gold">Đang làm</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                        {h.description}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">{cls?.name}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className={overdue ? "font-semibold text-rose-600" : "text-muted-foreground"}>
                          <Calendar className="inline h-3 w-3 mr-1" />
                          Hạn {formatDate(h.dueDate)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {h.quizId && (
                        <Link href={`/student/quiz/${h.quizId}`}>
                          <Button>Làm bài</Button>
                        </Link>
                      )}
                      {!h.quizId && h.vocabIds && (
                        <Link href={`/student/flashcard/d-1`}>
                          <Button variant="outline">Ôn flashcard</Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" /> Đã chấm điểm ({done.length})
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {done.map((h) => (
            <Card key={h.id} className="bg-muted/30">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="font-semibold">{h.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{typeLabel[h.type]} · {formatDate(h.dueDate)}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-emerald-600">{h.score}</div>
                  <div className="text-xs text-muted-foreground">/ 100</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
