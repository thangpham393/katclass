import { Mail, Phone, Plus, Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const teachers = [
  { id: "t-1", name: "Trần Thu Hà", classes: 3, students: 24, rating: 4.9, level: "HSK 2-4", joined: "2023" },
  { id: "t-2", name: "Vũ Quốc Hùng", classes: 2, students: 18, rating: 4.8, level: "HSK 3-5", joined: "2024" },
  { id: "t-3", name: "Lý Thuỳ Linh", classes: 2, students: 16, rating: 4.7, level: "HSK 1-2", joined: "2024" },
  { id: "t-4", name: "Phan Đình Khoa", classes: 1, students: 8, rating: 4.6, level: "HSK 5-6", joined: "2025" },
];

export default function AdminTeachersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Giáo viên</h1>
          <p className="mt-1 text-muted-foreground">{teachers.length} giáo viên đang giảng dạy.</p>
        </div>
        <Button><Plus className="h-4 w-4" /> Thêm giáo viên</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teachers.map((t) => (
          <Card key={t.id} className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Avatar name={t.name} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">Gia nhập {t.joined}</div>
                  <Badge variant="gold" className="mt-2">
                    <Star className="h-3 w-3 fill-current" /> {t.rating}
                  </Badge>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xl font-bold">{t.classes}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lớp</div>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xl font-bold">{t.students}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Học viên</div>
                </div>
              </div>

              <div className="mt-4 text-xs text-muted-foreground">
                Cấp độ giảng dạy: <span className="font-semibold text-foreground">{t.level}</span>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1"><Mail className="h-3.5 w-3.5" /> Email</Button>
                <Button variant="outline" size="sm" className="flex-1"><Phone className="h-3.5 w-3.5" /> Gọi</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
