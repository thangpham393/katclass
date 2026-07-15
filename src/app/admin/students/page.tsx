"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { fetchStudentsWithClassCount } from "@/lib/db";
import { useLoad } from "@/lib/use-load";

type Filter = "all" | "unassigned" | "assigned";

export default function AdminStudentsPage() {
  const { data: students, loading, error } = useLoad(fetchStudentsWithClassCount);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    let list = students ?? [];
    if (filter !== "all") {
      list = list.filter((s) => {
        const count = s.class_students?.[0]?.count ?? 0;
        return filter === "unassigned" ? count === 0 : count > 0;
      });
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(needle) || s.email.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [students, q, filter]);

  const unassignedCount = (students ?? []).filter((s) => (s.class_students?.[0]?.count ?? 0) === 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Học viên</h1>
        <p className="mt-1 text-muted-foreground">
          {loading
            ? "Đang tải..."
            : `${students?.length ?? 0} học viên · ${unassignedCount} chờ xếp lớp.`}
        </p>
      </div>

      {error && <ErrorNote message={error} />}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên, email..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select className="w-44" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">Tất cả</option>
            <option value="unassigned">Chờ xếp lớp</option>
            <option value="assigned">Đã có lớp</option>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <Card><LoadingRows rows={5} /></Card>
      ) : filtered.length === 0 ? (
        <Empty
          icon={Users}
          title={q || filter !== "all" ? "Không có học viên phù hợp" : "Chưa có học viên"}
          description={
            q || filter !== "all"
              ? "Thử đổi bộ lọc hoặc từ khóa."
              : "Học viên đăng nhập vào hệ thống lần đầu sẽ tự xuất hiện ở đây với vai trò học viên."
          }
        />
      ) : (
        <Card>
          <div className="hidden grid-cols-12 gap-3 border-b bg-muted/40 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <div className="col-span-5">Học viên</div>
            <div className="col-span-3">Liên hệ</div>
            <div className="col-span-2">Ngày đăng ký</div>
            <div className="col-span-2 text-right">Lớp</div>
          </div>
          <div className="divide-y">
            {filtered.map((s) => {
              const count = s.class_students?.[0]?.count ?? 0;
              return (
                <div key={s.id} className="grid grid-cols-1 items-center gap-3 px-5 py-3 md:grid-cols-12">
                  <div className="col-span-5 flex items-center gap-3">
                    <Avatar name={s.name} src={s.avatar ?? undefined} size={38} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{s.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.student_code && (
                          <span className="font-mono font-medium text-brand-700">{s.student_code}</span>
                        )}
                        {s.student_code && s.email && " · "}
                        {s.email}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-3 text-sm text-muted-foreground">{s.phone ?? "—"}</div>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString("vi-VN")}
                  </div>
                  <div className="col-span-2 md:text-right">
                    {count === 0 ? (
                      <Badge variant="gold">Chờ xếp lớp</Badge>
                    ) : (
                      <Badge variant="jade">{count} lớp</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
