import { Filter, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { classes } from "@/lib/mock-data";

export default function AdminClassesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Lớp & Lịch học</h1>
          <p className="mt-1 text-muted-foreground">{classes.length} lớp đang mở.</p>
        </div>
        <Button><Plus className="h-4 w-4" /> Tạo lớp</Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Tìm lớp..." className="pl-9" />
          </div>
          <Button variant="outline"><Filter className="h-4 w-4" /> Cấp độ</Button>
        </CardContent>
      </Card>

      <Card>
        <div className="grid grid-cols-12 gap-3 border-b bg-muted/40 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Lớp</div>
          <div className="col-span-2">Lịch</div>
          <div className="col-span-2">Giáo viên</div>
          <div className="col-span-1">Sĩ số</div>
          <div className="col-span-2">Tiến độ</div>
          <div className="col-span-1 text-right">Hành động</div>
        </div>
        <div className="divide-y">
          {classes.map((c) => (
            <div key={c.id} className="grid grid-cols-12 items-center gap-3 px-5 py-3 hover:bg-muted/20">
              <div className="col-span-4 flex items-center gap-3">
                <div className="zh grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand-100 to-gold-100 font-bold text-brand-700">
                  {c.level.slice(-1)}
                </div>
                <div>
                  <div className="text-sm font-semibold">{c.name}</div>
                  <Badge variant="outline">{c.level}</Badge>
                </div>
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">{c.schedule}</div>
              <div className="col-span-2 text-sm">Trần Thu Hà</div>
              <div className="col-span-1 font-semibold">{c.studentIds.length}</div>
              <div className="col-span-2">
                <Progress value={c.progress} />
                <div className="mt-0.5 text-xs text-muted-foreground">{c.progress}%</div>
              </div>
              <div className="col-span-1 text-right">
                <Button variant="ghost" size="sm">⋯</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
