import { Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { classes, users } from "@/lib/mock-data";

const mockStudents = [
  { id: "s-a", name: "Nguyễn Minh An", classId: "c-1", progress: 78, streak: 7, score: 92 },
  { id: "s-b", name: "Phạm Lan Hương", classId: "c-1", progress: 86, streak: 14, score: 95 },
  { id: "s-c", name: "Đỗ Thành Nam", classId: "c-1", progress: 62, streak: 3, score: 81 },
  { id: "s-d", name: "Lê Quỳnh Trang", classId: "c-2", progress: 45, streak: 0, score: 70 },
  { id: "s-e", name: "Bùi Đức Khôi", classId: "c-2", progress: 88, streak: 21, score: 94 },
  { id: "s-f", name: "Trần Hoài Phương", classId: "c-3", progress: 55, streak: 5, score: 78 },
];

export default function TeacherStudentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Học viên</h1>
        <p className="mt-1 text-muted-foreground">Theo dõi tiến độ và hiệu suất từng học viên.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Tìm học viên..." className="pl-9" />
          </div>
          <Button variant="outline"><Filter className="h-4 w-4" /> Lọc theo lớp</Button>
        </CardContent>
      </Card>

      <Card>
        <div className="grid grid-cols-12 gap-3 border-b bg-muted/40 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Học viên</div>
          <div className="col-span-2">Lớp</div>
          <div className="col-span-3">Tiến độ</div>
          <div className="col-span-1 text-center">Streak</div>
          <div className="col-span-1 text-center">Điểm TB</div>
          <div className="col-span-1 text-right">Hành động</div>
        </div>
        <div className="divide-y">
          {mockStudents.map((s) => {
            const c = classes.find((cl) => cl.id === s.classId);
            return (
              <div key={s.id} className="grid grid-cols-12 items-center gap-3 px-5 py-3 hover:bg-muted/20">
                <div className="col-span-4 flex items-center gap-3">
                  <Avatar name={s.name} />
                  <div>
                    <div className="text-sm font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.id}@classhub.vn</div>
                  </div>
                </div>
                <div className="col-span-2">
                  <Badge variant="outline">{c?.level}</Badge>
                </div>
                <div className="col-span-3">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">Khóa</span>
                    <span className="font-semibold">{s.progress}%</span>
                  </div>
                  <Progress value={s.progress} />
                </div>
                <div className="col-span-1 text-center">
                  <Badge variant={s.streak > 0 ? "gold" : "muted"}>
                    🔥 {s.streak}
                  </Badge>
                </div>
                <div className="col-span-1 text-center font-bold text-emerald-600">{s.score}</div>
                <div className="col-span-1 text-right">
                  <Button variant="ghost" size="sm">Xem</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
