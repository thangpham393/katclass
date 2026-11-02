"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HeartHandshake, PhoneCall, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { EmptyRow, Pill, TD, Th, useSort } from "@/components/ui/table-kit";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { dbErrorMessage, todayISO } from "@/lib/db";
import { useLoad } from "@/lib/use-load";
import {
  CARE_DEFAULT_DUE_DAYS,
  CARE_SOURCE_LABELS,
  CARE_STATUS_LABELS,
  careCode,
  createCareRequest,
  deleteCareRequest,
  fetchCareAssignees,
  fetchCareRequests,
  fetchCareStudentOptions,
  isCareOpen,
  isCareOverdue,
  updateCareRequest,
  type CarePerson,
  type CareRequestRow,
  type CareSource,
  type CareStatus,
} from "@/lib/db-care-requests";

type Tab = "open" | "new" | "in_progress" | "overdue" | "closed";
type Owner = "all" | "mine" | "none";

const TABS: { key: Tab; label: string }[] = [
  { key: "open", label: "Đang mở" },
  { key: "new", label: "Mới" },
  { key: "in_progress", label: "Đang xử lý" },
  { key: "overdue", label: "Quá hạn" },
  { key: "closed", label: "Đã đóng" },
];

function dmy(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function CareStatusPill({ r }: { r: Pick<CareRequestRow, "status"> }) {
  const tone = { new: "amber", in_progress: "blue", done: "green", cancelled: "muted" } as const;
  return <Pill tone={tone[r.status]}>{CARE_STATUS_LABELS[r.status]}</Pill>;
}

export default function AdminCarePage() {
  const { user } = useAuth();
  const today = todayISO();
  const list = useLoad(() => fetchCareRequests());
  const assignees = useLoad(fetchCareAssignees);

  const [tab, setTab] = useState<Tab>("open");
  const [owner, setOwner] = useState<Owner>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<CareRequestRow | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { open: 0, new: 0, in_progress: 0, overdue: 0, closed: 0 };
    for (const r of rows) {
      if (isCareOpen(r.status)) c.open++;
      else c.closed++;
      if (r.status === "new") c.new++;
      if (r.status === "in_progress") c.in_progress++;
      if (isCareOverdue(r, today)) c.overdue++;
    }
    return c;
  }, [rows, today]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "open" && !isCareOpen(r.status)) return false;
      if (tab === "new" && r.status !== "new") return false;
      if (tab === "in_progress" && r.status !== "in_progress") return false;
      if (tab === "overdue" && !isCareOverdue(r, today)) return false;
      if (tab === "closed" && isCareOpen(r.status)) return false;
      if (owner === "mine" && r.assignee_id !== user?.id) return false;
      if (owner === "none" && r.assignee_id) return false;
      if (!needle) return true;
      return `${careCode(r.no)} ${r.student?.name ?? ""} ${r.student?.student_code ?? ""} ${r.class?.name ?? ""} ${r.issue}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, tab, owner, q, today, user?.id]);

  const sort = useSort(filtered, {
    code: (r) => r.no,
    name: (r) => r.student?.name ?? "",
    issue: (r) => r.issue,
    handler: (r) => r.assignee?.name ?? null,
    due: (r) => r.due_date,
    status: (r) => r.status,
  });

  async function quick(r: CareRequestRow, patch: Parameters<typeof updateCareRequest>[1]) {
    setBusy(r.id);
    setError(null);
    try {
      await updateCareRequest(r.id, patch);
      list.reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Chăm sóc học viên</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Mỗi phiếu là một việc cần làm với học viên. Vắng từ 2 buổi liên tiếp thì hệ thống tự mở
            phiếu; ghi liên hệ ở trang{" "}
            <Link href="/admin/absences" className="font-semibold text-brand-600 hover:underline">
              Vắng liên tiếp
            </Link>{" "}
            thì phiếu tự chuyển Đang xử lý, chọn kết quả &ldquo;Đã xử lý xong&rdquo; là đóng phiếu.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Tạo yêu cầu
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              tab === t.key ? "border-brand-600 bg-brand-600 text-white" : "bg-card hover:bg-secondary",
              t.key === "overdue" && counts.overdue > 0 && tab !== t.key && "border-rose-200 text-rose-600",
            )}
          >
            {t.label}
            <span className="opacity-70">{list.loading ? "…" : counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[220px_1fr]">
        <Select value={owner} onChange={(e) => setOwner(e.target.value as Owner)}>
          <option value="all">Mọi người xử lý</option>
          <option value="mine">Phiếu của tôi</option>
          <option value="none">Chưa ai nhận</option>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm mã phiếu, học viên, lớp, vấn đề..."
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {(list.error || error) && <ErrorNote message={list.error ?? error ?? ""} />}

      <Card className="overflow-hidden">
        {list.loading ? (
          <LoadingRows rows={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <Th k="code" {...sort}>Mã</Th>
                  <Th k="name" {...sort}>Học viên</Th>
                  <Th k="issue" {...sort}>Vấn đề</Th>
                  <Th k="handler" {...sort}>Người xử lý</Th>
                  <Th k="due" {...sort}>Hạn</Th>
                  <Th k="status" {...sort}>Trạng thái</Th>
                  <Th align="right">Thao tác</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sort.sorted.length === 0 ? (
                  <EmptyRow cols={7}>
                    {rows.length === 0 ? "Chưa có phiếu chăm sóc nào." : "Không có phiếu nào khớp bộ lọc."}
                  </EmptyRow>
                ) : (
                  sort.sorted.map((r) => {
                    const overdue = isCareOverdue(r, today);
                    return (
                      <tr key={r.id} className="hover:bg-brand-50/40">
                        <td className={cn(TD, "whitespace-nowrap")}>
                          <button
                            type="button"
                            onClick={() => setEditing(r)}
                            className="font-semibold hover:text-brand-600 hover:underline"
                          >
                            {careCode(r.no)}
                          </button>
                          <div className="text-xs text-muted-foreground">{dmy(r.created_at)}</div>
                        </td>
                        <td className={TD}>
                          {r.student ? (
                            <Link href={`/admin/students/${r.student.id}`} className="font-semibold text-brand-600 hover:underline">
                              {r.student.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                          <div className="text-xs text-muted-foreground">
                            {[r.class?.name, r.class?.teacher?.name].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </td>
                        <td className={cn(TD, "max-w-md")}>
                          <div>{r.issue}</div>
                          {r.note && <div className="mt-0.5 text-xs text-foreground/70">↳ {r.note}</div>}
                          <div className="text-xs text-muted-foreground">
                            {CARE_SOURCE_LABELS[r.source]}
                            {r.creator ? ` · ${r.creator.name} tạo` : ""}
                          </div>
                        </td>
                        <td className={cn(TD, "whitespace-nowrap")}>
                          {r.assignee?.name ?? <span className="text-muted-foreground">Chưa ai nhận</span>}
                        </td>
                        <td className={cn(TD, "whitespace-nowrap")}>
                          <div className={cn(overdue && "font-semibold text-rose-600")}>{dmy(r.due_date)}</div>
                          {overdue && (
                            <div className="mt-1">
                              <Pill tone="red">Quá hạn</Pill>
                            </div>
                          )}
                        </td>
                        <td className={TD}>
                          <CareStatusPill r={r} />
                        </td>
                        <td className={cn(TD, "whitespace-nowrap text-right")}>
                          <div className="flex justify-end gap-1.5">
                            {r.status === "new" && user && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === r.id}
                                onClick={() => quick(r, { assignee_id: user.id, status: "in_progress" })}
                              >
                                Tôi nhận
                              </Button>
                            )}
                            {r.status === "in_progress" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === r.id}
                                onClick={() => quick(r, { status: "done" })}
                              >
                                Xong
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                              Sửa
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <CareModal
          row={editing === "new" ? null : editing}
          assignees={assignees.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
}

/* ================= Tạo / sửa phiếu ================= */

function CareModal({
  row,
  assignees,
  onClose,
  onSaved,
}: {
  row: CareRequestRow | null;
  assignees: CarePerson[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const students = useLoad(async () => (row ? [] : fetchCareStudentOptions()), [row]);
  const [studentQ, setStudentQ] = useState("");
  const [studentId, setStudentId] = useState(row?.student_id ?? "");
  const [classId, setClassId] = useState(row?.class_id ?? "");
  const [source, setSource] = useState<CareSource>(row?.source ?? "other");
  const [issue, setIssue] = useState(row?.issue ?? "");
  const [assigneeId, setAssigneeId] = useState(row?.assignee_id ?? "");
  const [dueDate, setDueDate] = useState(row?.due_date ?? todayISO(CARE_DEFAULT_DUE_DAYS));
  const [status, setStatus] = useState<CareStatus>(row?.status ?? "new");
  const [note, setNote] = useState(row?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentOptions = useMemo(() => {
    const needle = studentQ.trim().toLowerCase();
    const all = students.data ?? [];
    if (!needle) return all;
    return all.filter((s) => `${s.name} ${s.student_code ?? ""}`.toLowerCase().includes(needle));
  }, [students.data, studentQ]);
  const picked = (students.data ?? []).find((s) => s.id === studentId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !issue.trim()) {
      setError("Chọn học viên và ghi vấn đề cần xử lý.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (row) {
        await updateCareRequest(row.id, {
          source,
          issue: issue.trim(),
          assignee_id: assigneeId || null,
          due_date: dueDate || null,
          // Giao cho người khác khi phiếu còn "Mới" thì chuyển luôn sang Đang xử lý
          status: status === "new" && assigneeId ? "in_progress" : status,
          note: note.trim() || null,
        });
      } else {
        await createCareRequest({
          student_id: studentId,
          class_id: classId || picked?.classes[0]?.id || null,
          source,
          issue,
          assignee_id: assigneeId || null,
          due_date: dueDate || null,
          note,
        });
      }
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!row || !confirm(`Xoá phiếu ${careCode(row.no)}? Không khôi phục được.`)) return;
    setSaving(true);
    try {
      await deleteCareRequest(row.id);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={row ? `Phiếu ${careCode(row.no)} — ${row.student?.name ?? ""}` : "Tạo yêu cầu chăm sóc"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}

        {!row && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Học viên" required>
              <Input
                placeholder="Gõ tên hoặc mã để lọc..."
                value={studentQ}
                onChange={(e) => setStudentQ(e.target.value)}
                className="mb-2"
              />
              <Select
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  setClassId("");
                }}
                disabled={students.loading}
              >
                <option value="">{students.loading ? "Đang tải..." : `— Chọn (${studentOptions.length}) —`}</option>
                {studentOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.student_code ? ` · ${s.student_code}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Lớp">
              <Select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!picked}>
                {(picked?.classes ?? []).length === 0 ? (
                  <option value="">Không có lớp đang học</option>
                ) : (
                  picked!.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </Select>
            </Field>
          </div>
        )}

        <Field label="Vấn đề" required hint="Việc cần làm: gọi phụ huynh về gì, đề xuất gì...">
          <Textarea value={issue} onChange={(e) => setIssue(e.target.value)} rows={3} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nguồn">
            <Select value={source} onChange={(e) => setSource(e.target.value as CareSource)}>
              {(Object.keys(CARE_SOURCE_LABELS) as CareSource[]).map((k) => (
                <option key={k} value={k}>
                  {CARE_SOURCE_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Người xử lý">
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Chưa ai nhận</option>
              {assignees.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hạn">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>

        {row && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Trạng thái">
              <Select value={status} onChange={(e) => setStatus(e.target.value as CareStatus)}>
                {(Object.keys(CARE_STATUS_LABELS) as CareStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {CARE_STATUS_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        <Field label="Ghi chú xử lý" hint="Đã gọi chưa, phụ huynh nói gì, hẹn khi nào...">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex gap-2">
            {row && (
              <Button type="button" variant="ghost" onClick={handleDelete} disabled={saving} className="text-destructive">
                <Trash2 className="h-4 w-4" /> Xoá
              </Button>
            )}
            {row?.source === "attendance" && (
              <Link
                href="/admin/absences"
                className="inline-flex h-10 items-center gap-1.5 px-2 text-sm font-semibold text-brand-600 hover:underline"
              >
                <PhoneCall className="h-4 w-4" /> Ghi liên hệ
              </Link>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : row ? "Lưu" : (
                <>
                  <HeartHandshake className="h-4 w-4" /> Tạo phiếu
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
