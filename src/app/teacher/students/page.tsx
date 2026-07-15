"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { fetchTeacherStudents, type TeacherStudentRow } from "@/lib/db";

export default function TeacherStudentsPage() {
  const { user } = useAuth();
  const teacherId = user?.id ?? "";
  const rows = useLoad(
    () => (teacherId ? fetchTeacherStudents(teacherId) : Promise.resolve([])),
    [teacherId],
  );
  const [q, setQ] = useState("");

  // Gom theo học viên (một em có thể học nhiều lớp của cùng giáo viên)
  const students = useMemo(() => {
    const map = new Map<string, { student: TeacherStudentRow["student"]; classes: string[] }>();
    for (const r of rows.data ?? []) {
      if (!r.student) continue;
      const entry = map.get(r.student_id) ?? { student: r.student, classes: [] };
      if (r.class) entry.classes.push(r.class.name);
      map.set(r.student_id, entry);
    }
    let list = [...map.values()];
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.student.name.toLowerCase().includes(needle) ||
          (s.student.student_code ?? "").toLowerCase().includes(needle) ||
          s.classes.some((c) => c.toLowerCase().includes(needle)),
      );
    }
    return list.sort((a, b) => a.student.name.localeCompare(b.student.name, "vi"));
  }, [rows.data, q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Học viên của tôi</h1>
        <p className="mt-1 text-muted-foreground">
          {rows.loading ? "Đang tải..." : `${students.length} học viên trong các lớp bạn phụ trách.`}
        </p>
      </div>

      {rows.error && <ErrorNote message={rows.error} />}

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên, mã học viên, lớp..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {rows.loading ? (
        <Card><LoadingRows rows={5} /></Card>
      ) : students.length === 0 ? (
        <Empty
          icon={Users}
          title={q ? "Không tìm thấy học viên" : "Chưa có học viên"}
          description={q ? "Thử từ khóa khác." : "Khi bạn được gán phụ trách lớp, danh sách học viên sẽ hiện ở đây."}
        />
      ) : (
        <Card>
          <div className="divide-y">
            {students.map(({ student, classes }) => (
              <div key={student.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20">
                <Avatar name={student.name} src={student.avatar ?? undefined} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{student.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {student.student_code && (
                      <span className="font-mono font-medium text-brand-700">{student.student_code}</span>
                    )}
                    {student.student_code && (student.phone || student.email) && " · "}
                    {student.phone ?? student.email}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {classes.map((c) => (
                    <Badge key={c} variant="outline">{c}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
