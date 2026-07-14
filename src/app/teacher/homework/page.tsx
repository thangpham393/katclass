import Link from "next/link";
import { Calendar, ClipboardList, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { classes, homeworks } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default function TeacherHomeworkPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Bài tập đã giao</h1>
          <p className="mt-1 text-muted-foreground">Quản lý và theo dõi tiến độ hoàn thành của học viên.</p>
        </div>
        <Link href="/teacher/homework/new">
          <Button><Plus className="h-4 w-4" /> Giao bài tập mới</Button>
        </Link>
      </div>

      <div className="grid gap-3">
        {homeworks.map((h) => {
          const c = classes.find((cl) => cl.id === h.classId);
          const submitted = Math.round((c?.studentIds.length ?? 0) * (h.status === "graded" ? 1 : 0.6));
          return (
            <Card key={h.id} className="card-hover">
              <CardContent className="flex flex-wrap items-center gap-4 p-5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-gold-50 text-brand-600">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{h.title}</h3>
                    <Badge variant="outline">{h.type}</Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{c?.name}</span>
                    <span>·</span>
                    <Calendar className="h-3 w-3" /> Hạn {formatDate(h.dueDate)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center sm:flex sm:gap-6">
                  <div>
                    <div className="text-lg font-bold">
                      {submitted}/{c?.studentIds.length}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Đã nộp</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-600">
                      {h.status === "graded" ? "92%" : "—"}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Điểm TB</div>
                  </div>
                </div>
                <Button variant="outline" size="sm">Xem chi tiết</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
