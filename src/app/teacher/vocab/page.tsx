import { Plus, Search, Upload, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { vocab } from "@/lib/mock-data";

export default function TeacherVocabPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Kho từ vựng</h1>
          <p className="mt-1 text-muted-foreground">Quản lý {vocab.length} từ vựng dùng chung cho mọi lớp.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Upload className="h-4 w-4" /> Import CSV</Button>
          <Button><Plus className="h-4 w-4" /> Thêm từ</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Tìm Hán tự, pinyin, nghĩa..." className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="grid grid-cols-12 gap-3 border-b bg-muted/40 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-2">Hán tự</div>
          <div className="col-span-2">Pinyin</div>
          <div className="col-span-3">Nghĩa</div>
          <div className="col-span-3">Ví dụ</div>
          <div className="col-span-1">Cấp</div>
          <div className="col-span-1 text-right">Audio</div>
        </div>
        <div className="divide-y">
          {vocab.map((v) => (
            <div key={v.id} className="grid grid-cols-12 items-center gap-3 px-5 py-3 hover:bg-muted/20">
              <div className="zh col-span-2 text-2xl font-bold text-brand-700">{v.hanzi}</div>
              <div className="col-span-2 text-sm font-medium">{v.pinyin}</div>
              <div className="col-span-3 text-sm">{v.meaning}</div>
              <div className="zh col-span-3 truncate text-xs text-muted-foreground">{v.example?.zh ?? "—"}</div>
              <div className="col-span-1"><Badge variant="outline">{v.level}</Badge></div>
              <div className="col-span-1 flex justify-end">
                <button className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-brand-50 hover:text-brand-600">
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
