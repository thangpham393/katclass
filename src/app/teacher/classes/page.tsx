import Link from "next/link";
import { Calendar, MoreHorizontal, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { classes, users } from "@/lib/mock-data";

export default function TeacherClassesPage() {
  const me = users.find((u) => u.role === "teacher")!;
  const myClasses = classes.filter((c) => c.teacherId === me.id);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Lớp đang dạy</h1>
          <p className="mt-1 text-muted-foreground">{myClasses.length} lớp</p>
        </div>
        <Button variant="outline">+ Tạo lớp mới</Button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {myClasses.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            <div className="relative h-32">
              <img src={c.cover} alt={c.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <Badge variant="gold" className="absolute left-3 top-3">{c.level}</Badge>
              <button className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-white backdrop-blur hover:bg-white/30">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <div className="font-bold">{c.name}</div>
                <div className="flex items-center gap-3 text-xs text-white/90">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {c.schedule}</span>
                </div>
              </div>
            </div>
            <CardContent className="space-y-4 p-5">
              <div>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-muted-foreground">Tiến độ giáo trình</span>
                  <span className="font-semibold">{c.progress}%</span>
                </div>
                <Progress value={c.progress} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {c.studentIds.slice(0, 5).map((id, i) => (
                    <Avatar key={id} name={`Học viên ${i + 1}`} size={28} className="ring-2 ring-white" />
                  ))}
                  {c.studentIds.length > 5 && (
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[10px] font-bold ring-2 ring-white">
                      +{c.studentIds.length - 5}
                    </div>
                  )}
                </div>
                <Badge variant="outline"><Users className="h-3 w-3" /> {c.studentIds.length} học viên</Badge>
              </div>

              <div className="flex gap-2">
                <Link href="/teacher/homework/new" className="flex-1">
                  <Button variant="outline" className="w-full">Giao bài</Button>
                </Link>
                <Link href="/teacher/students" className="flex-1">
                  <Button className="w-full">Học viên</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
