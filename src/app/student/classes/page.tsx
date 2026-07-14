import Link from "next/link";
import { ArrowRight, Calendar, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { classes, lessons, users } from "@/lib/mock-data";

export default function MyClassesPage() {
  const me = users.find((u) => u.role === "student")!;
  const myClasses = classes.filter((c) => me.classIds?.includes(c.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Lớp của tôi</h1>
        <p className="mt-1 text-muted-foreground">{myClasses.length} lớp đang theo học</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {myClasses.map((c) => {
          const classLessons = lessons.filter((l) => l.classId === c.id);
          return (
            <Card key={c.id} className="overflow-hidden">
              <div className="relative h-40">
                <img src={c.cover} alt={c.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <Badge variant="gold" className="mb-2">{c.level}</Badge>
                  <div className="text-lg font-bold">{c.name}</div>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {c.schedule}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {c.studentIds.length} học viên
                    </span>
                  </div>
                </div>
              </div>
              <CardContent className="space-y-4 p-5">
                <p className="text-sm text-muted-foreground">{c.description}</p>
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Tiến độ khóa</span>
                    <span className="font-semibold">{c.progress}%</span>
                  </div>
                  <Progress value={c.progress} className="mt-1" />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Bài học gần đây
                  </div>
                  <div className="space-y-1.5">
                    {classLessons.slice(0, 2).map((l) => (
                      <Link
                        key={l.id}
                        href={`/student/lesson/${l.id}`}
                        className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm hover:border-brand-300"
                      >
                        <span>Bài {l.unit} — {l.title}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </div>
                <Link href={`/student/classroom/${c.id}`}>
                  <Button className="w-full">Vào lớp học</Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
